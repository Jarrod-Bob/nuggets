package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
	"github.com/Jarrod-Bob/nuggets/internal/spices"
)

const spicesTestToken = "spices-secret-token-4c3b2a"

// fakeSpicesAPI serves a fixed list of ideas and answers 409 for a cursor
// past the latest rev, the two behaviours the settings flow depends on.
type fakeSpicesAPI struct {
	mu        sync.Mutex
	items     []map[string]any // each has "id" and "rev"
	itemCalls int
	sinces    []string
}

func newFakeSpicesAPI(t *testing.T) (*fakeSpicesAPI, *httptest.Server) {
	t.Helper()
	fake := &fakeSpicesAPI{}
	srv := httptest.NewServer(http.HandlerFunc(fake.handler))
	t.Cleanup(srv.Close)
	return fake, srv
}

func (f *fakeSpicesAPI) calls() (int, []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.itemCalls, append([]string(nil), f.sinces...)
}

func (f *fakeSpicesAPI) setItems(items ...map[string]any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.items = items
}

func (f *fakeSpicesAPI) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r.Header.Get("Authorization") != "Bearer "+spicesTestToken {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.URL.Path != "/api/v1/items" {
		writeJSON(w, http.StatusOK, map[string]any{})
		return
	}
	f.itemCalls++
	f.sinces = append(f.sinces, r.URL.Query().Get("since"))
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	var latest int64
	out := []map[string]any{}
	for _, it := range f.items {
		rev := it["rev"].(int64)
		if rev > latest {
			latest = rev
		}
		if rev > since {
			out = append(out, it)
		}
	}
	if since > latest {
		writeError(w, http.StatusConflict, "cursor ahead")
		return
	}
	next := since
	if len(out) > 0 {
		next = out[len(out)-1]["rev"].(int64)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "next_cursor": next, "has_more": false})
}

func spicesIdea(id, rev int64, title string) map[string]any {
	return map[string]any{"id": id, "type": "idea", "rev": rev, "text": title, "tags": []string{},
		"fields": map[string]string{"title": title, "description": ""}, "deleted_at": nil}
}

type spicesEnv struct {
	srv      http.Handler
	fake     *fakeSpicesAPI
	fakeURL  string
	settings *settings.Store
	ideas    *idea.Store
	syncer   *spices.Syncer
}

func newSpicesEnv(t *testing.T) *spicesEnv {
	t.Helper()
	fake, fakeSrv := newFakeSpicesAPI(t)

	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	settingsStore := settings.NewStore(database)
	ideaStore := idea.NewStore(database)
	syncer := spices.NewSyncer(ideaStore, settingsStore,
		spices.WithHTTPClient(fakeSrv.Client()),
		spices.WithBackoff(time.Millisecond, 10*time.Millisecond),
		spices.WithInterval(time.Hour),
	)
	return &spicesEnv{
		srv:      NewServer(ideaStore, settingsStore, nil, syncer, nil),
		fake:     fake,
		fakeURL:  fakeSrv.URL,
		settings: settingsStore,
		ideas:    ideaStore,
		syncer:   syncer,
	}
}

func (e *spicesEnv) runLoop(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.syncer.Loop(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
}

func decodeSpicesStatus(t *testing.T, rec *httptest.ResponseRecorder) spicesStatus {
	t.Helper()
	var status spicesStatus
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	return status
}

func waitUntil(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func TestSpicesStatusDefaults(t *testing.T) {
	env := newSpicesEnv(t)
	rec := do(t, env.srv, "GET", "/api/settings/spices", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	status := decodeSpicesStatus(t, rec)
	if status.Connected || status.URL != spices.DefaultBaseURL || status.IntervalSeconds != 60 || status.NeedsResync {
		t.Errorf("status = %+v, want disconnected defaults", status)
	}
}

func TestSpicesConnectValidates(t *testing.T) {
	env := newSpicesEnv(t)
	cases := []struct {
		name string
		body map[string]any
		want string
	}{
		{"no token", map[string]any{"url": env.fakeURL}, "token is required"},
		{"bad scheme", map[string]any{"url": "ftp://x", "token": "t"}, "http or https"},
		{"credentials in url", map[string]any{"url": "http://user:pw@host", "token": "t"}, "token field"},
		{"interval too short", map[string]any{"token": "t", "interval_seconds": 1}, "between"},
	}
	for _, tc := range cases {
		rec := do(t, env.srv, "PUT", "/api/settings/spices", tc.body)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), tc.want) {
			t.Errorf("%s: %d %s, want 400 mentioning %q", tc.name, rec.Code, rec.Body, tc.want)
		}
	}
}

func TestSpicesTokenIsWriteOnly(t *testing.T) {
	env := newSpicesEnv(t)
	rec := do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL + "/", "token": spicesTestToken, "interval_seconds": 30})
	if rec.Code != http.StatusOK {
		t.Fatalf("connect = %d %s", rec.Code, rec.Body)
	}
	status := decodeSpicesStatus(t, rec)
	if !status.Connected || status.URL != env.fakeURL || status.IntervalSeconds != 30 {
		t.Errorf("status = %+v, want connected to the fake every 30s", status)
	}
	if strings.Contains(rec.Body.String(), spicesTestToken) {
		t.Errorf("connect echoed the token: %s", rec.Body)
	}
	if rec := do(t, env.srv, "GET", "/api/settings/spices", nil); strings.Contains(rec.Body.String(), spicesTestToken) {
		t.Errorf("status echoed the token: %s", rec.Body)
	}

	// Changing only the interval keeps the stored token.
	rec = do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"interval_seconds": 120})
	if rec.Code != http.StatusOK || !decodeSpicesStatus(t, rec).Connected {
		t.Fatalf("interval-only update = %d %s", rec.Code, rec.Body)
	}
	if token, _, _ := env.settings.Get(context.Background(), spices.KeyToken); token != spicesTestToken {
		t.Errorf("token changed on an interval-only update")
	}
}

