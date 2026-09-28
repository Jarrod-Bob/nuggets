package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/github"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// githubHandlers serves the settings screen's GitHub section and each
// nugget's feature requests (tag-to-issue design §3). No handler here calls
// GitHub: they change settings or the queue and wake the Sender, which stays
// the only caller.
type githubHandlers struct {
	settings *settings.Store
	sender   *github.Sender
}

// githubStatus is GET /api/settings/github's response shape. The token is
// write-only: it is never included, not even masked.
type githubStatus struct {
	Connected bool             `json:"connected"`
	Mappings  []github.Mapping `json:"mappings"`
	LastError string           `json:"last_error,omitempty"`
	// Pending counts feature requests waiting to be sent; Failed those
	// GitHub refused, which wait for a Retry on their nugget's page.
	Pending int `json:"pending"`
	Failed  int `json:"failed"`
}

func (h *githubHandlers) status(w http.ResponseWriter, r *http.Request) {
	cfg, err := github.LoadConfig(r.Context(), h.settings)
	if err != nil {
		log.Printf("reading github settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	status := githubStatus{Connected: cfg.Connected, Mappings: cfg.Mappings, LastError: cfg.LastError}
	if status.Pending, status.Failed, err = h.sender.Counts(r.Context()); err != nil {
		log.Printf("counting feature requests: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// githubSaveRequest is PUT /api/settings/github's body. Both fields are
// optional: the mapping can change without retyping the token, and the token
// without resending the mapping. A present mappings list replaces the whole
// mapping; an empty one turns the feature off.
type githubSaveRequest struct {
	Token    *string           `json:"token"`
	Mappings *[]github.Mapping `json:"mappings"`
}

func (h *githubHandlers) save(w http.ResponseWriter, r *http.Request) {
	var body githubSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}

	token := ""
	if body.Token != nil {
		token = strings.TrimSpace(*body.Token)
	}
	var encoded string
	if body.Mappings != nil {
		valid, err := github.ValidateMappings(*body.Mappings)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if encoded, err = github.EncodeMappings(valid); err != nil {
			writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
			return
		}
	}

	ctx := r.Context()
	change := func() error {
		if body.Mappings != nil {
			if err := h.settings.Set(ctx, github.KeyMappings, encoded); err != nil {
				return err
			}
		}
		if token != "" {
			if err := h.settings.Set(ctx, github.KeyToken, token); err != nil {
				return err
			}
			// A stale error described the old token.
			return h.settings.Delete(ctx, github.KeyLastError)
		}
		return nil
	}
	if err := h.sender.Reset(ctx, change); err != nil {
		log.Printf("saving github settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	h.status(w, r)
}

// disconnect forgets the token and the last error. The mapping and the
// queue stay: rows queued meanwhile are sent once a token is saved again.
func (h *githubHandlers) disconnect(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	change := func() error {
		for _, key := range []string{github.KeyToken, github.KeyLastError} {
			if err := h.settings.Delete(ctx, key); err != nil {
				return err
			}
		}
		return nil
	}
	if err := h.sender.Reset(ctx, change); err != nil {
		log.Printf("disconnecting github: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong disconnecting.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// issues lists one nugget's feature requests: [] when it has none.
func (h *githubHandlers) issues(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	list, err := h.sender.Issues(r.Context(), id)
	if err != nil {
		log.Printf("loading feature requests: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong loading feature requests.")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// retry sends a failed feature request again.
func (h *githubHandlers) retry(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "That feature request id isn't a number.")
		return
	}
	is, err := h.sender.Retry(r.Context(), id)
	switch {
	case errors.Is(err, github.ErrIssueNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, github.ErrNotRetryable):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		log.Printf("retrying feature request: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong retrying that.")
	default:
		writeJSON(w, http.StatusOK, is)
	}
}
