package spices

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
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
)

const testToken = "sekret-spices-token-9f8e7d"

// fakeItem is one item in the fake spices database.
type fakeItem struct {
	ID        int64
	Rev       int64
	Text      string
	Tags      []string
	Fields    map[string]string // nil encodes as {}
	DeletedAt *time.Time
}

// fakeSpices is an in-memory spices pull API (spices design §7): items after
// a cursor in rev order, paged by limit, 409 for a cursor past the latest rev,
// bearer auth, and cursor acknowledgements.
type fakeSpices struct {
	mu         sync.Mutex
	token      string
	items      []fakeItem
	failStatus int // nonzero: every items request fails with this
	ackStatus  int // nonzero: every ack fails with this
	// block, if set, is received from before an items request is answered.
	block chan struct{}

	itemCalls int
	sinces    []string
	types     []string
	auths     []string
	acks      []int64
	ackCalls  int
}

func (f *fakeSpices) server(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if f.block != nil && r.URL.Path == "/api/v1/items" {
			<-f.block
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		f.auths = append(f.auths, r.Header.Get("Authorization"))
		if r.Header.Get("Authorization") != "Bearer "+f.token {
			writeFakeError(w, http.StatusUnauthorized, "bad token")
			return
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/items":
			f.itemCalls++
			if f.failStatus != 0 {
				writeFakeError(w, f.failStatus, "boom")
				return
			}
			q := r.URL.Query()
			f.sinces = append(f.sinces, q.Get("since"))
			f.types = append(f.types, strings.Join(q["type"], ","))
			since, _ := strconv.ParseInt(q.Get("since"), 10, 64)
			limit, _ := strconv.Atoi(q.Get("limit"))
			if limit <= 0 {
				limit = 100
			}
			var latest int64
			for _, it := range f.items {
				if it.Rev > latest {
					latest = it.Rev
				}
			}
			if since > latest {
				writeFakeError(w, http.StatusConflict, "cursor is ahead of this database")
				return
			}
			out := []map[string]any{}
			next := since
			hasMore := false
			for _, it := range f.items {
				if it.Rev <= since {
					continue
				}
				if len(out) == limit {
					hasMore = true
					break
				}
				fields := map[string]string{}
				for k, v := range it.Fields {
					fields[k] = v
				}
				tags := it.Tags
				if tags == nil {
					tags = []string{}
				}
				out = append(out, map[string]any{
					"id": it.ID, "type": "idea", "rev": it.Rev, "text": it.Text, "url": nil,
					"tags": tags, "fields": fields, "meta": map[string]any{}, "source": "telegram",
					"deleted_at": it.DeletedAt,
				})
				next = it.Rev
			}
			json.NewEncoder(w).Encode(map[string]any{"items": out, "next_cursor": next, "has_more": hasMore})
		case r.Method == http.MethodPut && r.URL.Path == "/api/v1/consumers/nuggets/cursor":
			f.ackCalls++
			if f.ackStatus != 0 {
				writeFakeError(w, f.ackStatus, "ack failed")
				return
			}
			var body struct {
				Cursor int64 `json:"cursor"`
			}
			json.NewDecoder(r.Body).Decode(&body)
			f.acks = append(f.acks, body.Cursor)
			json.NewEncoder(w).Encode(map[string]any{"name": "nuggets", "cursor": body.Cursor})
		default:
			writeFakeError(w, http.StatusNotFound, "not found")
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func writeFakeError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"message": message}})
}

func (f *fakeSpices) snapshot() (itemCalls, ackCalls int, acks []int64, sinces []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.itemCalls, f.ackCalls, append([]int64(nil), f.acks...), append([]string(nil), f.sinces...)
}

func (f *fakeSpices) set(mutate func(f *fakeSpices)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	mutate(f)
}

func ideaItem(id, rev int64, title, description string, tags ...string) fakeItem {
	text := title
	if description != "" {
		text += "\n" + description
	}
	return fakeItem{ID: id, Rev: rev, Text: text, Tags: tags,
		Fields: map[string]string{"title": title, "description": description}}
}

type harness struct {
	fake     *fakeSpices
	syncer   *Syncer
	settings *settings.Store
	ideas    *idea.Store
}