func TestSpicesSyncPullsAndReportsLastSync(t *testing.T) {
	env := newSpicesEnv(t)
	env.fake.setItems(spicesIdea(1, 1, "From spices"))
	env.runLoop(t)
	do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL, "token": spicesTestToken})

	waitUntil(t, "the pull", func() bool {
		return decodeSpicesStatus(t, do(t, env.srv, "GET", "/api/settings/spices", nil)).LastSyncAt != nil
	})
	rec := do(t, env.srv, "GET", "/api/ideas", nil)
	var ideas []idea.Idea
	json.Unmarshal(rec.Body.Bytes(), &ideas)
	if len(ideas) != 1 || ideas[0].Origin == nil || *ideas[0].Origin != "spices" {
		t.Fatalf("ideas = %s, want one with origin spices", rec.Body)
	}

	env.fake.setItems(spicesIdea(1, 1, "From spices"), spicesIdea(2, 2, "Second"))
	if rec := do(t, env.srv, "POST", "/api/spices/sync", nil); rec.Code != http.StatusAccepted {
		t.Fatalf("sync = %d, want 202", rec.Code)
	}
	waitUntil(t, "the second pull", func() bool {
		list, _ := env.ideas.List(context.Background(), idea.ListFilter{})
		return len(list) == 2
	})
}

func TestSpicesResetThenResyncFlow(t *testing.T) {
	env := newSpicesEnv(t)
	env.fake.setItems(spicesIdea(1, 1, "Old one"), spicesIdea(2, 2, "Old two"))
	env.runLoop(t)

	if rec := do(t, env.srv, "POST", "/api/spices/resync", nil); rec.Code != http.StatusBadRequest {
		t.Errorf("resync while disconnected = %d, want 400", rec.Code)
	}

	do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL, "token": spicesTestToken})
	waitUntil(t, "the first pull", func() bool {
		list, _ := env.ideas.List(context.Background(), idea.ListFilter{})
		return len(list) == 2
	})

	// spices is recreated: its latest rev falls below nuggets' cursor.
	env.fake.setItems(spicesIdea(1, 1, "Brand new"))
	do(t, env.srv, "POST", "/api/spices/sync", nil)
	var status spicesStatus
	waitUntil(t, "the 409 to show", func() bool {
		status = decodeSpicesStatus(t, do(t, env.srv, "GET", "/api/settings/spices", nil))
		return status.NeedsResync
	})
	if status.LastError != spices.ResetMessage {
		t.Errorf("last_error = %q, want %q", status.LastError, spices.ResetMessage)
	}
	if list, _ := env.ideas.List(context.Background(), idea.ListFilter{}); len(list) != 2 {
		t.Fatalf("ideas = %d after 409, want both kept", len(list))
	}

	rec := do(t, env.srv, "POST", "/api/spices/resync", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("resync = %d %s", rec.Code, rec.Body)
	}
	status = decodeSpicesStatus(t, rec)
	if status.Detached == nil || *status.Detached != 2 || status.NeedsResync {
		t.Errorf("resync status = %+v, want 2 detached and the 409 cleared", status)
	}
	waitUntil(t, "the re-pull", func() bool {
		list, _ := env.ideas.List(context.Background(), idea.ListFilter{})
		return len(list) == 3
	})
}

func TestSpicesDisconnectKeepsNuggetsAndCursor(t *testing.T) {
	env := newSpicesEnv(t)
	env.fake.setItems(spicesIdea(1, 7, "Keeper"))
	do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL, "token": spicesTestToken})
	if err := env.syncer.Drain(context.Background()); err != nil {
		t.Fatal(err)
	}

	if rec := do(t, env.srv, "DELETE", "/api/settings/spices", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("disconnect = %d", rec.Code)
	}
	status := decodeSpicesStatus(t, do(t, env.srv, "GET", "/api/settings/spices", nil))
	if status.Connected || status.LastSyncAt != nil || status.URL != env.fakeURL {
		t.Errorf("status = %+v, want disconnected, address kept, no sync time", status)
	}
	if list, _ := env.ideas.List(context.Background(), idea.ListFilter{}); len(list) != 1 {
		t.Errorf("ideas = %d, want the imported nugget kept", len(list))
	}
	if cursor, _, _ := env.settings.Get(context.Background(), spices.KeyCursor); cursor != "7" {
		t.Errorf("cursor = %q, want 7 kept for reconnecting", cursor)
	}
}

