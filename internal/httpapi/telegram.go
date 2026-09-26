package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/telegram"
)

// telegramHandlers serves the settings screen's Telegram endpoints (design
// §6). It is separate from `handlers` because it depends on the settings
// store and the poller rather than the idea store.
type telegramHandlers struct {
	settings *settings.Store
	poller   *telegram.Poller
	// getMe is the token-validating call, overridden in tests to avoid a real
	// network request.
	getMe func(ctx context.Context, token string) (telegram.User, error)
}

func newTelegramHandlers(settingsStore *settings.Store, poller *telegram.Poller) *telegramHandlers {
	return &telegramHandlers{
		settings: settingsStore,
		poller:   poller,
		getMe: func(ctx context.Context, token string) (telegram.User, error) {
			ctx, cancel := context.WithTimeout(ctx, telegram.DefaultRequestTimeout)
			defer cancel()
			return telegram.NewClient(telegram.DefaultBaseURL(token), http.DefaultClient).GetMe(ctx)
		},
	}
}

// telegramStatus is GET /api/settings/telegram's response shape. The token
// itself is never included, not even masked (design §4.3).
type telegramStatus struct {
	Connected bool    `json:"connected"`
	Username  string  `json:"username,omitempty"`
	Paired    bool    `json:"paired"`
	PairCode  string  `json:"pair_code,omitempty"`
	ExpiresAt *string `json:"pair_code_expires_at,omitempty"`
	LastError string  `json:"last_error,omitempty"`
	// LastSyncAt is when getUpdates last answered successfully (issue #8).
	LastSyncAt *string `json:"last_sync_at,omitempty"`
}

func (h *telegramHandlers) status(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	token, connected, err := h.settings.Get(ctx, telegram.KeyToken)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong reading settings.")
		return
	}
	connected = connected && token != ""

	status := telegramStatus{Connected: connected}

	if connected {
		if username, ok, err := h.settings.Get(ctx, telegram.KeyUsername); err == nil && ok {
			status.Username = username
		}
	}

	if _, paired, err := h.settings.Get(ctx, telegram.KeyChatID); err == nil {
		status.Paired = paired
	}

	if !status.Paired {
		if code, ok, err := telegram.ActivePairCode(ctx, h.settings); err == nil && ok {
			status.PairCode = code.Code
			expires := code.ExpiresAt.Format(time.RFC3339)
			status.ExpiresAt = &expires
		}
	}

	if lastErr, ok, err := h.settings.Get(ctx, telegram.KeyLastError); err == nil && ok {
		status.LastError = lastErr
	}

	if connected {
		if lastSync, ok, err := h.settings.Get(ctx, telegram.KeyLastSync); err == nil && ok && lastSync != "" {
			status.LastSyncAt = &lastSync
		}
	}

	writeJSON(w, http.StatusOK, status)
}

type connectRequest struct {
	Token string `json:"token"`
}

func (h *telegramHandlers) connect(w http.ResponseWriter, r *http.Request) {
	var body connectRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return
	}
	if body.Token == "" {
		writeError(w, http.StatusBadRequest, "A bot token is required.")
		return
	}

	user, err := h.getMe(r.Context(), body.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Telegram rejected that token: "+err.Error())
		return
	}

	if err := h.settings.Set(r.Context(), telegram.KeyToken, body.Token); err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	if err := h.settings.Set(r.Context(), telegram.KeyUsername, user.Username); err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
		return
	}
	_ = h.settings.Delete(r.Context(), telegram.KeyLastError)
	_ = h.settings.Delete(r.Context(), telegram.KeyLastSync) // belonged to the previous token, if any

	if h.poller != nil {
		h.poller.Sync()
	}

	h.status(w, r)
}

func (h *telegramHandlers) disconnect(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clear := func() error {
		for _, key := range []string{telegram.KeyToken, telegram.KeyUsername, telegram.KeyChatID, telegram.KeyOffset, telegram.KeyPairCode, telegram.KeyLastError, telegram.KeyLastSync} {
			if err := h.settings.Delete(ctx, key); err != nil {
				return err
			}
		}
		return nil
	}
	var err error
	if h.poller != nil {
		err = h.poller.Reset(clear)
	} else {
		err = clear()
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong disconnecting.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *telegramHandlers) pair(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token, connected, err := h.settings.Get(ctx, telegram.KeyToken)
	if err != nil || !connected || token == "" {
		writeError(w, http.StatusBadRequest, "Connect a bot token first.")
		return
	}

	if _, err := telegram.NewPairCode(ctx, h.settings); err != nil {
		writeError(w, http.StatusInternalServerError, "Something went wrong generating a code.")
		return
	}

	h.status(w, r)
}

func (h *telegramHandlers) sync(w http.ResponseWriter, r *http.Request) {
	if h.poller != nil {
		h.poller.Sync()
	}
	w.WriteHeader(http.StatusAccepted)
}
