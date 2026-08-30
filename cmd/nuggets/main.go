// Command nuggets serves the idea bank and opens it in a browser.
package main

import (
	"flag"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/httpapi"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
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

	server := &http.Server{
		Handler:           httpapi.NewServer(idea.NewStore(database), frontend),
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := server.Serve(listener); err != nil {
		log.Fatalf("serving: %v", err)
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
