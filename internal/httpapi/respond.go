package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// errorBody is the one error shape the API ever returns.
type errorBody struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("writing response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	var body errorBody
	body.Error.Message = message
	writeJSON(w, status, body)
}

// writeStoreError maps domain errors onto status codes in one place.
func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, idea.ErrNotFound):
		writeError(w, http.StatusNotFound, "That nugget isn't in the bank.")
	case errors.Is(err, idea.ErrEmptyTitle):
		writeError(w, http.StatusBadRequest, idea.ErrEmptyTitle.Error())
	default:
		log.Printf("unexpected store error: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
	}
}