func newHarness(t *testing.T, fake *fakeSpices, opts ...Option) *harness {
	t.Helper()
	if fake.token == "" {
		fake.token = testToken
	}
	srv := fake.server(t)

	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	settingsStore := settings.NewStore(database)
	ideaStore := idea.NewStore(database)
	ctx := context.Background()
	if err := settingsStore.Set(ctx, KeyURL, srv.URL); err != nil {
		t.Fatal(err)
	}
	syncer := NewSyncer(ideaStore, settingsStore, append([]Option{
		WithHTTPClient(srv.Client()),
		WithBackoff(time.Millisecond, 20*time.Millisecond),
		WithRequestTimeout(2 * time.Second),
		WithInterval(time.Hour),
	}, opts...)...)
	return &harness{fake: fake, syncer: syncer, settings: settingsStore, ideas: ideaStore}
}

func (h *harness) connect(t *testing.T, token string) {
	t.Helper()
	if err := h.settings.Set(context.Background(), KeyToken, token); err != nil {
		t.Fatal(err)
	}
}

func (h *harness) setting(t *testing.T, key string) string {
	t.Helper()
	v, _, err := h.settings.Get(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func (h *harness) list(t *testing.T, archived bool) []idea.Idea {
	t.Helper()
	ideas, err := h.ideas.List(context.Background(), idea.ListFilter{Archived: archived})
	if err != nil {
		t.Fatal(err)
	}
	return ideas
}

func byTitle(ideas []idea.Idea) map[string]idea.Idea {
	out := map[string]idea.Idea{}
	for _, i := range ideas {
		out[i.Title] = i
	}
	return out
}

// captureLog redirects the standard logger for the test.
func captureLog(t *testing.T) *syncBuffer {
	t.Helper()
	buf := &syncBuffer{}
	prev := log.Writer()
	log.SetOutput(buf)
	t.Cleanup(func() { log.SetOutput(prev) })
	return buf
}

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func runLoop(t *testing.T, s *Syncer) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Loop(ctx); close(done) }()
	t.Cleanup(func() {
		cancel()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Error("Loop did not stop on cancel")
		}
	})
}

func TestDrainWithNoTokenIsIdle(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	if err := h.syncer.Drain(context.Background()); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Drain = %v, want ErrNotConfigured", err)
	}
	if calls, _, _, _ := h.fake.snapshot(); calls != 0 {
		t.Errorf("items calls = %d, want 0", calls)
	}
}

func TestDrainPagesThroughEverythingAndStoresCursor(t *testing.T) {
	fake := &fakeSpices{}
	for i := int64(1); i <= 5; i++ {
		fake.items = append(fake.items, ideaItem(i, i*10, "Idea "+strconv.FormatInt(i, 10), ""))
	}
	h := newHarness(t, fake, WithPageLimit(2))
	h.connect(t, testToken)

	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	if got := len(h.list(t, false)); got != 5 {
		t.Fatalf("ideas = %d, want 5", got)
	}
	calls, _, acks, sinces := fake.snapshot()
	if calls != 3 {
		t.Errorf("items calls = %d, want 3 pages of 2,2,1", calls)
	}
	if strings.Join(sinces, ",") != "0,20,40" {
		t.Errorf("sinces = %v, want 0,20,40", sinces)
	}
	if fake.types[0] != "idea" {
		t.Errorf("type filter = %q, want idea", fake.types[0])
	}
	if got := h.setting(t, KeyCursor); got != "50" {
		t.Errorf("cursor = %q, want 50", got)
	}
	if len(acks) != 1 || acks[0] != 50 {
		t.Errorf("acks = %v, want [50]", acks)
	}
	if h.setting(t, KeyLastSync) == "" {
		t.Error("last sync time not recorded")
	}
	if fake.auths[0] != "Bearer "+testToken {
		t.Errorf("Authorization = %q, want the bearer token", fake.auths[0])
	}
}

func TestDrainResumesFromStoredCursor(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "First", "")}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	ctx := context.Background()
	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	fake.set(func(f *fakeSpices) { f.items = append(f.items, ideaItem(2, 2, "Second", "")) })

	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	_, _, acks, sinces := fake.snapshot()
	if sinces[len(sinces)-1] != "1" {
		t.Errorf("second pull since = %s, want 1", sinces[len(sinces)-1])
	}
	if got := len(h.list(t, false)); got != 2 {
		t.Errorf("ideas = %d, want 2", got)
	}
	if len(acks) != 2 || acks[1] != 2 {
		t.Errorf("acks = %v, want [1 2]", acks)
	}
}

