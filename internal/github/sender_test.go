package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
)

func TestPassCreatesTheIssueFromTheTemplate(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	n := e.createIdea(t, "Dark mode", "A darker palette for late-night browsing.", "nuggets", "ui")

	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatalf("Pass: %v", err)
	}

	issues, reqs := e.fake.snapshot()
	if len(issues) != 1 || len(reqs) != 1 {
		t.Fatalf("issues = %d, requests = %d; want 1 and 1", len(issues), len(reqs))
	}
	req := reqs[0]
	if req.Method != http.MethodPost || req.Path != "/repos/Jarrod-Bob/nuggets/issues" {
		t.Errorf("request = %s %s, want POST /repos/Jarrod-Bob/nuggets/issues", req.Method, req.Path)
	}
	for header, want := range map[string]string{
		"Accept":               "application/vnd.github+json",
		"X-Github-Api-Version": "2022-11-28",
		"Authorization":        "Bearer " + testToken,
		"Content-Type":         "application/json",
	} {
		if got := req.Header.Get(header); got != want {
			t.Errorf("header %s = %q, want %q", header, got, want)
		}
	}

	is := issues[0]
	if is.Title != "[Feature]: Dark mode" {
		t.Errorf("title = %q", is.Title)
	}
	if len(is.Labels) != 1 || is.Labels[0] != "enhancement" {
		t.Errorf("labels = %v, want [enhancement]", is.Labels)
	}
	wantInOrder := []string{
		"## Problem\nCaptured as an idea in nuggets",
		"## Proposed Solution\nA darker palette for late-night browsing.",
		"## Alternatives Considered\n",
		"## Additional Context\n",
		"- **Tags:** `nuggets`, `ui`",
		"- **Origin:** manual (typed into nuggets)",
		"- **Captured:** " + n.CreatedAt.UTC().Format("2006-01-02"),
		"<!-- nuggets:nugget-id=" + strconv.FormatInt(n.ID, 10) + " key=",
	}
	rest := is.Body
	for _, want := range wantInOrder {
		i := strings.Index(rest, want)
		if i < 0 {
			t.Fatalf("body is missing %q (in order); body:\n%s", want, is.Body)
		}
		rest = rest[i+len(want):]
	}
	for _, banned := range []string{"127.0.0.1", "localhost", testToken} {
		if strings.Contains(is.Body, banned) {
			t.Errorf("body contains %q", banned)
		}
	}

	row := e.onlyRow(t, n.ID)
	if row.State != StateCreated || row.Number == nil || *row.Number != 1 {
		t.Fatalf("row = %+v, want created #1", row)
	}
	if row.URL == nil || *row.URL != "https://github.com/Jarrod-Bob/nuggets/issues/1" {
		t.Errorf("url = %v", row.URL)
	}
	if e.events.count(events.GitHubChanged) == 0 {
		t.Error("creating the issue published no github-changed event")
	}

	// A second pass has nothing to do.
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := e.fake.countRequests(http.MethodPost); got != 1 {
		t.Errorf("POSTs after a second pass = %d, want 1", got)
	}
}

// droppingTransport lets a POST reach GitHub, then loses the answer: the
// issue exists but the sender never hears about it.
type droppingTransport struct {
	base  http.RoundTripper
	drops int
}

func (d *droppingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := d.base.RoundTrip(req)
	if err == nil && req.Method == http.MethodPost && d.drops > 0 {
		d.drops--
		resp.Body.Close()
		return nil, errors.New("connection reset by peer")
	}
	return resp, err
}

func TestALostAnswerNeverCreatesASecondIssue(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	lossy := &http.Client{Transport: &droppingTransport{base: e.srv.Client().Transport, drops: 1}}
	e.sender = e.newSender(WithHTTPClient(lossy))
	n := e.createIdea(t, "Keyboard shortcuts", "", "nuggets")

	err := e.sender.Pass(context.Background())
	var paused *pausedError
	if !errors.As(err, &paused) {
		t.Fatalf("Pass = %v, want a pause after the lost answer", err)
	}
	row := e.onlyRow(t, n.ID)
	if row.State != StatePending || row.Attempts != 1 || !strings.Contains(row.LastError, "Couldn't reach GitHub") {
		t.Fatalf("row after the lost answer = %+v", row)
	}

	// The app is killed between the POST and recording its result: the row is
	// left mid-send. A fresh sender (a restart) must find the issue instead of
	// posting again.
	if _, err := e.db.Exec(`UPDATE github_issues SET state = 'sending', next_attempt_at = NULL`); err != nil {
		t.Fatal(err)
	}
	restarted := e.newSender()
	if err := restarted.Pass(context.Background()); err != nil {
		t.Fatalf("Pass after restart: %v", err)
	}

	issues, _ := e.fake.snapshot()
	if len(issues) != 1 {
		t.Fatalf("GitHub has %d issues, want 1", len(issues))
	}
	if got := e.fake.countRequests(http.MethodPost); got != 1 {
		t.Errorf("POSTs = %d, want 1", got)
	}
	row = e.onlyRow(t, n.ID)
	if row.State != StateCreated || row.Number == nil || *row.Number != 1 {
		t.Errorf("row = %+v, want created #1 found by its marker", row)
	}
}

