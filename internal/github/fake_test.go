package github

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const testToken = "github_pat_test-secret-7f3e9a"

type fakeIssue struct {
	Repo   string
	Number int
	Title  string
	Body   string
	Labels []string
}

type recordedRequest struct {
	Method string
	Path   string
	Query  string
	Header http.Header
	Body   []byte
}

// fakeGitHub is just enough of GitHub's REST API: creating issues and
// listing them. It never talks to the real GitHub.
type fakeGitHub struct {
	mu       sync.Mutex
	token    string
	issues   []fakeIssue
	requests []recordedRequest
	// posts, when non-empty, answer the next POSTs in order instead of
	// creating an issue. A nil entry creates the issue as usual.
	posts []http.HandlerFunc
	// rejectLabels answers 422 to any POST carrying labels.
	rejectLabels bool
	// missingRepos answer 404.
	missingRepos map[string]bool
}

func newFakeGitHub(t *testing.T) (*fakeGitHub, *httptest.Server) {
	t.Helper()
	fake := &fakeGitHub{token: testToken, missingRepos: map[string]bool{}}
	srv := httptest.NewServer(http.HandlerFunc(fake.handle))
	t.Cleanup(srv.Close)
	return fake, srv
}

func writeGitHubError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"message": message})
}

func (f *fakeGitHub) handle(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	f.mu.Lock()
	f.requests = append(f.requests, recordedRequest{r.Method, r.URL.Path, r.URL.RawQuery, r.Header.Clone(), body})
	f.mu.Unlock()

	if r.Header.Get("Authorization") != "Bearer "+f.token {
		writeGitHubError(w, http.StatusUnauthorized, "Bad credentials")
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	if len(parts) != 4 || parts[0] != "repos" || parts[3] != "issues" {
		writeGitHubError(w, http.StatusNotFound, "Not Found")
		return
	}
	repo := parts[1] + "/" + parts[2]
	f.mu.Lock()
	missing := f.missingRepos[repo]
	f.mu.Unlock()
	if missing {
		writeGitHubError(w, http.StatusNotFound, "Not Found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		f.list(w, r, repo)
	case http.MethodPost:
		f.mu.Lock()
		var scripted http.HandlerFunc
		useScript := len(f.posts) > 0
		if useScript {
			scripted, f.posts = f.posts[0], f.posts[1:]
		}
		f.mu.Unlock()
		if scripted != nil {
			scripted(w, r)
			return
		}
		f.create(w, repo, body)
	default:
		writeGitHubError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (f *fakeGitHub) create(w http.ResponseWriter, repo string, body []byte) {
	var in NewIssue
	if err := json.Unmarshal(body, &in); err != nil {
		writeGitHubError(w, http.StatusBadRequest, "Problems parsing JSON")
		return
	}
	f.mu.Lock()
	if f.rejectLabels && len(in.Labels) > 0 {
		f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		w.Write([]byte(`{"message":"Validation Failed","errors":[{"resource":"Label","field":"name","code":"invalid"}]}`))
		return
	}
	n := len(f.issues) + 1
	f.issues = append(f.issues, fakeIssue{Repo: repo, Number: n, Title: in.Title, Body: in.Body, Labels: in.Labels})
	f.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"number": n, "html_url": fmt.Sprintf("https://github.com/%s/issues/%d", repo, n), "body": in.Body, "title": in.Title,
	})
}

func (f *fakeGitHub) list(w http.ResponseWriter, r *http.Request, repo string) {
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if perPage <= 0 {
		perPage = 30
	}
	if page <= 0 {
		page = 1
	}
	f.mu.Lock()
	var matching []map[string]any
	for i := len(f.issues) - 1; i >= 0; i-- {
		is := f.issues[i]
		if is.Repo == repo {
			matching = append(matching, map[string]any{
				"number": is.Number, "html_url": fmt.Sprintf("https://github.com/%s/issues/%d", repo, is.Number), "body": is.Body,
			})
		}
	}
	f.mu.Unlock()
	start := min((page-1)*perPage, len(matching))
	end := min(start+perPage, len(matching))
	out := matching[start:end]
	if out == nil {
		out = []map[string]any{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func (f *fakeGitHub) snapshot() ([]fakeIssue, []recordedRequest) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]fakeIssue(nil), f.issues...), append([]recordedRequest(nil), f.requests...)
}

func (f *fakeGitHub) countRequests(method string) int {
	_, reqs := f.snapshot()
	n := 0
	for _, r := range reqs {
		if r.Method == method {
			n++
		}
	}
	return n
}

func (f *fakeGitHub) script(handlers ...http.HandlerFunc) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.posts = append(f.posts, handlers...)
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
	db       *sql.DB
	settings *settings.Store
	ideas    *idea.Store
	outbox   *Outbox
	sender   *Sender
	fake     *fakeGitHub
	srv      *httptest.Server
	events   *recordingPublisher
}

func newTestEnv(t *testing.T, opts ...Option) *testEnv {
	t.Helper()
	fake, srv := newFakeGitHub(t)
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	settingsStore := settings.NewStore(database)
	outbox := NewOutbox(database, settingsStore)
	ideaStore := idea.NewStore(database, idea.WithTagsAdded(outbox.TagsAdded))
	pub := &recordingPublisher{}
	e := &testEnv{db: database, settings: settingsStore, ideas: ideaStore, outbox: outbox, fake: fake, srv: srv, events: pub}
	e.sender = e.newSender(opts...)
	return e
}

// newSender builds a Sender over the same database: what a restart does.
func (e *testEnv) newSender(opts ...Option) *Sender {
	base := []Option{
		WithBaseURL(e.srv.URL),
		WithHTTPClient(e.srv.Client()),
		WithBackoff(time.Millisecond, 10*time.Millisecond),
		WithEvents(e.events),
	}
	return NewSender(e.outbox, e.ideas, e.settings, append(base, opts...)...)
}

func (e *testEnv) setToken(t *testing.T, token string) {
	t.Helper()
	if err := e.settings.Set(context.Background(), KeyToken, token); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) createIdea(t *testing.T, title, notes string, tags ...string) *idea.Idea {
	t.Helper()
	created, err := e.ideas.Create(context.Background(), idea.Draft{Title: &title, Notes: &notes, Tags: &tags})
	if err != nil {
		t.Fatalf("creating idea: %v", err)
	}
	return created
}

func (e *testEnv) rows(t *testing.T, ideaID int64) []Issue {
	t.Helper()
	rows, err := e.outbox.ForIdea(context.Background(), ideaID)
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func (e *testEnv) onlyRow(t *testing.T, ideaID int64) Issue {
	t.Helper()
	rows := e.rows(t, ideaID)
	if len(rows) != 1 {
		t.Fatalf("nugget %d has %d feature requests, want 1: %+v", ideaID, len(rows), rows)
	}
	return rows[0]
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