func TestDrainRePullIsIdempotent(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "One", "", "a"), ideaItem(2, 2, "Two", "")}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	ctx := context.Background()
	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	before := byTitle(h.list(t, false))

	// Replay the whole feed, as a lost cursor would.
	if err := h.settings.Set(ctx, KeyCursor, "0"); err != nil {
		t.Fatal(err)
	}
	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	after := byTitle(h.list(t, false))
	if len(after) != 2 {
		t.Fatalf("ideas = %d, want 2 — a re-pull must not duplicate", len(after))
	}
	for title, b := range before {
		if a := after[title]; a.ID != b.ID || !a.UpdatedAt.Equal(b.UpdatedAt) {
			t.Errorf("%q changed on re-pull: %+v -> %+v", title, b, a)
		}
	}
}

func TestDrainMapsFieldsAndFallsBackToText(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{
		{ID: 1, Rev: 1, Text: "Price tracker | pings me when #lego sets drop", Tags: []string{"lego"},
			Fields: map[string]string{"title": "Price tracker", "description": "pings me when #lego sets drop"}},
		// Saved before spices had fields: fields is {}.
		{ID: 2, Rev: 2, Text: "\nRaw title\n\n  indented note\nsecond line\n", Tags: []string{"old"}},
		// Nothing usable at all: skipped, but the cursor still moves past it.
		{ID: 3, Rev: 3, Text: "   "},
	}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatal(err)
	}

	got := byTitle(h.list(t, false))
	if len(got) != 2 {
		t.Fatalf("ideas = %v, want 2", got)
	}
	tracker := got["Price tracker"]
	if tracker.Notes != "pings me when #lego sets drop" || len(tracker.Tags) != 1 || tracker.Tags[0] != "lego" {
		t.Errorf("fields mapping = %q %v", tracker.Notes, tracker.Tags)
	}
	if tracker.Source == nil || *tracker.Source != idea.SourceSpices || *tracker.SourceRef != "1" {
		t.Errorf("origin = %v/%v, want spices/1", tracker.Source, tracker.SourceRef)
	}
	raw, ok := got["Raw title"]
	if !ok {
		t.Fatalf("fallback title missing; got %v", got)
	}
	if raw.Notes != "  indented note\nsecond line" {
		t.Errorf("fallback notes = %q", raw.Notes)
	}
	if h.setting(t, KeyCursor) != "3" {
		t.Errorf("cursor = %q, want 3", h.setting(t, KeyCursor))
	}
}

func TestDrainTombstoneArchivesTheNugget(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "Short-lived", "")}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	ctx := context.Background()
	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	deleted := time.Now().UTC().Truncate(time.Second)
	fake.set(func(f *fakeSpices) {
		f.items = []fakeItem{{ID: 1, Rev: 2, Text: "Short-lived", DeletedAt: &deleted}}
	})
	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	if n := len(h.list(t, false)); n != 0 {
		t.Errorf("active ideas = %d, want 0", n)
	}
	trash := h.list(t, true)
	if len(trash) != 1 || trash[0].Title != "Short-lived" {
		t.Errorf("trash = %+v, want the nugget archived, not deleted", trash)
	}
}

func TestLoopPullsOnStartupAndOnInterval(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "At startup", "")}}
	h := newHarness(t, fake, WithInterval(10*time.Millisecond))
	h.connect(t, testToken)
	runLoop(t, h.syncer)

	waitFor(t, "the startup pull", func() bool { return len(h.list(t, false)) == 1 })
	waitFor(t, "a few interval pulls", func() bool { calls, _, _, _ := fake.snapshot(); return calls >= 3 })
}

func TestLoopSyncTriggersImmediatePull(t *testing.T) {
	fake := &fakeSpices{}
	h := newHarness(t, fake) // hour-long interval: only Sync can explain a second pull
	h.connect(t, testToken)
	runLoop(t, h.syncer)
	waitFor(t, "the startup pull", func() bool { calls, _, _, _ := fake.snapshot(); return calls == 1 })

	fake.set(func(f *fakeSpices) { f.items = []fakeItem{ideaItem(1, 1, "Synced", "")} })
	h.syncer.Sync()
	waitFor(t, "the synced nugget", func() bool { return len(h.list(t, false)) == 1 })
}

