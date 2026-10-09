package jev

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const testKey = "ts_test-secret-4b81e2"

// sentRequest is one request the fake TypeSafe received, decoded.
type sentRequest struct {
	Path   string
	Header http.Header
	Body   systemOneRequest
	Raw    []byte
}

// fakeTypeSafe is just enough of TypeSafe's System One API: it answers each
// noul question with the probability set for its tag (0.1 when none is set).
// It never talks to the real TypeSafe.
type fakeTypeSafe struct {
	mu       sync.Mutex
	key      string
	answers  map[string]float64
	requests []sentRequest
	// script, when non-empty, answers the next requests in order instead of
	// the usual answer. A nil entry answers as usual.
	script []http.HandlerFunc
	// before, when set, runs before each request is answered: a hook for
	// changing the nugget while its check is in flight.
	before func()
}

func newFakeTypeSafe(t *testing.T) (*fakeTypeSafe, *httptest.Server) {
	t.Helper()
	fake := &fakeTypeSafe{key: testKey, answers: map[string]float64{}}
	srv := httptest.NewServer(http.HandlerFunc(fake.handle))
	t.Cleanup(srv.Close)
	return fake, srv
}

func writeTypeSafeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"message": message}})
}

func (f *fakeTypeSafe) handle(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(r.Body)
	var body systemOneRequest
	_ = json.Unmarshal(raw, &body)
	f.mu.Lock()
	f.requests = append(f.requests, sentRequest{r.URL.Path, r.Header.Clone(), body, raw})
	var scripted http.HandlerFunc
	if len(f.script) > 0 {
		scripted, f.script = f.script[0], f.script[1:]
	}
	before := f.before
	f.mu.Unlock()
	if before != nil {
		before()
	}
	if scripted != nil {
		scripted(w, r)
		return
	}

	if r.Method != http.MethodPost || r.URL.Path != "/v1/systemone" {
		writeTypeSafeError(w, http.StatusNotFound, "not found")
		return
	}
	if r.Header.Get("Authorization") != "Bearer "+f.key {
		writeTypeSafeError(w, http.StatusUnauthorized, "invalid API key")
		return
	}
	answers := map[string]any{}
	for id, q := range body.Questions {
		f.mu.Lock()
		p, ok := f.answers[q.Instructions.Tag]
		f.mu.Unlock()
		if !ok {
			p = 0.1
		}
		answers[id] = map[string]any{"type": "noul", "noul": p}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"model":   "jev-1.13.0",
		"answers": answers,
		"usage":   map[string]int{"input_tokens": 100, "output_tokens": 10},
	})
}

func (f *fakeTypeSafe) answer(tag string, p float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.answers[tag] = p
}

func (f *fakeTypeSafe) sent() []sentRequest {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]sentRequest(nil), f.requests...)
}

func (f *fakeTypeSafe) queue(handlers ...http.HandlerFunc) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.script = append(f.script, handlers...)
}

func (f *fakeTypeSafe) setBefore(fn func()) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.before = fn
}

// recordingPublisher remembers every event published.
type recordingPublisher struct {
	mu     sync.Mutex
	events []events.Event
}

func (p *recordingPublisher) Publish(e events.Event) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.events = append(p.events, e)
}

func (p *recordingPublisher) count(e events.Event) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := 0
	for _, got := range p.events {
		if got == e {
			n++
		}
	}
	return n
}

type testEnv struct {
	db        *sql.DB
	settings  *settings.Store
	ideas     *idea.Store
	queue     *Queue
	suggester *Suggester
	fake      *fakeTypeSafe
	srv       *httptest.Server
	events    *recordingPublisher
}

func newTestEnv(t *testing.T, opts ...Option) *testEnv {
	t.Helper()
	fake, srv := newFakeTypeSafe(t)
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	settingsStore := settings.NewStore(database)
	queue := NewQueue(database, settingsStore)
	ideaStore := idea.NewStore(database,
		idea.WithContentChanged(queue.ContentChanged),
		idea.WithTagsAdded(queue.TagsAdded),
		idea.WithTagsRemoved(queue.TagsRemoved),
	)
	e := &testEnv{db: database, settings: settingsStore, ideas: ideaStore, queue: queue, fake: fake, srv: srv, events: &recordingPublisher{}}
	base := []Option{
		WithBaseURL(srv.URL),
		WithHTTPClient(srv.Client()),
		WithBackoff(time.Millisecond, 10*time.Millisecond),
		WithEvents(e.events),
	}
	e.suggester = NewSuggester(queue, ideaStore, settingsStore, append(base, opts...)...)
	return e
}

func (e *testEnv) setKey(t *testing.T, key string) {
	t.Helper()
	if err := e.settings.Set(context.Background(), KeyAPIKey, key); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) create(t *testing.T, title, notes string, tags ...string) *idea.Idea {
	t.Helper()
	created, err := e.ideas.Create(context.Background(), idea.Draft{Title: &title, Notes: &notes, Tags: &tags})
	if err != nil {
		t.Fatalf("creating nugget: %v", err)
	}
	return created
}

func (e *testEnv) pending(t *testing.T) int {
	t.Helper()
	n, err := e.queue.Pending(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func (e *testEnv) pass(t *testing.T) error {
	t.Helper()
	return e.suggester.Pass(context.Background())
}

func (e *testEnv) suggestions(t *testing.T, id int64) []Suggestion {
	t.Helper()
	list, err := e.queue.Suggestions(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return list
}

// suggestedTags is suggestions reduced to their tags, in order.
func (e *testEnv) suggestedTags(t *testing.T, id int64) []string {
	t.Helper()
	tags := []string{}
	for _, s := range e.suggestions(t, id) {
		tags = append(tags, s.Tag)
	}
	return tags
}

func waitUntil(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}