func TestSpicesAddressChangeAfterPullNeedsResync(t *testing.T) {
	env := newSpicesEnv(t)
	ctx := context.Background()
	env.fake.setItems(spicesIdea(1, 1, "Old one"), spicesIdea(2, 2, "Old two"))
	do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL, "token": spicesTestToken})
	if err := env.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}

	// A different spices, whose ids 1 and 2 are unrelated ideas at newer revs.
	other, otherSrv := newFakeSpicesAPI(t)
	other.setItems(spicesIdea(1, 5, "Unrelated one"), spicesIdea(2, 6, "Unrelated two"), spicesIdea(3, 7, "Unrelated three"))
	rec := do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": otherSrv.URL})
	if rec.Code != http.StatusOK {
		t.Fatalf("change address = %d %s", rec.Code, rec.Body)
	}
	status := decodeSpicesStatus(t, rec)
	if !status.NeedsResync || status.LastError != spices.AddressChangedMessage || status.URL != otherSrv.URL {
		t.Errorf("status = %+v, want the new address waiting for Re-sync", status)
	}
	if cursor, _, _ := env.settings.Get(ctx, spices.KeyCursor); cursor != "2" {
		t.Errorf("cursor = %q, want 2 kept until Re-sync", cursor)
	}

	if err := env.syncer.Drain(ctx); !errors.Is(err, spices.ErrNeedsResync) {
		t.Fatalf("Drain = %v, want ErrNeedsResync", err)
	}
	if calls, _ := other.calls(); calls != 0 {
		t.Errorf("new spices called %d times before Re-sync, want 0", calls)
	}
	list, _ := env.ideas.List(ctx, idea.ListFilter{})
	for _, i := range list {
		if !strings.HasPrefix(i.Title, "Old") {
			t.Errorf("nugget %q was overwritten before Re-sync", i.Title)
		}
	}

	env.runLoop(t)
	rec = do(t, env.srv, "POST", "/api/spices/resync", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("resync = %d %s", rec.Code, rec.Body)
	}
	status = decodeSpicesStatus(t, rec)
	if status.Detached == nil || *status.Detached != 2 || status.NeedsResync || status.LastError != "" {
		t.Errorf("resync status = %+v, want 2 detached and the flag cleared", status)
	}
	waitUntil(t, "the pull from the new address", func() bool {
		list, _ := env.ideas.List(ctx, idea.ListFilter{})
		return len(list) == 5
	})
	if _, sinces := other.calls(); len(sinces) == 0 || sinces[0] != "0" {
		t.Errorf("new spices sinces = %v, want the pull to start from 0", sinces)
	}
	titles := map[string]bool{}
	list, _ = env.ideas.List(ctx, idea.ListFilter{})
	for _, i := range list {
		titles[i.Title] = true
	}
	for _, want := range []string{"Old one", "Old two", "Unrelated one", "Unrelated two", "Unrelated three"} {
		if !titles[want] {
			t.Errorf("missing nugget %q; have %v", want, titles)
		}
	}
}

func TestSpicesSameAddressOrFirstConnectKeepsSyncing(t *testing.T) {
	env := newSpicesEnv(t)
	ctx := context.Background()

	// First connect replaces the default address with nothing pulled yet.
	rec := do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL, "token": spicesTestToken})
	if status := decodeSpicesStatus(t, rec); status.NeedsResync || status.LastError != "" {
		t.Errorf("first connect status = %+v, want no Re-sync", status)
	}
	// Moving again before anything was pulled is harmless too.
	rec = do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": "http://127.0.0.1:1"})
	if status := decodeSpicesStatus(t, rec); status.NeedsResync {
		t.Errorf("address change before any pull = %+v, want no Re-sync", status)
	}
	do(t, env.srv, "PUT", "/api/settings/spices", map[string]any{"url": env.fakeURL})

	env.fake.setItems(spicesIdea(1, 1, "Kept"))
	if err := env.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	for _, body := range []map[string]any{
		{"url": env.fakeURL + "/"},
		{"url": "  " + env.fakeURL + "  "},
		{"interval_seconds": 30},
	} {
		rec := do(t, env.srv, "PUT", "/api/settings/spices", body)
		if status := decodeSpicesStatus(t, rec); rec.Code != http.StatusOK || status.NeedsResync || status.LastError != "" {
			t.Errorf("save %v = %d %+v, want no Re-sync", body, rec.Code, status)
		}
	}
	if err := env.syncer.Drain(ctx); err != nil {
		t.Errorf("Drain after same-address saves = %v, want nil", err)
	}
}