func TestLoopParksOn401UntilSync(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "Behind auth", "")}}
	h := newHarness(t, fake)
	h.connect(t, "wrong-token")
	runLoop(t, h.syncer)

	waitFor(t, "the 401 to be recorded", func() bool { return h.setting(t, KeyLastError) != "" })
	if !strings.Contains(h.setting(t, KeyLastError), "rejected the API token") {
		t.Errorf("last error = %q", h.setting(t, KeyLastError))
	}
	time.Sleep(50 * time.Millisecond) // many backoff periods: a parked loop makes no calls
	var requests int
	fake.set(func(f *fakeSpices) { requests = len(f.auths) })
	if requests != 1 {
		t.Fatalf("requests = %d while parked, want 1", requests)
	}

	h.connect(t, testToken)
	h.syncer.Sync()
	waitFor(t, "the pull after reconnecting", func() bool { return len(h.list(t, false)) == 1 })
	waitFor(t, "the error to clear", func() bool { return h.setting(t, KeyLastError) == "" })
}

func TestLoopBacksOffOnServerErrorAndRecovers(t *testing.T) {
	fake := &fakeSpices{failStatus: http.StatusServiceUnavailable, items: []fakeItem{ideaItem(1, 1, "Eventually", "")}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	runLoop(t, h.syncer)

	waitFor(t, "retries", func() bool { calls, _, _, _ := fake.snapshot(); return calls >= 3 })
	if msg := h.setting(t, KeyLastError); !strings.Contains(msg, "503") {
		t.Errorf("last error = %q, want the 503 surfaced", msg)
	}
	fake.set(func(f *fakeSpices) { f.failStatus = 0 })
	waitFor(t, "recovery", func() bool { return len(h.list(t, false)) == 1 })
	waitFor(t, "the error to clear", func() bool { return h.setting(t, KeyLastError) == "" })
	if h.setting(t, KeyLastSync) == "" {
		t.Error("last sync not recorded after recovery")
	}
}

// resetFakeSpices pulls three items, then replaces the fake's database with a
// fresh one whose latest rev is below nuggets' cursor, as a recreated or
// restored spices would be.
func resetFakeSpices(t *testing.T, h *harness) {
	t.Helper()
	h.fake.set(func(f *fakeSpices) {
		f.items = []fakeItem{ideaItem(1, 1, "Alpha", ""), ideaItem(2, 2, "Beta", ""), ideaItem(3, 3, "Gamma", "")}
	})
	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatal(err)
	}
	h.fake.set(func(f *fakeSpices) {
		// Same ids, different ideas: the id-reuse hazard.
		f.items = []fakeItem{ideaItem(1, 1, "New one", ""), ideaItem(2, 2, "New two", "")}
	})
}

func TestDrain409StopsWithoutTouchingNuggets(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	h.connect(t, testToken)
	resetFakeSpices(t, h)
	ctx := context.Background()
	before := byTitle(h.list(t, false))

	if err := h.syncer.Drain(ctx); !errors.Is(err, ErrNeedsResync) {
		t.Fatalf("Drain = %v, want ErrNeedsResync", err)
	}
	after := byTitle(h.list(t, false))
	if len(after) != 3 {
		t.Fatalf("ideas = %d, want all 3 kept", len(after))
	}
	for title, b := range before {
		if a := after[title]; a.ID != b.ID || !a.UpdatedAt.Equal(b.UpdatedAt) || *a.Source != idea.SourceSpices {
			t.Errorf("%q changed on 409", title)
		}
	}
	if h.setting(t, KeyLastError) != ResetMessage || h.setting(t, KeyNeedsResync) != "1" {
		t.Errorf("status = %q / %q, want the reset message and needs-resync", h.setting(t, KeyLastError), h.setting(t, KeyNeedsResync))
	}
	if h.setting(t, KeyCursor) != "3" {
		t.Errorf("cursor = %q, want it left at 3", h.setting(t, KeyCursor))
	}

	// Even once spices has grown past the old cursor — where a plain retry
	// would silently resume and upsert reused ids over the old nuggets —
	// nothing is pulled until Re-sync.
	h.fake.set(func(f *fakeSpices) {
		f.items = append(f.items, ideaItem(3, 3, "New three", ""), ideaItem(4, 4, "New four", ""))
	})
	callsBefore, _, _, _ := h.fake.snapshot()
	if err := h.syncer.Drain(ctx); !errors.Is(err, ErrNeedsResync) {
		t.Fatalf("Drain after 409 = %v, want ErrNeedsResync", err)
	}
	if calls, _, _, _ := h.fake.snapshot(); calls != callsBefore {
		t.Errorf("spices was called while waiting for Re-sync")
	}
	if got := byTitle(h.list(t, false)); got["Gamma"].ID != before["Gamma"].ID {
		t.Errorf("Gamma was overwritten: %+v", got)
	}
}

