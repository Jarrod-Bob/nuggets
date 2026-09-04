package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/telegram"
)

// newTelegramTestServer builds a server exactly like NewServer, except the
// Telegram getMe validation is stubbed instead of making a real network call
// — acceptToken controls whether the stub behaves like a valid token. This
// lets connect() be tested without reaching api.telegram.org.
func newTelegramTestServer(t *testing.T, acceptToken bool) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	settingsStore := settings.NewStore(database)
	ideaStore := idea.NewStore(database)
	poller := telegram.NewPoller(ideaStore, settingsStore)

	h := &handlers{store: ideaStore}
	th := &telegramHandlers{
		settings: settingsStore,
		poller:   poller,
		getMe: func(ctx context.Context, token string) (telegram.User, error) {
			if !acceptToken {
				return telegram.User{}, errors.New("Unauthorized")
			}
			return telegram.User{ID: 1, Username: "testbot"}, nil
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/ideas", h.list)
	mux.HandleFunc("POST /api/ideas", h.create)
	mux.HandleFunc("GET /api/ideas/random", h.random)
	mux.HandleFunc("GET /api/ideas/{id}", h.get)
	mux.HandleFunc("PATCH /api/ideas/{id}", h.update)
	mux.HandleFunc("DELETE /api/ideas/{id}", h.purge)
	mux.HandleFunc("POST /api/ideas/{id}/archive", h.archive)
	mux.HandleFunc("POST /api/ideas/{id}/restore", h.restore)
	mux.HandleFunc("GET /api/tags", h.tags)
	mux.HandleFunc("GET /api/settings/telegram", th.status)
	mux.HandleFunc("PUT /api/settings/telegram", th.connect)
	mux.HandleFunc("DELETE /api/settings/telegram", th.disconnect)
	mux.HandleFunc("POST /api/settings/telegram/pair", th.pair)
	mux.HandleFunc("POST /api/telegram/sync", th.sync)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "Not found.")
	})

	return recoverer(logger(mux))
}

func TestTelegramStatusWhenNotConnected(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "GET", "/api/settings/telegram", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var status struct {
		Connected bool `json:"connected"`
		Paired    bool `json:"paired"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if status.Connected || status.Paired {
		t.Errorf("status = %+v, want connected=false paired=false", status)
	}
}

func TestConnectRejectsInvalidToken(t *testing.T) {
	srv := newTelegramTestServer(t, false)
	rec := do(t, srv, "PUT", "/api/settings/telegram", map[string]string{"token": "bad-token"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", rec.Code, rec.Body)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error: %v", err)
	}
	if body.Error.Message == "" {
		t.Errorf("expected a readable message")
	}
}

func TestConnectNeverEchoesToken(t *testing.T) {
	srv := newTelegramTestServer(t, true)
	rec := do(t, srv, "PUT", "/api/settings/telegram", map[string]string{"token": "good-token"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "good-token") {
		t.Errorf("response echoed the token: %s", rec.Body.String())
	}

	rec = do(t, srv, "GET", "/api/settings/telegram", nil)
	var status struct {
		Connected bool   `json:"connected"`
		Username  string `json:"username"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if !status.Connected {
		t.Errorf("expected connected=true after a successful connect")
	}
	if status.Username != "testbot" {
		t.Errorf("username = %q, want %q", status.Username, "testbot")
	}
	if strings.Contains(rec.Body.String(), "good-token") {
		t.Errorf("status response echoed the token: %s", rec.Body.String())
	}
}

func TestPairGeneratesCodeVisibleOnStatus(t *testing.T) {
	srv := newTelegramTestServer(t, true)
	do(t, srv, "PUT", "/api/settings/telegram", map[string]string{"token": "good-token"})

	rec := do(t, srv, "POST", "/api/settings/telegram/pair", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("pair status = %d, want 200; body = %s", rec.Code, rec.Body)
	}

	var status struct {
		PairCode string `json:"pair_code"`
		Paired   bool   `json:"paired"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if status.PairCode == "" {
		t.Errorf("expected a pairing code to be present")
	}
	if status.Paired {
		t.Errorf("expected paired=false before any chat has sent the code")
	}
}

func TestPairWithoutTokenReturns400(t *testing.T) {
	srv := newTelegramTestServer(t, true)
	rec := do(t, srv, "POST", "/api/settings/telegram/pair", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDisconnectClearsSettingsButKeepsNuggets(t *testing.T) {
	srv := newTelegramTestServer(t, true)
	do(t, srv, "PUT", "/api/settings/telegram", map[string]string{"token": "good-token"})
	do(t, srv, "POST", "/api/ideas", idea.Draft{Title: ptr("unrelated nugget")})

	rec := do(t, srv, "DELETE", "/api/settings/telegram", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}

	rec = do(t, srv, "GET", "/api/settings/telegram", nil)
	var status struct {
		Connected bool `json:"connected"`
	}
	json.Unmarshal(rec.Body.Bytes(), &status)
	if status.Connected {
		t.Errorf("expected connected=false after disconnect")
	}

	rec = do(t, srv, "GET", "/api/ideas", nil)
	var ideas []idea.Idea
	json.Unmarshal(rec.Body.Bytes(), &ideas)
	if len(ideas) != 1 {
		t.Errorf("ideas = %d, want 1 — disconnect must not delete imported nuggets", len(ideas))
	}
}

func TestSyncWakesLoopAndReturns202Immediately(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "POST", "/api/telegram/sync", nil)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Code)
	}
}
