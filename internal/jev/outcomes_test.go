package jev

import (
	"bytes"
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// queueOneCheck leaves one nugget waiting for a check with one candidate tag.
func queueOneCheck(t *testing.T, e *testEnv) int64 {
	t.Helper()
	e.create(t, "Has a", "", "a")
	e.fake.answer("a", 0.9)
	e.setKey(t, testKey)
	return e.create(t, "Checked", "").ID
}

func lastError(t *testing.T, e *testEnv) string {
	t.Helper()
	v, _, err := e.settings.Get(context.Background(), KeyLastError)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func answerWith(status int, header map[string]string, body string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		for k, v := range header {
			w.Header().Set(k, v)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write([]byte(body))
	}
}

func TestA401ParksUntilTheKeyChanges(t *testing.T) {
	e := newTestEnv(t)
	n := queueOneCheck(t, e)
	e.fake.acceptKey("a-different-key")

	if err := e.pass(t); !errors.Is(err, errRejected) {
		t.Fatalf("Pass = %v, want errRejected", err)
	}
	if got := lastError(t, e); !strings.Contains(got, "TypeSafe rejected the API key") {
		t.Errorf("last error = %q", got)
	}
	if got := e.pending(t); got != 1 {
		t.Errorf("pending = %d, want the check kept", got)
	}
	if err := e.pass(t); !errors.Is(err, errRejected) {
		t.Fatalf("second Pass = %v, want errRejected without a call", err)
	}
	if got := len(e.fake.sent()); got != 1 {
		t.Errorf("requests = %d, want 1: parked until the key changes", got)
	}

	e.fake.acceptKey("the-new-key")
	err := e.suggester.Reset(context.Background(), func() error {
		return e.settings.Set(context.Background(), KeyAPIKey, "the-new-key")
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := e.pass(t); err != nil {
		t.Fatalf("Pass after a new key = %v", err)
	}
	if got := e.suggestedTags(t, n); len(got) != 1 {
		t.Errorf("suggestions = %v, want the check done with the new key", got)
	}
	if got := lastError(t, e); got != "" {
		t.Errorf("last error = %q after a success, want it cleared", got)
	}
}

func TestRateLimitsPauseAtLeastAMinuteOrAsLongAsAsked(t *testing.T) {
	for _, tc := range []struct {
		name    string
		status  int
		header  map[string]string
		atLeast time.Duration
	}{
		{"429 without Retry-After", http.StatusTooManyRequests, nil, time.Minute},
		{"529 without Retry-After", 529, nil, time.Minute},
		{"429 with a longer Retry-After", http.StatusTooManyRequests, map[string]string{"Retry-After": "300"}, 300 * time.Second},
		{"529 with a shorter Retry-After", 529, map[string]string{"Retry-After": "5"}, time.Minute},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := newTestEnv(t)
			queueOneCheck(t, e)
			e.fake.queue(answerWith(tc.status, tc.header, `{"error":{"message":"slow down"}}`))
			start := time.Now()
			err := e.pass(t)
			var paused *pausedError
			if !errors.As(err, &paused) {
				t.Fatalf("Pass = %v, want a pause", err)
			}
			if wait := paused.until.Sub(start); wait < tc.atLeast || wait > tc.atLeast+5*time.Second {
				t.Errorf("paused for %v, want %v", wait, tc.atLeast)
			}
			if got := e.pending(t); got != 1 {
				t.Errorf("pending = %d, want the check kept", got)
			}
			if err := e.pass(t); !errors.As(err, &paused) || len(e.fake.sent()) != 1 {
				t.Errorf("a pass during the pause sent %d requests (err %v), want none", len(e.fake.sent())-1, err)
			}
			if lastError(t, e) == "" {
				t.Errorf("no last error recorded")
			}
		})
	}
}

func TestRateLimitsInARowBackOffExponentially(t *testing.T) {
	e := newTestEnv(t)
	queueOneCheck(t, e)
	var waits []time.Duration
	for range 3 {
		e.fake.queue(answerWith(http.StatusTooManyRequests, nil, `{}`))
		e.suggester.mu.Lock()
		e.suggester.pauseUntil = time.Time{} // let the next pass through at once
		e.suggester.mu.Unlock()
		e.db.Exec(`UPDATE tag_checks SET next_attempt_at = NULL`)
		start := time.Now()
		var paused *pausedError
		if err := e.pass(t); !errors.As(err, &paused) {
			t.Fatalf("Pass = %v, want a pause", err)
		}
		waits = append(waits, paused.until.Sub(start).Round(time.Second))
	}
	want := []time.Duration{time.Minute, 2 * time.Minute, 4 * time.Minute}
	for i := range want {
		if waits[i] != want[i] {
			t.Errorf("waits = %v, want %v", waits, want)
			break
		}
	}
}

func TestAServerErrorBacksOffAndKeepsTheCheck(t *testing.T) {
	e := newTestEnv(t)
	n := queueOneCheck(t, e)
	e.fake.queue(answerWith(http.StatusBadGateway, nil, `oops`))
	var paused *pausedError
	if err := e.pass(t); !errors.As(err, &paused) {
		t.Fatalf("Pass = %v, want a backoff", err)
	}
	if got := lastError(t, e); !strings.Contains(got, "502") {
		t.Errorf("last error = %q, want the status named", got)
	}
	if got := e.pending(t); got != 1 {
		t.Errorf("pending = %d, want the check kept", got)
	}
	waitUntil(t, "the backoff to run out", func() bool {
		return e.pass(t) == nil
	})
	if got := e.suggestedTags(t, n); len(got) != 1 {
		t.Errorf("suggestions = %v after the retry, want [a]", got)
	}
}

func TestANetworkErrorBacksOff(t *testing.T) {
	e := newTestEnv(t, WithBaseURL("http://127.0.0.1:1"))
	queueOneCheck(t, e)
	var paused *pausedError
	if err := e.pass(t); !errors.As(err, &paused) {
		t.Fatalf("Pass = %v, want a backoff", err)
	}
	if got := lastError(t, e); !strings.HasPrefix(got, "Couldn't reach TypeSafe") {
		t.Errorf("last error = %q", got)
	}
	if got := e.pending(t); got != 1 {
		t.Errorf("pending = %d, want the check kept", got)
	}
}

func TestA422DropsTheCheckAndRecordsTheMessage(t *testing.T) {
	e := newTestEnv(t)
	queueOneCheck(t, e)
	e.create(t, "Second", "")
	e.fake.queue(answerWith(http.StatusUnprocessableEntity, nil, `{"error":{"message":"questions.t0.criteria: invalid"}}`))
	if err := e.pass(t); err != nil {
		t.Fatalf("Pass = %v, want it to go on to the next check", err)
	}
	if got := lastError(t, e); !strings.Contains(got, "questions.t0.criteria") {
		t.Errorf("last error = %q, want TypeSafe's message", got)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d, want the refused check dropped and the next one done", got)
	}
	if got := len(e.fake.sent()); got != 2 {
		t.Errorf("requests = %d, want 2 (no retry of the 422)", got)
	}
}

func TestDisconnectEmptiesTheQueueAndKeepsSuggestions(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	n := queueOneCheck(t, e)
	if err := e.pass(t); err != nil {
		t.Fatal(err)
	}
	e.create(t, "Waiting", "")
	if e.pending(t) != 1 {
		t.Fatalf("pending = %d, want 1", e.pending(t))
	}
	err := e.suggester.Reset(ctx, func() error {
		if err := e.settings.Delete(ctx, KeyAPIKey); err != nil {
			return err
		}
		return e.suggester.ClearQueue(ctx)
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d after disconnecting, want 0", got)
	}
	if got := e.suggestedTags(t, n); len(got) != 1 {
		t.Errorf("suggestions = %v, want them kept", got)
	}
	if err := e.pass(t); !errors.Is(err, errNotConfigured) {
		t.Errorf("Pass = %v, want errNotConfigured", err)
	}
}

func TestTheKeyNeverAppearsInALog(t *testing.T) {
	var buf bytes.Buffer
	orig := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(orig) })

	e := newTestEnv(t)
	queueOneCheck(t, e)
	e.fake.queue(
		answerWith(http.StatusUnprocessableEntity, nil, `{"error":{"message":"bad"}}`),
	)
	e.pass(t)
	e.create(t, "Another", "")
	e.fake.queue(answerWith(http.StatusInternalServerError, nil, `boom`))
	e.pass(t)
	e.fake.acceptKey("something-else")
	e.suggester.mu.Lock()
	e.suggester.pauseUntil = time.Time{}
	e.suggester.mu.Unlock()
	e.db.Exec(`UPDATE tag_checks SET next_attempt_at = NULL`)
	e.pass(t)

	if buf.Len() == 0 {
		t.Fatal("nothing was logged; the test isn't exercising the log")
	}
	if strings.Contains(buf.String(), testKey) {
		t.Errorf("the key appeared in the log:\n%s", buf.String())
	}
	if strings.Contains(lastError(t, e), testKey) {
		t.Errorf("the key appeared in the last error")
	}
}

func TestTheLoopChecksANuggetSoonAfterItIsSaved(t *testing.T) {
	e := newTestEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { e.suggester.Loop(ctx); close(done) }()

	n := queueOneCheck(t, e)
	waitUntil(t, "the suggestion", func() bool { return len(e.suggestedTags(t, n)) == 1 })
	cancel()
	<-done
}

func TestA422KeepsANewerRequestMadeWhileItWasInFlight(t *testing.T) {
	e := newTestEnv(t)
	n := queueOneCheck(t, e)
	e.fake.queue(func(w http.ResponseWriter, r *http.Request) {
		notes := "edited mid-check"
		if _, err := e.ideas.Update(context.Background(), n, idea.Draft{Notes: &notes}); err != nil {
			t.Errorf("editing mid-check: %v", err)
		}
		answerWith(http.StatusUnprocessableEntity, nil, `{"error":{"message":"bad"}}`)(w, r)
	})
	if err := e.pass(t); err != nil {
		t.Fatalf("Pass = %v", err)
	}
	if got := len(e.fake.sent()); got != 2 {
		t.Errorf("requests = %d, want the newer text checked too", got)
	}
	if got := e.suggestedTags(t, n); len(got) != 1 {
		t.Errorf("suggestions = %v, want the newer check's [a]", got)
	}
}

func TestSavingTheSameKeyAgainAfterA401TriesAgain(t *testing.T) {
	e := newTestEnv(t)
	n := queueOneCheck(t, e)
	e.fake.acceptKey("not-yet")
	if err := e.pass(t); !errors.Is(err, errRejected) {
		t.Fatalf("Pass = %v, want errRejected", err)
	}
	// The captain fixes the key on TypeSafe's side and saves the same one.
	e.fake.acceptKey(testKey)
	if err := e.suggester.Reset(context.Background(), func() error {
		return e.settings.Set(context.Background(), KeyAPIKey, testKey)
	}); err != nil {
		t.Fatal(err)
	}
	if err := e.pass(t); err != nil {
		t.Fatalf("Pass after saving the key again = %v", err)
	}
	if got := e.suggestedTags(t, n); len(got) != 1 {
		t.Errorf("suggestions = %v, want the check done", got)
	}
}