func TestLoopParksOn409AndSyncDoesNotResume(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	h.connect(t, testToken)
	resetFakeSpices(t, h)
	runLoop(t, h.syncer)

	waitFor(t, "the 409", func() bool { return h.setting(t, KeyNeedsResync) == "1" })
	calls, _, _, _ := h.fake.snapshot()
	h.syncer.Sync()
	time.Sleep(30 * time.Millisecond)
	if again, _, _, _ := h.fake.snapshot(); again != calls {
		t.Errorf("Sync now after a 409 called spices %d more times, want 0", again-calls)
	}
	if h.setting(t, KeyLastError) != ResetMessage {
		t.Errorf("last error = %q, want %q", h.setting(t, KeyLastError), ResetMessage)
	}
}

func TestResyncDetachesKeepsEditsAndPullsAgain(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	h.connect(t, testToken)
	resetFakeSpices(t, h)
	ctx := context.Background()
	if err := h.syncer.Drain(ctx); !errors.Is(err, ErrNeedsResync) {
		t.Fatalf("Drain = %v, want ErrNeedsResync", err)
	}

	// The captain edits one of the old nuggets before pressing Re-sync.
	alpha := byTitle(h.list(t, false))["Alpha"]
	title, notes, status := "Alpha, reworked", "my own notes", idea.StatusExploring
	if _, err := h.ideas.Update(ctx, alpha.ID, idea.Draft{Title: &title, Notes: &notes, Status: &status}); err != nil {
		t.Fatal(err)
	}

	runLoop(t, h.syncer)
	moved, err := h.syncer.Resync(ctx)
	if err != nil || moved != 3 {
		t.Fatalf("Resync = %d, %v; want 3 detached", moved, err)
	}
	waitFor(t, "the re-pull", func() bool { return len(h.list(t, false)) == 5 })

	got := byTitle(h.list(t, false))
	edited, ok := got["Alpha, reworked"]
	if !ok || edited.ID != alpha.ID || edited.Notes != "my own notes" || edited.Status != idea.StatusExploring {
		t.Fatalf("edited nugget = %+v, want the edits kept", edited)
	}
	if *edited.Source != idea.SourceSpicesDetached || edited.SourceRef != nil {
		t.Errorf("edited nugget source = %v/%v, want spices-detached/nil", *edited.Source, edited.SourceRef)
	}
	for _, name := range []string{"New one", "New two"} {
		n, ok := got[name]
		if !ok || *n.Source != idea.SourceSpices {
			t.Errorf("%q missing or not a live spices nugget: %+v", name, n)
		}
	}
	if h.setting(t, KeyNeedsResync) != "" {
		t.Error("needs-resync flag not cleared")
	}
	waitFor(t, "the cursor", func() bool { return h.setting(t, KeyCursor) == "2" })
	waitFor(t, "the error to clear", func() bool { return h.setting(t, KeyLastError) == "" })
}

func TestAckFailureIsBestEffort(t *testing.T) {
	logs := captureLog(t)
	fake := &fakeSpices{ackStatus: http.StatusInternalServerError, items: []fakeItem{ideaItem(1, 1, "Acked?", "")}}
	h := newHarness(t, fake, WithInterval(10*time.Millisecond))
	h.connect(t, testToken)
	ctx := context.Background()

	if err := h.syncer.Drain(ctx); err != nil {
		t.Fatalf("Drain with a failing ack = %v, want nil", err)
	}
	if len(h.list(t, false)) != 1 || h.setting(t, KeyCursor) != "1" {
		t.Fatal("a failed ack must not undo the pull or its cursor")
	}
	if h.setting(t, KeyLastError) != "" {
		t.Errorf("last error = %q, want none for a failed ack", h.setting(t, KeyLastError))
	}
	if !strings.Contains(logs.String(), "acknowledging cursor 1") {
		t.Errorf("failed ack not logged; log = %q", logs.String())
	}
	if _, acks, _, _ := fake.snapshot(); acks != 1 {
		t.Errorf("ack calls = %d, want exactly 1 per drain", acks)
	}

	// In the loop the ack is retried once per sync, never in a tight loop.
	runLoop(t, h.syncer)
	time.Sleep(60 * time.Millisecond)
	items, acks, _, _ := fake.snapshot()
	if acks > items {
		t.Errorf("ack calls = %d over %d syncs, want at most one per sync", acks, items)
	}

	// Once spices accepts it, the same cursor isn't acknowledged again.
	fake.set(func(f *fakeSpices) { f.ackStatus = 0 })
	waitFor(t, "a successful ack", func() bool { _, _, acked, _ := fake.snapshot(); return len(acked) == 1 })
	time.Sleep(40 * time.Millisecond)
	if _, _, acked, _ := fake.snapshot(); len(acked) != 1 {
		t.Errorf("acked %v, want the unchanged cursor acknowledged once", acked)
	}
}

