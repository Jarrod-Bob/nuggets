package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/github"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/jev"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const jevTestKey = "ts_http-secret-0c5d17"

// fakeJev answers every noul question with 0.9, and records which tags it
// was asked about. It never talks to the real TypeSafe.
type fakeJev struct {
	mu    sync.Mutex
	asked []string
}

func (f *fakeJev) handle(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Questions map[string]struct {
			Instructions struct {
				Tag string `json:"tag"`
			} `json:"instructions"`
		} `json:"questions"`
	}
	raw, _ := io.ReadAll(r.Body)
	json.Unmarshal(raw, &body)
	answers := map[string]any{}
	f.mu.Lock()
	for id, q := range body.Questions {
		f.asked = append(f.asked, q.Instructions.Tag)
		answers[id] = map[string]any{"type": "noul", "noul": 0.9}
	}
	f.mu.Unlock()
	json.NewEncoder(w).Encode(map[string]any{"model": "jev-1", "answers": answers})
}

func (f *fakeJev) askedTags() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.asked...)
}

type jevEnv struct {
	srv       http.Handler
	settings  *settings.Store
	suggester *jev.Suggester
	fake      *fakeJev
	bodies    []string
}

func newJevEnv(t *testing.T) *jevEnv {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	fake := &fakeJev{}
	fakeSrv := httptest.NewServer(http.HandlerFunc(fake.handle))
	t.Cleanup(fakeSrv.Close)

	settingsStore := settings.NewStore(database)
	outbox := github.NewOutbox(database, settingsStore)
	queue := jev.NewQueue(database, settingsStore)
	ideaStore := idea.NewStore(database,
		idea.WithTagsAdded(outbox.TagsAdded),
		idea.WithTagsAdded(queue.TagsAdded),
		idea.WithTagsRemoved(queue.TagsRemoved),
		idea.WithContentChanged(queue.ContentChanged),
	)
	// The GitHub sender never runs here; its base URL goes nowhere.
	sender := github.NewSender(outbox, ideaStore, settingsStore, github.WithBaseURL("http://127.0.0.1:1"))
	suggester := jev.NewSuggester(queue, ideaStore, settingsStore,
		jev.WithBaseURL(fakeSrv.URL), jev.WithHTTPClient(fakeSrv.Client()), jev.WithBackoff(time.Millisecond, 10*time.Millisecond))
	return &jevEnv{
		srv:       NewServer(ideaStore, settingsStore, nil, sender, nil, suggester, nil, nil),
		settings:  settingsStore,
		suggester: suggester,
		fake:      fake,
	}
}

func (e *jevEnv) do(t *testing.T, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	rec := do(t, e.srv, method, target, body)
	e.bodies = append(e.bodies, rec.Body.String())
	return rec
}

func (e *jevEnv) create(t *testing.T, title string, tags ...string) idea.Idea {
	t.Helper()
	rec := e.do(t, "POST", "/api/ideas", idea.Draft{Title: &title, Tags: &tags})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create = %d %s", rec.Code, rec.Body)
	}
	var created idea.Idea
	json.Unmarshal(rec.Body.Bytes(), &created)
	return created
}

func (e *jevEnv) connect(t *testing.T) {
	t.Helper()
	if rec := e.do(t, "PUT", "/api/settings/jev", map[string]string{"api_key": jevTestKey}); rec.Code != http.StatusOK {
		t.Fatalf("connect = %d %s", rec.Code, rec.Body)
	}
}

func (e *jevEnv) pass(t *testing.T) {
	t.Helper()
	if err := e.suggester.Pass(t.Context()); err != nil {
		t.Fatalf("Pass: %v", err)
	}
}

