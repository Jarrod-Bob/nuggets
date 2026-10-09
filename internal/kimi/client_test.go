package kimi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// fakeKimi is just enough of kimi-no-name-wa's API (its README "API"):
// POST /api/v1/names and GET /api/v1/health. It never talks to a real kimi
// or Ollama.
type fakeKimi struct {
	mu          sync.Mutex
	requests    []map[string]any
	contentType string
	// names answers POST /api/v1/names when set; otherwise it returns one
	// canned name.
	names http.HandlerFunc
	// health is the status GET /api/v1/health reports.
	health string
}

func newFakeKimi(t *testing.T) (*fakeKimi, *httptest.Server) {
	t.Helper()
	fake := &fakeKimi{health: "ok"}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/names", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		fake.mu.Lock()
		fake.requests = append(fake.requests, decoded)
		fake.contentType = r.Header.Get("Content-Type")
		answer := fake.names
		fake.mu.Unlock()
		if answer != nil {
			answer(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":12,"client":"nuggets","names":[
			{"id":87,"generation_id":12,"name":"Ideanori","technique":"portmanteau",
			 "explanation":"IDEA + onigiri: small, portable, packed for later.","tone":"witty","favourite":false}]}`)
	})
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		fake.mu.Lock()
		status := fake.health
		fake.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"status": status, "ollama": map[string]any{}})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return fake, srv
}

func (f *fakeKimi) lastRequest(t *testing.T) map[string]any {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.requests) == 0 {
		t.Fatal("kimi was never asked for names")
	}
	return f.requests[len(f.requests)-1]
}

func kimiError(status int, code string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{"message": "kimi says " + code, "code": code},
		})
	}
}

func newSettings(t *testing.T) *settings.Store {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return settings.NewStore(database)
}

// newTestClient points a Client at the fake through the kimi_url setting, as
// the captain would in Settings.
func newTestClient(t *testing.T, url string) *Client {
	t.Helper()
	store := newSettings(t)
	if _, err := SaveURL(context.Background(), store, url); err != nil {
		t.Fatalf("SaveURL: %v", err)
	}
	return NewClient(store, nil)
}

func TestNamesSendsNotesAsDescription(t *testing.T) {
	fake, srv := newFakeKimi(t)
	client := newTestClient(t, srv.URL)

	names, err := client.Names(context.Background(), "A bank for the little ideas I have while I'm out", []string{"Nugglet"})
	if err != nil {
		t.Fatalf("Names: %v", err)
	}

	got := fake.lastRequest(t)
	if got["description"] != "A bank for the little ideas I have while I'm out" {
		t.Errorf("description = %v, want the notes", got["description"])
	}
	if got["count"] != float64(5) {
		t.Errorf("count = %v, want 5", got["count"])
	}
	if got["client"] != "nuggets" {
		t.Errorf("client = %v, want nuggets", got["client"])
	}
	if avoid, _ := got["avoid"].([]any); len(avoid) != 1 || avoid[0] != "Nugglet" {
		t.Errorf("avoid = %v, want [Nugglet]", got["avoid"])
	}
	if _, sent := got["tones"]; sent {
		t.Errorf("tones = %v, want none sent so kimi uses its defaults", got["tones"])
	}
	if fake.contentType != "application/json" {
		t.Errorf("Content-Type = %q, want application/json (kimi refuses anything else)", fake.contentType)
	}

	want := Name{Name: "Ideanori", Explanation: "IDEA + onigiri: small, portable, packed for later.", Technique: "portmanteau", Tone: "witty"}
	if len(names) != 1 || names[0] != want {
		t.Errorf("names = %+v, want [%+v]", names, want)
	}
}

func TestNamesMapsKimiErrors(t *testing.T) {
	cases := map[string]struct {
		answer http.HandlerFunc
		want   error
	}{
		"ollama unreachable": {kimiError(503, "ollama_unreachable"), ErrUnavailable},
		"model missing":      {kimiError(503, "model_missing"), ErrUnavailable},
		"no names":           {kimiError(502, "no_names"), ErrFailed},
		"model timeout":      {kimiError(504, "model_timeout"), ErrFailed},
		"model error":        {kimiError(502, "model_error"), ErrModelError},
		"bad request":        {kimiError(400, "invalid_request"), ErrFailed},
		"no error envelope": {func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		}, ErrFailed},
		"garbled success": {func(w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, "not json")
		}, ErrFailed},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			fake, srv := newFakeKimi(t)
			fake.names = tc.answer
			_, err := newTestClient(t, srv.URL).Names(context.Background(), "notes", nil)
			if !errors.Is(err, tc.want) {
				t.Errorf("Names error = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestNamesIsCancelledWithTheCallersContext(t *testing.T) {
	fake, srv := newFakeKimi(t)
	arrived := make(chan struct{})
	fake.names = func(w http.ResponseWriter, r *http.Request) {
		close(arrived)
		<-r.Context().Done() // a model still thinking, until nuggets hangs up
	}
	client := newTestClient(t, srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := client.Names(ctx, "notes", nil)
		done <- err
	}()
	<-arrived
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("Names error = %v, want context.Canceled", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Names didn't return after its context was cancelled")
	}
}

func TestAvailableFollowsKimiHealth(t *testing.T) {
	cases := map[string]bool{"ok": true, "degraded": false}
	for status, want := range cases {
		t.Run(status, func(t *testing.T) {
			fake, srv := newFakeKimi(t)
			fake.health = status
			if got := newTestClient(t, srv.URL).Available(context.Background()); got != want {
				t.Errorf("Available() = %v, want %v", got, want)
			}
		})
	}

	t.Run("unreachable", func(t *testing.T) {
		_, srv := newFakeKimi(t)
		url := srv.URL
		srv.Close()
		if newTestClient(t, url).Available(context.Background()) {
			t.Error("Available() = true for a kimi that isn't running")
		}
	})

	t.Run("an error answer", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"status":"ok"}`, http.StatusInternalServerError)
		}))
		t.Cleanup(srv.Close)
		if newTestClient(t, srv.URL).Available(context.Background()) {
			t.Error("Available() = true for a 500")
		}
	})
}

func TestNamesReportsASlowKimiAsFailed(t *testing.T) {
	fake, srv := newFakeKimi(t)
	fake.names = func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }
	store := newSettings(t)
	if _, err := SaveURL(context.Background(), store, srv.URL); err != nil {
		t.Fatal(err)
	}
	client := NewClient(store, &http.Client{Timeout: 50 * time.Millisecond})

	if _, err := client.Names(context.Background(), "notes", nil); !errors.Is(err, ErrFailed) {
		t.Errorf("Names error = %v, want ErrFailed for a kimi that answered too slowly", err)
	}
}

func TestNamesReportsUnreachableKimiAsUnavailable(t *testing.T) {
	_, srv := newFakeKimi(t)
	url := srv.URL
	srv.Close()

	_, err := newTestClient(t, url).Names(context.Background(), "notes", nil)
	if !errors.Is(err, ErrUnavailable) {
		t.Errorf("Names error = %v, want ErrUnavailable", err)
	}
}
