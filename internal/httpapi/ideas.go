package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

type handlers struct {
	store *idea.Store
}

// pathID reads {id} and writes the 400 itself when it is not a number.
func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "That nugget id isn't a number.")
		return 0, false
	}
	return id, true
}

func decodeDraft(w http.ResponseWriter, r *http.Request) (idea.Draft, bool) {
	var draft idea.Draft
	if err := json.NewDecoder(r.Body).Decode(&draft); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return draft, false
	}
	return draft, true
}

func (h *handlers) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ideas, err := h.store.List(r.Context(), idea.ListFilter{
		Query:    q.Get("q"),
		Tag:      q.Get("tag"),
		Status:   q.Get("status"),
		Archived: q.Get("archived") == "true",
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ideas)
}

func (h *handlers) create(w http.ResponseWriter, r *http.Request) {
	draft, ok := decodeDraft(w, r)
	if !ok {
		return
	}
	created, err := h.store.Create(r.Context(), draft)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *handlers) get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	found, err := h.store.Get(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, found)
}

func (h *handlers) update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	draft, ok := decodeDraft(w, r)
	if !ok {
		return
	}
	updated, err := h.store.Update(r.Context(), id, draft)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *handlers) archive(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Archive)
}

func (h *handlers) restore(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Restore)
}

func (h *handlers) purge(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Purge)
}

// mutate runs an id-only state change and returns 204.
func (h *handlers) mutate(w http.ResponseWriter, r *http.Request, action func(context.Context, int64) error) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if err := action(r.Context(), id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) random(w http.ResponseWriter, r *http.Request) {
	drawn, err := h.store.Random(r.Context(), r.URL.Query().Get("tag"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, drawn)
}

func (h *handlers) tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.Tags(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tags)
}
