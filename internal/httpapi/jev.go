package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// jevHandlers serves the settings screen's "Tag suggestions" section and each
// nugget's tag suggestions (Jev tag-suggestions design §4). No handler here
// calls TypeSafe: they change settings or suggestions and wake the
// Suggester, which stays the only caller. Accepting a suggestion has no
// route of its own: the page PATCHes the nugget's tags.
type jevHandlers struct {
	settings  *settings.Store
	suggester *jev.Suggester
}

// jevStatus is GET /api/settings/jev's response shape. The key is
// write-only: it is never included, not even masked.
type jevStatus struct {
	Connected bool   `json:"connected"`
	LastError string `json:"last_error,omitempty"`
	// Pending counts nuggets waiting for a tag check.
	Pending int `json:"pending"`
}

func (h *jevHandlers) status(w http.ResponseWriter, r *http.Request) {
	st, err := jev.LoadStatus(r.Context(), h.settings)
	if err != nil {
		log.Printf("reading tag-suggestion settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	status := jevStatus{Connected: st.Connected, LastError: st.LastError}
	if status.Pending, err = h.suggester.Pending(r.Context()); err != nil {
		log.Printf("counting tag checks: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// jevSaveRequest is PUT /api/settings/jev's body.
type jevSaveRequest struct {
	APIKey string `json:"api_key"`
}

// save stores a new key. It clears the last error, which described the old
// key, and un-parks the Suggester.
func (h *jevHandlers) save(w http.ResponseWriter, r *http.Request) {
	var body jevSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}
	key := strings.TrimSpace(body.APIKey)
	if key == "" {
		writeError(w, http.StatusBadRequest, "Paste a TypeSafe API key to connect.")
		return
	}
	ctx := r.Context()
	change := func() error {
		if err := h.settings.Set(ctx, jev.KeyAPIKey, key); err != nil {
			return err
		}
		return h.settings.Delete(ctx, jev.KeyLastError)
	}
	if err := h.suggester.Reset(ctx, change); err != nil {
		log.Printf("saving tag-suggestion settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	h.status(w, r)
}

// disconnect forgets the key and the last error and empties the queue.
// Suggestions already made stay on their nuggets.
func (h *jevHandlers) disconnect(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	change := func() error {
		for _, key := range []string{jev.KeyAPIKey, jev.KeyLastError} {
			if err := h.settings.Delete(ctx, key); err != nil {
				return err
			}
		}
		return h.suggester.ClearQueue(ctx)
	}
	if err := h.suggester.Reset(ctx, change); err != nil {
		log.Printf("disconnecting tag suggestions: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong disconnecting.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// suggestions lists one nugget's open tag suggestions: [] when it has none.
func (h *jevHandlers) suggestions(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	list, err := h.suggester.Suggestions(r.Context(), id)
	if err != nil {
		log.Printf("loading tag suggestions: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong loading tag suggestions.")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// dismiss records that the captain turned a tag down for this nugget, for
// good. Dismissing a tag with no open suggestion still records it.
func (h *jevHandlers) dismiss(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if err := h.suggester.Dismiss(r.Context(), id, r.PathValue("tag")); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
