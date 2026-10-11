// Package web serves the built frontend from inside the binary.
package web

import (
	"bytes"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"path"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/look"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// The all: prefix matters — plain embed skips files beginning with _ or .,
// which would drop some Vite assets.
//
//go:embed all:dist
var dist embed.FS

// Dist is the built frontend embedded in the binary.
func Dist() (fs.FS, error) {
	return fs.Sub(dist, "dist")
}

// Handler serves the SPA from files, falling back to index.html for unknown
// paths so client-side routes survive a refresh. index.html is stamped with
// data-look on <html> as it goes out, so first paint is already in the right
// Look: the saved one, or ?look=classic|comic for that response only. It is
// read per request, so a change in Settings shows on the next load.
func Handler(files fs.FS, store *settings.Store) http.Handler {
	static := http.FileServer(http.FS(files))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" && name != "index.html" {
			if _, err := fs.Stat(files, name); err == nil {
				static.ServeHTTP(w, r)
				return
			}
		}
		page, err := fs.ReadFile(files, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		chosen := r.URL.Query().Get("look")
		if !look.Valid(chosen) {
			if chosen, err = look.Load(r.Context(), store); err != nil {
				log.Printf("reading look: %v", err)
				chosen = look.Classic
			}
		}
		page = bytes.Replace(page, []byte("<html"), []byte(`<html data-look="`+chosen+`"`), 1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(page)
	})
}