func TestTokenNeverLoggedOrStoredInErrors(t *testing.T) {
	logs := captureLog(t)
	fake := &fakeSpices{failStatus: http.StatusBadGateway, ackStatus: http.StatusInternalServerError}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	ctx := context.Background()

	// A server error, then a failing ack, then a rejected token.
	runLoop(t, h.syncer)
	waitFor(t, "the 502", func() bool { return strings.Contains(h.setting(t, KeyLastError), "502") })
	fake.set(func(f *fakeSpices) { f.failStatus = 0; f.items = []fakeItem{ideaItem(1, 1, "x", "")} })
	waitFor(t, "the pull", func() bool { return len(h.list(t, false)) == 1 })
	fake.set(func(f *fakeSpices) { f.token = "rotated" })
	h.syncer.Sync()
	waitFor(t, "the 401", func() bool { return strings.Contains(h.setting(t, KeyLastError), "rejected") })

	// And a network failure, whose error embeds the request URL.
	if err := h.settings.Set(ctx, KeyURL, "http://127.0.0.1:1"); err != nil {
		t.Fatal(err)
	}
	h.syncer.Sync()
	waitFor(t, "the network error", func() bool { return strings.Contains(h.setting(t, KeyLastError), "Couldn't reach") })

	if strings.Contains(logs.String(), testToken) {
		t.Errorf("the token appeared in the log:\n%s", logs.String())
	}
	if !strings.Contains(logs.String(), "spices:") {
		t.Errorf("expected spices log lines, got %q", logs.String())
	}
}

func TestDisconnectDuringFetchDropsThePage(t *testing.T) {
	block := make(chan struct{})
	fake := &fakeSpices{block: block, items: []fakeItem{ideaItem(1, 1, "Late", "")}}
	h := newHarness(t, fake)
	h.connect(t, testToken)
	ctx := context.Background()

	done := make(chan error, 1)
	go func() { done <- h.syncer.Drain(ctx) }()
	time.Sleep(20 * time.Millisecond) // let the request reach the fake

	if err := h.syncer.Reset(func() error { return h.settings.Delete(ctx, KeyToken) }); err != nil {
		t.Fatal(err)
	}
	close(block)
	if err := <-done; !errors.Is(err, errSuperseded) {
		t.Fatalf("Drain = %v, want errSuperseded", err)
	}
	if n := len(h.list(t, false)); n != 0 {
		t.Errorf("ideas = %d, want 0 — a page fetched before disconnect must not be saved", n)
	}
	if h.setting(t, KeyCursor) != "" {
		t.Errorf("cursor = %q, want none", h.setting(t, KeyCursor))
	}
}

func TestNonNetworkFailureIsNotReportedAsUnreachable(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	h.connect(t, testToken)
	garbled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not json"))
	}))
	t.Cleanup(garbled.Close)
	if err := h.settings.Set(context.Background(), KeyURL, garbled.URL); err != nil {
		t.Fatal(err)
	}
	runLoop(t, h.syncer)
	waitFor(t, "the decode error", func() bool { return h.setting(t, KeyLastError) != "" })
	if msg := h.setting(t, KeyLastError); !strings.HasPrefix(msg, "Syncing with spices failed: ") {
		t.Errorf("last error = %q, want it worded as a sync failure, not unreachable", msg)
	}
}

func TestParkedResyncKeepsTheStoredReason(t *testing.T) {
	h := newHarness(t, &fakeSpices{})
	h.connect(t, testToken)
	ctx := context.Background()
	if err := h.settings.Set(ctx, KeyNeedsResync, "1"); err != nil {
		t.Fatal(err)
	}
	if err := h.settings.Set(ctx, KeyLastError, AddressChangedMessage); err != nil {
		t.Fatal(err)
	}
	err := h.syncer.Drain(ctx)
	reason, park := parkReason(err)
	if !park {
		t.Fatalf("Drain = %v, want a parking error", err)
	}
	h.syncer.recordError(ctx, reason)
	if msg := h.setting(t, KeyLastError); msg != AddressChangedMessage {
		t.Errorf("last error = %q, want %q kept", msg, AddressChangedMessage)
	}
}
