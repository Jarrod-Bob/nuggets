package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Jarrod-Bob/nuggets/internal/look"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// lookHandlers serves the Look picker in Settings.
type lookHandlers struct {
	settings *settings.Store
}

type lookSetting struct {
	Look string `json:"look"`
}

func (h *lookHandlers) get(w http.ResponseWriter, r *http.Request) {
	v, err := look.Load(r.Context(), h.settings)
	if err != nil {
		log.Printf("reading look: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	writeJSON(w, http.StatusOK, lookSetting{Look: v})
}

func (h *lookHandlers) save(w http.ResponseWriter, r *http.Request) {
	var body lookSetting
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}
	err := look.Save(r.Context(), h.settings, body.Look)
	if errors.Is(err, look.ErrInvalid) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		log.Printf("saving look: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	writeJSON(w, http.StatusOK, lookSetting{Look: body.Look})
}
