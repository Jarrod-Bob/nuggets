// Package jev offers tag suggestions: tags already in use that TypeSafe's Jev
// model thinks a nugget is missing (issue #25). Design:
// docs/superpowers/specs/2026-10-09-jev-tag-suggestions-design.md.
//
// Queue is the SQL side: its hooks run inside the nugget write's own
// transaction (ContentChanged queues a tag check; TagsAdded and TagsRemoved
// keep suggestions and dismissals in step with the nugget's tags). Suggester
// is the only code that calls TypeSafe.
package jev

import (
	"context"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Settings keys (design §3). The jev package owns them: the settings API
// handlers, the Queue and the Suggester are the only readers and writers.
const (
	KeyAPIKey    = "jev_api_key" // write-only: never returned by the API or logged
	KeyLastError = "jev_last_error"
)

const (
	// DefaultBaseURL is TypeSafe's API. Only tests point the Suggester
	// elsewhere.
	DefaultBaseURL = "https://api.typesafe.ai"
	// Model is the Jev model every check asks.
	Model = "jev-latest"
)

const (
	// Threshold is the least yes-probability a tag needs to be suggested.
	Threshold = 0.7
	// MaxSuggestions caps how many tags one check suggests.
	MaxSuggestions = 3
	// maxQuestionsPerRequest splits a check with more candidate tags across
	// several requests. The API documents no maximum; 50 is a starting point.
	maxQuestionsPerRequest = 50
	// maxExamples is how many other nuggets' titles explain a candidate tag.
	maxExamples = 3
)

// Status is what the settings screen shows about the connection. The key
// itself is never part of it.
type Status struct {
	Connected bool
	LastError string
}

// LoadStatus reads whether a key is stored and the last error.
func LoadStatus(ctx context.Context, store *settings.Store) (Status, error) {
	key, _, err := store.Get(ctx, KeyAPIKey)
	if err != nil {
		return Status{}, err
	}
	lastError, _, err := store.Get(ctx, KeyLastError)
	if err != nil {
		return Status{}, err
	}
	return Status{Connected: key != "", LastError: lastError}, nil
}
