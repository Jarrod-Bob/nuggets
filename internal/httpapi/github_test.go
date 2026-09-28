package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/github"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const githubTestToken = "github_pat_http-secret-91d0c2"

type githubEnv struct {
	srv      http.Handler
	settings *settings.Store
	sender   *github.Sender
	// bodies collects every response body, to check none carries the token.
	bodies []string
}

func newGitHubEnv(t *testing.T) *githubEnv {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	settingsStore := settings.NewStore(database)
	outbox := github.NewOutbox(database, settingsStore)
	ideaStore := idea.NewStore(database, idea.WithTagsAdded(outbox.TagsAdded))
	// No Loop runs, and the base URL goes nowhere: these tests never reach a
	// GitHub, fake or real.
	sender := github.NewSender(outbox, ideaStore, settingsStore, github.WithBaseURL("http://127.0.0.1:1"))
	return &githubEnv{
		srv:      NewServer(ideaStore, settingsStore, nil, sender, nil, nil),
		settings: settingsStore,
		sender:   sender,
	}
}

func (e *githubEnv) do(t *testing.T, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	rec := do(t, e.srv, method, target, body)
	e.bodies = append(e.bodies, rec.Body.String())
	return rec
}

func decodeGitHubStatus(t *testing.T, rec *httptest.ResponseRecorder) githubStatus {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", rec.Code, rec.Body)
	}
	var status githubStatus
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	return status
}

func TestGitHubSettingsRoundTripNeverReturnsTheToken(t *testing.T) {
	e := newGitHubEnv(t)

	status := decodeGitHubStatus(t, e.do(t, "GET", "/api/settings/github", nil))
	if status.Connected || len(status.Mappings) != 1 || status.Mappings[0].Repo != "Jarrod-Bob/nuggets" {
		t.Fatalf("fresh status = %+v, want not connected with the default mapping", status)
	}

	status = decodeGitHubStatus(t, e.do(t, "PUT", "/api/settings/github", map[string]any{"token": " " + githubTestToken + " "}))
	if !status.Connected {
		t.Errorf("after saving a token, connected = false")
	}
	stored, _, _ := e.settings.Get(t.Context(), github.KeyToken)
	if stored != githubTestToken {
		t.Errorf("stored token = %q, want it trimmed", stored)
	}

	// Changing the mapping without retyping the token keeps it.
	status = decodeGitHubStatus(t, e.do(t, "PUT", "/api/settings/github", map[string]any{
		"mappings": []map[string]string{{"tag": "#Nuggets", "repo": "Jarrod-Bob/nuggets"}, {"tag": "spices", "repo": "Jarrod-Bob/spices"}},
	}))
	if !status.Connected || len(status.Mappings) != 2 || status.Mappings[0].Tag != "nuggets" {
		t.Errorf("after saving mappings = %+v", status)
	}

	rec := e.do(t, "DELETE", "/api/settings/github", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE = %d", rec.Code)
	}
	status = decodeGitHubStatus(t, e.do(t, "GET", "/api/settings/github", nil))
	if status.Connected || len(status.Mappings) != 2 {
		t.Errorf("after disconnect = %+v, want not connected with the mapping kept", status)
	}

	for _, body := range e.bodies {
		if strings.Contains(body, githubTestToken) || strings.Contains(body, "github_pat") {
			t.Errorf("a response contains the token: %s", body)
		}
	}
}

func TestGitHubSettingsRejectInvalidMappings(t *testing.T) {
	e := newGitHubEnv(t)
	for _, mappings := range [][]map[string]string{
		{{"tag": "", "repo": "Jarrod-Bob/nuggets"}},
		{{"tag": "nuggets", "repo": "not a repo"}},
		{{"tag": "nuggets", "repo": "https://github.com/Jarrod-Bob/nuggets"}},
		{{"tag": "a", "repo": "o/r"}, {"tag": "A", "repo": "o/s"}},
	} {
		rec := e.do(t, "PUT", "/api/settings/github", map[string]any{"mappings": mappings})
		if rec.Code != http.StatusBadRequest {
			t.Errorf("mappings %v: status = %d, want 400", mappings, rec.Code)
		}
	}
	status := decodeGitHubStatus(t, e.do(t, "GET", "/api/settings/github", nil))
	if len(status.Mappings) != 1 || status.Mappings[0].Tag != "nuggets" {
		t.Errorf("a rejected save changed the mapping: %+v", status.Mappings)
	}
}

func TestCreatingATaggedNuggetShowsAQueuedFeatureRequest(t *testing.T) {
	e := newGitHubEnv(t)
	rec := e.do(t, "POST", "/api/ideas", idea.Draft{Title: ptr("A nuggets idea"), Tags: ptr([]string{"Nuggets"})})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST = %d: %s", rec.Code, rec.Body)
	}
	var created idea.Idea
	json.Unmarshal(rec.Body.Bytes(), &created)

	rec = e.do(t, "GET", "/api/ideas/"+itoa(created.ID)+"/github-issues", nil)
	var issues []github.Issue
	if err := json.Unmarshal(rec.Body.Bytes(), &issues); err != nil {
		t.Fatalf("decoding %s: %v", rec.Body, err)
	}
	if len(issues) != 1 || issues[0].State != github.StatePending || issues[0].Repo != "Jarrod-Bob/nuggets" {
		t.Fatalf("issues = %+v, want one pending on Jarrod-Bob/nuggets", issues)
	}
	if strings.Contains(rec.Body.String(), "key") {
		t.Errorf("the idempotency key leaked into the API: %s", rec.Body)
	}
	status := decodeGitHubStatus(t, e.do(t, "GET", "/api/settings/github", nil))
	if status.Pending != 1 {
		t.Errorf("pending = %d, want 1", status.Pending)
	}

	// Retry is for failed rows only.
	if rec := e.do(t, "POST", "/api/github-issues/"+itoa(issues[0].ID)+"/retry", nil); rec.Code != http.StatusConflict {
		t.Errorf("retrying a pending row = %d, want 409", rec.Code)
	}
	if rec := e.do(t, "POST", "/api/github-issues/999/retry", nil); rec.Code != http.StatusNotFound {
		t.Errorf("retrying a missing row = %d, want 404", rec.Code)
	}
	if rec := e.do(t, "POST", "/api/github-issues/abc/retry", nil); rec.Code != http.StatusBadRequest {
		t.Errorf("retrying a non-numeric id = %d, want 400", rec.Code)
	}

	// An untagged nugget has an empty list, not null.
	rec = e.do(t, "POST", "/api/ideas", idea.Draft{Title: ptr("Other")})
	json.Unmarshal(rec.Body.Bytes(), &created)
	rec = e.do(t, "GET", "/api/ideas/"+itoa(created.ID)+"/github-issues", nil)
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("untagged nugget's issues = %s, want []", rec.Body)
	}
}

func itoa(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