func TestASendingRowWhosePostNeverLandedIsSentOnce(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	n := e.createIdea(t, "Export", "", "nuggets")
	// Killed after marking sending but before the POST went out.
	if _, err := e.db.Exec(`UPDATE github_issues SET state = 'sending', attempts = 1, sent_at = ?`, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if e.fake.countRequests(http.MethodGet) != 1 || e.fake.countRequests(http.MethodPost) != 1 {
		t.Errorf("want one search then one POST; got %d GETs, %d POSTs",
			e.fake.countRequests(http.MethodGet), e.fake.countRequests(http.MethodPost))
	}
	if row := e.onlyRow(t, n.ID); row.State != StateCreated {
		t.Errorf("row = %+v, want created", row)
	}
}

func TestServerErrorsBackOffThenSend(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	n := e.createIdea(t, "Sorting", "", "nuggets")
	e.fake.script(func(w http.ResponseWriter, r *http.Request) {
		writeGitHubError(w, http.StatusBadGateway, "Server Error")
	})

	err := e.sender.Pass(context.Background())
	var paused *pausedError
	if !errors.As(err, &paused) {
		t.Fatalf("Pass = %v, want a pause", err)
	}
	row := e.onlyRow(t, n.ID)
	if row.State != StatePending || row.nextAttemptAt == nil || !strings.Contains(row.LastError, "502") {
		t.Fatalf("row = %+v, want pending with a retry time and the 502", row)
	}
	cfg, _ := LoadConfig(context.Background(), e.settings)
	if !strings.Contains(cfg.LastError, "502") {
		t.Errorf("status error = %q, want the 502", cfg.LastError)
	}

	// Still paused: nothing is sent.
	if err := e.sender.Pass(context.Background()); !errors.As(err, &paused) {
		t.Fatalf("Pass during the pause = %v", err)
	}
	if got := e.fake.countRequests(http.MethodPost); got != 1 {
		t.Fatalf("POSTs during the pause = %d, want 1", got)
	}

	time.Sleep(15 * time.Millisecond) // past the 1ms backoff for the sender and the row
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, n.ID); row.State != StateCreated || row.Attempts != 2 || row.LastError != "" {
		t.Errorf("row = %+v, want created on the second attempt", row)
	}
	cfg, _ = LoadConfig(context.Background(), e.settings)
	if cfg.LastError != "" {
		t.Errorf("status error after success = %q, want cleared", cfg.LastError)
	}
}

func TestBackoffDoublesUpToTheCap(t *testing.T) {
	s := &Sender{baseBackoff: time.Second, maxBackoff: 10 * time.Second}
	for n, want := range map[int]time.Duration{1: time.Second, 2: 2 * time.Second, 3: 4 * time.Second, 4: 8 * time.Second, 5: 10 * time.Second, 30: 10 * time.Second} {
		if got := s.backoff(n); got != want {
			t.Errorf("backoff(%d) = %v, want %v", n, got, want)
		}
	}
}

func TestRateLimitHoldsEveryRowUntilTheReset(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	first := e.createIdea(t, "One", "", "nuggets")
	second := e.createIdea(t, "Two", "", "nuggets")
	reset := time.Now().Add(2 * time.Minute).Unix()
	e.fake.script(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-RateLimit-Remaining", "0")
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(reset, 10))
		writeGitHubError(w, http.StatusForbidden, "API rate limit exceeded")
	})

	err := e.sender.Pass(context.Background())
	var paused *pausedError
	if !errors.As(err, &paused) {
		t.Fatalf("Pass = %v, want a pause", err)
	}
	if wait := time.Until(paused.until); wait < 100*time.Second || wait > 122*time.Second {
		t.Errorf("paused for %v, want until the reset (~2m)", wait)
	}
	if row := e.onlyRow(t, first.ID); row.State != StatePending || !strings.Contains(row.LastError, "rate limit") {
		t.Errorf("first row = %+v", row)
	}
	if row := e.onlyRow(t, second.ID); row.Attempts != 0 {
		t.Errorf("second row was tried during the rate limit: %+v", row)
	}
	if err := e.sender.Pass(context.Background()); !errors.As(err, &paused) {
		t.Fatalf("second Pass = %v, want still paused", err)
	}
	if got := e.fake.countRequests(http.MethodPost); got != 1 {
		t.Errorf("POSTs = %d, want 1", got)
	}
	// A 403 that is a rate limit is never a permanent failure.
	if row := e.onlyRow(t, first.ID); row.State == StateFailed {
		t.Error("rate-limited row was marked failed")
	}
}