func (e *jevEnv) suggested(t *testing.T, id int64) []string {
	t.Helper()
	rec := e.do(t, "GET", "/api/ideas/"+itoa(id)+"/tag-suggestions", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("suggestions = %d %s", rec.Code, rec.Body)
	}
	var list []struct {
		Tag         string  `json:"tag"`
		Probability float64 `json:"probability"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	tags := []string{}
	for _, s := range list {
		tags = append(tags, s.Tag)
	}
	return tags
}

func decodeJevStatus(t *testing.T, rec *httptest.ResponseRecorder) jevStatus {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body)
	}
	var status jevStatus
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	return status
}

func TestJevSettingsRoundTripNeverReturnsTheKey(t *testing.T) {
	e := newJevEnv(t)
	ctx := t.Context()

	if s := decodeJevStatus(t, e.do(t, "GET", "/api/settings/jev", nil)); s.Connected || s.Pending != 0 {
		t.Fatalf("fresh status = %+v, want not connected", s)
	}
	e.settings.Set(ctx, jev.KeyLastError, "an old error")
	status := decodeJevStatus(t, e.do(t, "PUT", "/api/settings/jev", map[string]string{"api_key": " " + jevTestKey + " "}))
	if !status.Connected || status.LastError != "" {
		t.Errorf("after saving a key, status = %+v, want connected with the error cleared", status)
	}
	if stored, _, _ := e.settings.Get(ctx, jev.KeyAPIKey); stored != jevTestKey {
		t.Errorf("stored key = %q, want it trimmed", stored)
	}
	e.create(t, "Waiting")
	if s := decodeJevStatus(t, e.do(t, "GET", "/api/settings/jev", nil)); s.Pending != 1 {
		t.Errorf("pending = %d, want 1", s.Pending)
	}
	if rec := e.do(t, "PUT", "/api/settings/jev", map[string]string{"api_key": "  "}); rec.Code != http.StatusBadRequest {
		t.Errorf("blank key = %d, want 400", rec.Code)
	}

	if rec := e.do(t, "DELETE", "/api/settings/jev", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("disconnect = %d %s", rec.Code, rec.Body)
	}
	if s := decodeJevStatus(t, e.do(t, "GET", "/api/settings/jev", nil)); s.Connected || s.Pending != 0 {
		t.Errorf("after disconnecting, status = %+v, want not connected with an empty queue", s)
	}
	for _, body := range e.bodies {
		if strings.Contains(body, jevTestKey) {
			t.Errorf("a response carried the key: %s", body)
		}
	}
}

func TestSuggestionsLeaveOutTagsTheNuggetNowHas(t *testing.T) {
	e := newJevEnv(t)
	e.create(t, "Has a", "a")
	e.create(t, "Has b", "b")
	e.connect(t)
	n := e.create(t, "Checked")
	e.pass(t)
	if got := e.suggested(t, n.ID); !reflect.DeepEqual(got, []string{"a", "b"}) {
		t.Fatalf("suggestions = %v, want [a b]", got)
	}
	// Saving b by hand takes it off the list.
	if rec := e.do(t, "PATCH", "/api/ideas/"+itoa(n.ID), idea.Draft{Tags: &[]string{"b"}}); rec.Code != http.StatusOK {
		t.Fatalf("patch = %d", rec.Code)
	}
	if got := e.suggested(t, n.ID); !reflect.DeepEqual(got, []string{"a"}) {
		t.Errorf("suggestions = %v, want [a]", got)
	}
}

func TestDismissNormalizesTheTagAndIsIdempotent(t *testing.T) {
	e := newJevEnv(t)
	e.create(t, "Has a", "a")
	e.create(t, "Has b", "b")
	e.connect(t)
	n := e.create(t, "Checked")
	e.pass(t)

	for range 2 {
		if rec := e.do(t, "POST", "/api/ideas/"+itoa(n.ID)+"/tag-suggestions/%20A%20/dismiss", nil); rec.Code != http.StatusNoContent {
			t.Fatalf("dismiss = %d %s", rec.Code, rec.Body)
		}
	}
	if got := e.suggested(t, n.ID); !reflect.DeepEqual(got, []string{"b"}) {
		t.Errorf("suggestions = %v, want [b]", got)
	}
	// Dismissing a tag that was never suggested still records it.
	if rec := e.do(t, "POST", "/api/ideas/"+itoa(n.ID)+"/tag-suggestions/c/dismiss", nil); rec.Code != http.StatusNoContent {
		t.Errorf("dismissing an unsuggested tag = %d", rec.Code)
	}
	if rec := e.do(t, "POST", "/api/ideas/999/tag-suggestions/a/dismiss", nil); rec.Code != http.StatusNotFound {
		t.Errorf("dismissing on a missing nugget = %d, want 404", rec.Code)
	}
}

func TestRemovingATagInAPatchDismissesItWithOrWithoutAKey(t *testing.T) {
	for _, connected := range []bool{false, true} {
		e := newJevEnv(t)
		e.create(t, "Has a", "a")
		e.create(t, "Has b", "b")
		if connected {
			e.connect(t)
		}
		n := e.create(t, "Checked", "a")
		if rec := e.do(t, "PATCH", "/api/ideas/"+itoa(n.ID), idea.Draft{Tags: &[]string{}}); rec.Code != http.StatusOK {
			t.Fatalf("patch = %d", rec.Code)
		}
		if !connected {
			e.connect(t)
		}
		if rec := e.do(t, "PATCH", "/api/ideas/"+itoa(n.ID), idea.Draft{Notes: ptr("new notes")}); rec.Code != http.StatusOK {
			t.Fatalf("patch = %d", rec.Code)
		}
		e.pass(t)
		if got := e.suggested(t, n.ID); !reflect.DeepEqual(got, []string{"b"}) {
			t.Errorf("connected=%v: suggestions = %v, want [b]: a was removed, so dismissed", connected, got)
		}
		for _, tag := range e.fake.askedTags() {
			if tag == "a" {
				t.Errorf("connected=%v: Jev was asked about the removed tag a", connected)
			}
		}
	}
}

func TestAcceptingBySavingTheTagClearsItAndStillQueuesAFeatureRequest(t *testing.T) {
	e := newJevEnv(t)
	e.create(t, "Has the mapped tag", "nuggets")
	e.connect(t)
	n := e.create(t, "Checked")
	e.pass(t)
	if got := e.suggested(t, n.ID); !reflect.DeepEqual(got, []string{"nuggets"}) {
		t.Fatalf("suggestions = %v, want [nuggets]", got)
	}

	if rec := e.do(t, "PATCH", "/api/ideas/"+itoa(n.ID), idea.Draft{Tags: &[]string{"nuggets"}}); rec.Code != http.StatusOK {
		t.Fatalf("accept = %d %s", rec.Code, rec.Body)
	}
	if got := e.suggested(t, n.ID); len(got) != 0 {
		t.Errorf("suggestions = %v after accepting, want none", got)
	}
	rec := e.do(t, "GET", "/api/ideas/"+itoa(n.ID)+"/github-issues", nil)
	var issues []github.Issue
	json.Unmarshal(rec.Body.Bytes(), &issues)
	if len(issues) != 1 || issues[0].Tag != "nuggets" {
		t.Errorf("feature requests = %+v, want one queued for nuggets", issues)
	}
}
