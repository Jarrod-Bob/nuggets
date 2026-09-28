package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/github"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/spices"
)

// NewServer builds the full handler: API routes plus the embedded frontend.
// settingsStore, syncer, sender and broker may be nil only in tests that
// don't exercise the spices, GitHub or live-update routes;
// cmd/nuggets/main.go always wires all four. broker is what the spices
// syncer and the GitHub sender publish to, and GET /api/events streams it to
// the page.
func NewServer(store *idea.Store, settingsStore *settings.Store, syncer *spices.Syncer, sender *github.Sender, broker *events.Broker, frontend http.Handler) http.Handler {
	h := &handlers{store: store}
	sh := &spicesHandlers{settings: settingsStore, ideas: store, syncer: syncer}
	gh := &githubHandlers{settings: settingsStore, sender: sender}
	eh := &eventsHandler{broker: broker, heartbeat: defaultHeartbeat}
	mux := http.NewServeMux()

	// Go 1.22+ method+wildcard patterns. Unmatched methods give 405 for free.
	mux.HandleFunc("GET /api/ideas", h.list)
	mux.HandleFunc("POST /api/ideas", h.create)
	mux.HandleFunc("GET /api/ideas/random", h.random)
	mux.HandleFunc("GET /api/ideas/{id}", h.get)
	mux.HandleFunc("PATCH /api/ideas/{id}", h.update)
	mux.HandleFunc("DELETE /api/ideas/{id}", h.purge)
	mux.HandleFunc("POST /api/ideas/{id}/archive", h.archive)
	mux.HandleFunc("POST /api/ideas/{id}/restore", h.restore)
	mux.HandleFunc("GET /api/tags", h.tags)

	mux.HandleFunc("GET /api/settings/spices", sh.status)
	mux.HandleFunc("PUT /api/settings/spices", sh.connect)
	mux.HandleFunc("DELETE /api/settings/spices", sh.disconnect)
	mux.HandleFunc("POST /api/spices/sync", sh.sync)
	mux.HandleFunc("POST /api/spices/resync", sh.resync)

	mux.HandleFunc("GET /api/settings/github", gh.status)
	mux.HandleFunc("PUT /api/settings/github", gh.save)
	mux.HandleFunc("DELETE /api/settings/github", gh.disconnect)
	mux.HandleFunc("GET /api/ideas/{id}/github-issues", gh.issues)
	mux.HandleFunc("POST /api/github-issues/{id}/retry", gh.retry)

	mux.HandleFunc("GET /api/events", eh.stream)

	// Catch-all for anything under /api/ that didn't match a more specific
	// route above (wrong method on a path Go's mux can't already 405 for,
	// unknown sub-path, etc). ServeMux dispatches to the most specific
	// pattern, so this only catches what nothing else matched — it never
	// shadows the real endpoints. Without it, unmatched /api/* requests fell
	// through to the SPA catch-all below and got served index.html with a
	// 200 instead of a 404.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "Not found.")
	})

	if frontend != nil {
		mux.Handle("/", frontend)
	}

	return recoverer(logger(mux))
}

// recoverer turns a panic into a 500 instead of killing the server mid-session.
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("panic serving %s %s: %v", r.Method, r.URL.Path, v)
				writeError(w, http.StatusInternalServerError, "Something went wrong.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