func TestRateLimitHeaders(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	cases := []struct {
		name    string
		header  http.Header
		message string
		limited bool
		wait    time.Duration
	}{
		{"retry-after", http.Header{"Retry-After": {"30"}}, "", true, 30 * time.Second},
		{"reset", http.Header{"X-Ratelimit-Remaining": {"0"}, "X-Ratelimit-Reset": {strconv.FormatInt(now.Unix()+90, 10)}}, "", true, 91 * time.Second},
		{"secondary", http.Header{}, "You have exceeded a secondary rate limit", true, time.Minute},
		{"capped", http.Header{"Retry-After": {"999999"}}, "", true, time.Hour},
		{"permission", http.Header{}, "Resource not accessible by personal access token", false, 0},
	}
	for _, c := range cases {
		limited, wait := rateLimit(c.header, c.message, now)
		if limited != c.limited || wait != c.wait {
			t.Errorf("%s: rateLimit = %v, %v; want %v, %v", c.name, limited, wait, c.limited, c.wait)
		}
	}
}

func TestA401ParksUntilTheTokenChanges(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, "github_pat_wrong-token")
	n := e.createIdea(t, "Tag colours", "", "nuggets")

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.sender.Loop(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })

	waitUntil(t, "the rejected token to be recorded", func() bool {
		cfg, _ := LoadConfig(context.Background(), e.settings)
		return cfg.LastError == RejectedMessage
	})
	if row := e.onlyRow(t, n.ID); row.State != StatePending || row.LastError != waitingForToken {
		t.Fatalf("row = %+v, want pending waiting for a token", row)
	}

	// Parked: queueing more wakes the loop, but nothing reaches GitHub.
	before := len(snapshotRequests(e))
	e.createIdea(t, "Another", "", "nuggets")
	time.Sleep(50 * time.Millisecond)
	if after := len(snapshotRequests(e)); after != before {
		t.Fatalf("parked sender made %d more requests", after-before)
	}

	if err := e.sender.Reset(context.Background(), func() error {
		if err := e.settings.Set(context.Background(), KeyToken, testToken); err != nil {
			return err
		}
		return e.settings.Delete(context.Background(), KeyLastError)
	}); err != nil {
		t.Fatal(err)
	}
	waitUntil(t, "the issue to be created with the new token", func() bool {
		return e.onlyRow(t, n.ID).State == StateCreated
	})
	if issues, _ := e.fake.snapshot(); len(issues) != 2 {
		t.Errorf("issues = %d, want 2", len(issues))
	}
}

func snapshotRequests(e *testEnv) []recordedRequest {
	_, reqs := e.fake.snapshot()
	return reqs
}

func TestNoTokenQueuesUntilOneIsSaved(t *testing.T) {
	e := newTestEnv(t)
	n := e.createIdea(t, "Queued", "", "nuggets")
	if err := e.sender.Pass(context.Background()); !errors.Is(err, errNotConfigured) {
		t.Fatalf("Pass = %v, want not configured", err)
	}
	if len(snapshotRequests(e)) != 0 {
		t.Fatal("a sender with no token called GitHub")
	}
	if row := e.onlyRow(t, n.ID); row.State != StatePending {
		t.Fatalf("row = %+v, want pending", row)
	}
	e.setToken(t, testToken)
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, n.ID); row.State != StateCreated {
		t.Errorf("row = %+v, want created", row)
	}
}

func TestA422RetriesOnceWithoutLabels(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	e.fake.rejectLabels = true // set before any request, so no lock needed
	n := e.createIdea(t, "Labels", "", "nuggets")

	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	_, reqs := e.fake.snapshot()
	if len(reqs) != 2 {
		t.Fatalf("requests = %d, want 2", len(reqs))
	}
	var first, second NewIssue
	json.Unmarshal(reqs[0].Body, &first)
	json.Unmarshal(reqs[1].Body, &second)
	if len(first.Labels) != 1 || len(second.Labels) != 0 {
		t.Errorf("labels = %v then %v, want [enhancement] then none", first.Labels, second.Labels)
	}
	if strings.Contains(string(reqs[1].Body), `"labels"`) {
		t.Errorf("second POST still sends labels: %s", reqs[1].Body)
	}
	if row := e.onlyRow(t, n.ID); row.State != StateCreated {
		t.Errorf("row = %+v, want created", row)
	}
}

