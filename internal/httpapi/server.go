package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// NewServer builds the full handler: API routes plus the embedded frontend.
func NewServer(store *idea.Store, frontend http.Handler) http.Handler {
	h := &handlers{store: store}
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
