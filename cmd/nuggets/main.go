// Command nuggets serves the idea bank and opens it in a browser.
package main

import (
	"context"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/github"
	"github.com/Jarrod-Bob/nuggets/internal/httpapi"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/jev"
	"github.com/Jarrod-Bob/nuggets/internal/kimi"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/spices"
	"github.com/Jarrod-Bob/nuggets/internal/web"
)

func main() {
	// 127.0.0.1, never :7777 — binding all interfaces prompts the Windows
	// firewall on every rebuild and exposes the bank to the LAN.
	addr := flag.String("addr", "127.0.0.1:7777", "address to listen on")
	dbPath := flag.String("db", "", "database file (default: %AppData%\\nuggets\\nuggets.db)")
	open := flag.Bool("open", true, "open a browser on start")
	flag.Parse()

	path := *dbPath
	if path == "" {
		resolved, err := db.DefaultPath()
		if err != nil {
			log.Fatalf("locating database: %v", err)
		}
		path = resolved
	}

	database, err := db.Open(path)
	if err != nil {
		log.Fatalf("opening database: %v", err)
	}
	defer database.Close()

	frontend, err := web.Handler()
	if err != nil {
		log.Fatalf("loading frontend: %v", err)
	}

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listening on %s: %v", *addr, err)
	}

	url := "http://" + *addr
	log.Printf("nuggets is at %s (db: %s)", url, path)
	if *open {
		go func() {
			time.Sleep(200 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				log.Printf("could not open a browser: %v", err)
			}
		}()
	}

	// Ctrl+C (or a termination signal) stops the server cleanly: open event
	// streams are ended, in-flight requests finish, and the spices loop stops.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	settingsStore := settings.NewStore(database)
	// A nugget that gains a mapped tag queues a GitHub feature request in the
	// same transaction as the write that added it
	// (docs/superpowers/specs/2026-09-28-tag-to-github-issue-design.md).
	outbox := github.NewOutbox(database, settingsStore)
	// A nugget whose title or notes change queues a tag check in the same
	// transaction; a tag added by hand clears its suggestion and a tag removed
	// is recorded as dismissed
	// (docs/superpowers/specs/2026-10-09-jev-tag-suggestions-design.md).
	tagChecks := jev.NewQueue(database, settingsStore)
	ideaStore := idea.NewStore(database,
		idea.WithTagsAdded(outbox.TagsAdded),
		idea.WithTagsAdded(tagChecks.TagsAdded),
		idea.WithTagsRemoved(tagChecks.TagsRemoved),
		idea.WithContentChanged(tagChecks.ContentChanged),
	)
	// The spices pull loop, the GitHub sender and the jev suggester announce
	// what they changed here, and GET /api/events passes it on to open pages
	// so they refetch without a reload.
	broker := events.NewBroker()

	// The spices pull loop, the only way ideas arrive from outside the app
	// (docs/superpowers/specs/2026-09-26-spices-pull-design.md). Started in a
	// goroutine before Serve begins, so a slow or unreachable spices never
	// delays the listener coming up; its first pull runs at startup when a
	// token is stored, then every interval and on Sync now. Loop runs until
	// shutdown.
	syncer := spices.NewSyncer(ideaStore, settingsStore, spices.WithEvents(broker))
	go syncer.Loop(ctx)

	// The only caller of GitHub: sends queued feature requests at startup,
	// whenever one is queued or retried, and when a backoff runs out. With no
	// token it parks and the queue waits.
	sender := github.NewSender(outbox, ideaStore, settingsStore, github.WithEvents(broker))
	go sender.Loop(ctx)

	// The only caller of TypeSafe: runs queued tag checks at startup, whenever
	// one is queued or the key changes, and when a backoff runs out. With no
	// key it parks and nothing is queued.
	suggester := jev.NewSuggester(tagChecks, ideaStore, settingsStore, jev.WithEvents(broker))
	go suggester.Loop(ctx)

	// The one kimi-no-name-wa client. Unlike spices and GitHub it has no loop:
	// each call runs on the request of the click that asked for names, so
	// closing the form cancels it. There is deliberately no WriteTimeout
	// below, so a slow first call (kimi loading its model) isn't cut off.
	kimiClient := kimi.NewClient(settingsStore, nil)

	server := &http.Server{
		Handler:           httpapi.NewServer(ideaStore, settingsStore, syncer, sender, kimiClient, suggester, broker, frontend),
		ReadHeaderTimeout: 5 * time.Second,
	}
	// Shutdown waits for handlers to return, and an event stream only
	// returns once its subscription ends.
	server.RegisterOnShutdown(broker.Close)

	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
	select {
	case err := <-served:
		log.Fatalf("serving: %v", err)
	case <-ctx.Done():
	}
	stop() // a second Ctrl+C now kills the process outright

	log.Printf("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutting down: %v", err)
	}
}

// openBrowser launches the default browser. For a chromeless window instead,
// run: msedge --app=http://127.0.0.1:7777
func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		// The empty string is start's window-title argument; without it a
		// quoted URL would be swallowed as the title.
		return exec.Command("cmd", "/c", "start", "", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}
