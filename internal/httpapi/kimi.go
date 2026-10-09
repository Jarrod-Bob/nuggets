package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/kimi"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// kimiHandlers serves the settings screen's kimi section and the form's
// project-name suggestions (kimi project-name design §4). The browser can't
// call kimi itself (no CORS, a Host check), so these proxy to it through the
// one kimi.Client, on the request's context: closing the form cancels the
// call.
type kimiHandlers struct {
	settings *settings.Store
	client   *kimi.Client
}

// kimiModelErrorCode marks a names error as kimi's model failing to run, so
// the form can say so and stop offering kimi (design §4–5, issue #36).
const kimiModelErrorCode = "kimi_model_error"

// maxAvoid mirrors kimi's own limit on avoid entries.
const maxAvoid = 500

type kimiSettings struct {
	URL string `json:"url"`
}

func (h *kimiHandlers) getSettings(w http.ResponseWriter, r *http.Request) {
	url, err := kimi.LoadURL(r.Context(), h.settings)
	if err != nil {
		log.Printf("reading kimi settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	writeJSON(w, http.StatusOK, kimiSettings{URL: url})
}

func (h *kimiHandlers) saveSettings(w http.ResponseWriter, r *http.Request) {
	var body kimiSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}
	saved, err := kimi.SaveURL(r.Context(), h.settings, body.URL)
	if errors.Is(err, kimi.ErrInvalidURL) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		log.Printf("saving kimi settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	writeJSON(w, http.StatusOK, kimiSettings{URL: saved})
}

func (h *kimiHandlers) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"available": h.client.Available(r.Context())})
}

type kimiNamesRequest struct {
	Notes string   `json:"notes"`
	Avoid []string `json:"avoid"`
}

type kimiNamesResponse struct {
	Names []kimi.Name `json:"names"`
}

func (h *kimiHandlers) names(w http.ResponseWriter, r *http.Request) {
	var body kimiNamesRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}
	notes := strings.TrimSpace(body.Notes)
	if notes == "" {
		writeError(w, http.StatusBadRequest, "Write some notes and kimi will name it.")
		return
	}
	if len(body.Avoid) > maxAvoid {
		writeError(w, http.StatusBadRequest, "That's too many names to avoid at once.")
		return
	}

	names, err := h.client.Names(r.Context(), notes, body.Avoid)
	switch {
	case err == nil:
		if names == nil {
			names = []kimi.Name{}
		}
		writeJSON(w, http.StatusOK, kimiNamesResponse{Names: names})
	case errors.Is(err, context.Canceled):
		// The form was closed or the request cancelled: nobody is listening.
	case errors.Is(err, kimi.ErrUnavailable):
		log.Printf("kimi names: %v", err)
		writeError(w, http.StatusServiceUnavailable, "kimi is not available at the moment.")
	case errors.Is(err, kimi.ErrModelError):
		log.Printf("kimi names: %v", err)
		writeErrorCode(w, http.StatusBadGateway, kimiModelErrorCode, "kimi's model couldn't run; check Ollama on the GPU machine.")
	default:
		log.Printf("kimi names: %v", err)
		writeError(w, http.StatusBadGateway, "kimi couldn't suggest names this time.")
	}
}
