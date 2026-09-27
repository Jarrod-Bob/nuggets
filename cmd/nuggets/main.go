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
	"github.com/Jarrod-Bob/nuggets/internal/httpapi"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/spices"
	"github.com/Jarrod-Bob/nuggets/internal/telegram"
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
	// streams are ended, in-flight requests finish, and the import loops stop.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	ideaStore := idea.NewStore(database)
	settingsStore := settings.NewStore(database)
	// Both importers announce what they changed here, and GET /api/events
	// passes it on to open pages so they refetch without a reload.
	broker := events.NewBroker()
	poller := telegram.NewPoller(ideaStore, settingsStore, telegram.WithEvents(broker))

	// Started in a goroutine before Serve begins, so a slow or unreachable
	// Telegram never delays the listener coming up (design §4.2). Loop runs
	// until shutdown.
	go poller.Loop(ctx)

	// The spices pull loop, likewise: its first pull runs at startup when a
	// token is stored, then every interval and on Sync now. It runs alongside
	// Telegram capture; both import into the same bank under their own
	// source (docs/superpowers/specs/2026-09-26-spices-pull-design.md).
	syncer := spices.NewSyncer(ideaStore, settingsStore, spices.WithEvents(broker))
	go syncer.Loop(ctx)

	server := &http.Server{
		Handler:           httpapi.NewServer(ideaStore, settingsStore, poller, syncer, broker, frontend),
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