func TestA422WithoutLabelsFailsAndRetryRequeues(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	n := e.createIdea(t, "Invalid", "", "nuggets")
	invalid := func(w http.ResponseWriter, r *http.Request) {
		writeGitHubError(w, http.StatusUnprocessableEntity, "Validation Failed")
	}
	e.fake.script(invalid, invalid)

	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := e.fake.countRequests(http.MethodPost); got != 2 {
		t.Errorf("POSTs = %d, want 2 (one with labels, one without)", got)
	}
	row := e.onlyRow(t, n.ID)
	if row.State != StateFailed || !strings.Contains(row.LastError, "422") {
		t.Fatalf("row = %+v, want failed with the 422", row)
	}

	retried, err := e.sender.Retry(context.Background(), row.ID)
	if err != nil || retried.State != StatePending || retried.LastError != "" {
		t.Fatalf("Retry = %+v, %v", retried, err)
	}
	if _, err := e.sender.Retry(context.Background(), row.ID); !errors.Is(err, ErrNotRetryable) {
		t.Errorf("retrying a pending row = %v, want ErrNotRetryable", err)
	}
	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, n.ID); row.State != StateCreated {
		t.Errorf("row after retry = %+v, want created", row)
	}
	if issues, _ := e.fake.snapshot(); len(issues) != 1 {
		t.Errorf("issues = %d, want 1", len(issues))
	}
}

func TestAMissingRepoFailsWithoutStoppingOthers(t *testing.T) {
	e := newTestEnv(t)
	e.setToken(t, testToken)
	e.fake.missingRepos["Jarrod-Bob/gone"] = true
	if err := e.settings.Set(context.Background(), KeyMappings,
		`[{"tag":"gone","repo":"Jarrod-Bob/gone"},{"tag":"nuggets","repo":"Jarrod-Bob/nuggets"}]`); err != nil {
		t.Fatal(err)
	}
	lost := e.createIdea(t, "Lost", "", "gone")
	kept := e.createIdea(t, "Kept", "", "nuggets")

	if err := e.sender.Pass(context.Background()); err != nil {
		t.Fatal(err)
	}
	if row := e.onlyRow(t, lost.ID); row.State != StateFailed || !strings.Contains(row.LastError, "404") {
		t.Errorf("row for the missing repo = %+v, want failed with the 404", row)
	}
	if row := e.onlyRow(t, kept.ID); row.State != StateCreated {
		t.Errorf("other row = %+v, want created", row)
	}
}

func TestTheTokenNeverReachesTheLogOrStoredErrors(t *testing.T) {
	var buf bytes.Buffer
	original := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(original) })

	e := newTestEnv(t)
	e.setToken(t, testToken)
	e.fake.missingRepos["Jarrod-Bob/gone"] = true
	if err := e.settings.Set(context.Background(), KeyMappings,
		`[{"tag":"gone","repo":"Jarrod-Bob/gone"},{"tag":"nuggets","repo":"Jarrod-Bob/nuggets"}]`); err != nil {
		t.Fatal(err)
	}
	e.createIdea(t, "404", "", "gone")
	e.createIdea(t, "500 then ok", "", "nuggets")
	e.fake.script(func(w http.ResponseWriter, r *http.Request) {
		writeGitHubError(w, http.StatusInternalServerError, "Server Error")
	})
	e.sender.Pass(context.Background())
	time.Sleep(15 * time.Millisecond)
	e.sender.Pass(context.Background())

	// A network failure, then a rejected token.
	unreachable := e.newSender(WithBaseURL("http://127.0.0.1:1"))
	e.createIdea(t, "unreachable", "", "nuggets")
	unreachable.Pass(context.Background())
	e.fake.mu.Lock()
	e.fake.token = "something-else"
	e.fake.mu.Unlock()
	time.Sleep(15 * time.Millisecond)
	e.newSender().Pass(context.Background())

	if !strings.Contains(buf.String(), "github:") {
		t.Fatalf("expected the sender to log something; got %q", buf.String())
	}
	if strings.Contains(buf.String(), testToken) {
		t.Errorf("the log contains the token:\n%s", buf.String())
	}
	var stored strings.Builder
	rows, err := e.db.Query(`SELECT last_error FROM github_issues`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var s string
		rows.Scan(&s)
		stored.WriteString(s + "\n")
	}
	rows.Close()
	cfg, _ := LoadConfig(context.Background(), e.settings)
	stored.WriteString(cfg.LastError)
	if strings.Contains(stored.String(), testToken) {
		t.Errorf("a stored error contains the token:\n%s", stored.String())
	}
}
