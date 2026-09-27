package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/spices"
)

// spicesHandlers serves the settings screen's Spices section (spices pull
// design §7). No handler here calls spices: they change settings and wake the
// Syncer, which stays the only caller.
type spicesHandlers struct {
	settings *settings.Store
	ideas    *idea.Store
	syncer   *spices.Syncer
}

// spicesStatus is GET /api/settings/spices's response shape. The API token is
// write-only: it is never included, not even masked.
type spicesStatus struct {
	Connected       bool    `json:"connected"`
	URL             string  `json:"url"`
	IntervalSeconds int     `json:"interval_seconds"`
	LastSyncAt      *string `json:"last_sync_at,omitempty"`
	LastError       string  `json:"last_error,omitempty"`
	// NeedsResync is true after spices answered 409, or after the address
	// changed with something already pulled: nothing is pulled until the
	// captain presses Re-sync.
	NeedsResync bool `json:"needs_resync"`
	// Detached is only set on Re-sync's answer: how many nuggets it kept aside.
	Detached *int64 `json:"detached,omitempty"`
}

func (h *spicesHandlers) readStatus(r *http.Request) (spicesStatus, error) {
	cfg, err := spices.LoadConfig(r.Context(), h.settings)
	if err != nil {
		return spicesStatus{}, err
	}
	status := spicesStatus{
		Connected:       cfg.Connected,
		URL:             cfg.URL,
		IntervalSeconds: int(cfg.Interval / time.Second),
		LastError:       cfg.LastError,
		NeedsResync:     cfg.NeedsResync,
	}
	if cfg.LastSync != nil {
		at := cfg.LastSync.UTC().Format(time.RFC3339)
		status.LastSyncAt = &at
	}
	return status, nil
}

func (h *spicesHandlers) status(w http.ResponseWriter, r *http.Request) {
	status, err := h.readStatus(r)
	if err != nil {
		log.Printf("reading spices settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// spicesConnectRequest is PUT /api/settings/spices's body. Every field is
// optional so the address or interval can change without retyping the
// token; the token is required only when none is stored yet.
type spicesConnectRequest struct {
	URL             *string `json:"url"`
	Token           *string `json:"token"`
	IntervalSeconds *int    `json:"interval_seconds"`
}

// validateSpicesURL accepts an http or https address with a host and nothing
// that could carry a secret or confuse path joining.
func validateSpicesURL(raw string) (string, error) {
	normalized := spices.NormalizeBaseURL(raw)
	if normalized == "" {
		return spices.DefaultBaseURL, nil
	}
	parsed, err := url.Parse(normalized)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", fmt.Errorf("The spices address needs to be an http or https URL, like %s.", spices.DefaultBaseURL)
	}
	if parsed.User != nil {
		return "", errors.New("Put the API token in the token field, not in the address.")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("The spices address can't have a query or fragment.")
	}
	return normalized, nil
}

func (h *spicesHandlers) connect(w http.ResponseWriter, r *http.Request) {
	var body spicesConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}

	var baseURL string
	if body.URL != nil {
		validated, err := validateSpicesURL(*body.URL)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		baseURL = validated
	}

	token := ""
	if body.Token != nil {
		token = strings.TrimSpace(*body.Token)
	}
	if token == "" {
		cfg, err := spices.LoadConfig(r.Context(), h.settings)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
			return
		}
		if !cfg.Connected {
			writeError(w, http.StatusBadRequest, "An API token is required.")
			return
		}
	}

	if body.IntervalSeconds != nil {
		secs := *body.IntervalSeconds
		if secs < int(spices.MinInterval/time.Second) || secs > int(spices.MaxInterval/time.Second) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("The sync interval must be between %d seconds and %d hours.",
				int(spices.MinInterval/time.Second), int(spices.MaxInterval/time.Hour)))
			return
		}
	}

	ctx := r.Context()
	write := func() error {
		before, err := spices.LoadConfig(ctx, h.settings)
		if err != nil {
			return err
		}
		addressChanged := false
		if baseURL != "" && baseURL != before.URL {
			if addressChanged, err = h.hasPulled(ctx, before); err != nil {
				return err
			}
		}
		if baseURL != "" {
			if err := h.settings.Set(ctx, spices.KeyURL, baseURL); err != nil {
				return err
			}
		}
		if token != "" {
			if err := h.settings.Set(ctx, spices.KeyToken, token); err != nil {
				return err
			}
		}
		if body.IntervalSeconds != nil {
			if err := h.settings.Set(ctx, spices.KeyInterval, strconv.Itoa(*body.IntervalSeconds)); err != nil {
				return err
			}
		}
		// A stale error would describe the old settings. The Re-sync message
		// stays: only Re-sync resolves that.
		if before.NeedsResync {
			return nil
		}
		// A different address may be a different spices database reusing the
		// old one's ids, so treat it like a 409 (spices pull design §5).
		if addressChanged {
			if err := h.settings.Set(ctx, spices.KeyNeedsResync, "1"); err != nil {
				return err
			}
			return h.settings.Set(ctx, spices.KeyLastError, spices.AddressChangedMessage)
		}
		return h.settings.Delete(ctx, spices.KeyLastError)
	}
	if err := h.reset(write); err != nil {
		log.Printf("saving spices settings: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	h.status(w, r)
}

// hasPulled reports whether anything came from spices at cfg's address:
// a cursor past 0 or any spices nugget. Only then does changing the address
// need a Re-sync.
func (h *spicesHandlers) hasPulled(ctx context.Context, cfg spices.Config) (bool, error) {
	if cfg.Cursor > 0 {
		return true, nil
	}
	n, err := h.ideas.CountBySource(ctx, idea.SourceSpices)
	return n > 0, err
}

// disconnect forgets the token and the sync status. The address, interval
// and cursor stay, so reconnecting resumes where it left off — and a spices
// that was reset meanwhile is still caught by its 409. Imported nuggets stay.
func (h *spicesHandlers) disconnect(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clear := func() error {
		for _, key := range []string{spices.KeyToken, spices.KeyLastError, spices.KeyLastSync} {
			if err := h.settings.Delete(ctx, key); err != nil {
				return err
			}
		}
		return nil
	}
	if err := h.reset(clear); err != nil {
		log.Printf("disconnecting spices: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong disconnecting.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *spicesHandlers) reset(fn func() error) error {
	if h.syncer != nil {
		return h.syncer.Reset(fn)
	}
	return fn()
}

// sync wakes the Syncer and returns 202 at once, without waiting for the pull.
func (h *spicesHandlers) sync(w http.ResponseWriter, r *http.Request) {
	if h.syncer != nil {
		h.syncer.Sync()
	}
	w.WriteHeader(http.StatusAccepted)
}

// resync detaches the spices nuggets, resets the cursor and pulls again
// (spices pull design §5). It answers with the status and how many nuggets
// were kept aside.
func (h *spicesHandlers) resync(w http.ResponseWriter, r *http.Request) {
	cfg, err := spices.LoadConfig(r.Context(), h.settings)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	if !cfg.Connected {
		writeError(w, http.StatusBadRequest, "Connect spices first.")
		return
	}
	if h.syncer == nil {
		writeError(w, http.StatusInternalServerError, "Syncing with spices isn't running.")
		return
	}
	moved, err := h.syncer.Resync(r.Context())
	if err != nil {
		log.Printf("re-syncing spices: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong re-syncing.")
		return
	}
	status, err := h.readStatus(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	status.Detached = &moved
	writeJSON(w, http.StatusOK, status)
}
