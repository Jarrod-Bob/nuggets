package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/kimi"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// fakeKimiAPI stands in for kimi-no-name-wa: POST /api/v1/names answers with
// names (or with answer when set), GET /api/v1/health with health. No test
// reaches a real kimi.
type fakeKimiAPI struct {
	mu     sync.Mutex
	bodies []map[string]any
	answer http.HandlerFunc
	health string
}

func newFakeKimiAPI(t *testing.T) (*fakeKimiAPI, *httptest.Server) {
	t.Helper()
	fake := &fakeKimiAPI{health: "ok"}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/names", func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		fake.mu.Lock()
		fake.bodies = append(fake.bodies, body)
		answer := fake.answer
		fake.mu.Unlock()
		if answer != nil {
			answer(w, r)
			return
		}
		_, _ = io.WriteString(w, `{"id":1,"names":[{"id":1,"name":"Ideanori","explanation":"IDEA + onigiri","technique":"portmanteau","tone":"witty"}]}`)
	})
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		fake.mu.Lock()
		defer fake.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]string{"status": fake.health})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return fake, srv
}

type kimiEnv struct {
	srv      http.Handler
	settings *settings.Store
	fake     *fakeKimiAPI
	fakeURL  string
}

func newKimiEnv(t *testing.T) *kimiEnv {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	settingsStore := settings.NewStore(database)
	fake, fakeSrv := newFakeKimiAPI(t)
	if _, err := kimi.SaveURL(t.Context(), settingsStore, fakeSrv.URL); err != nil {
		t.Fatal(err)
	}
	return &kimiEnv{
		srv:      NewServer(idea.NewStore(database), settingsStore, nil, nil, kimi.NewClient(settingsStore, nil), nil, nil, nil),
		settings: settingsStore,
		fake:     fake,
		fakeURL:  fakeSrv.URL,
	}
}

func errorMessage(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error %s: %v", rec.Body, err)
	}
	return body.Error.Message
}

func TestKimiSettingsRoundTrip(t *testing.T) {
	e := newKimiEnv(t)

	rec := do(t, e.srv, "PUT", "/api/settings/kimi", map[string]any{"url": " http://127.0.0.1:7800/ "})
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"url":"http://127.0.0.1:7800"}` {
		t.Fatalf("PUT = %d %s, want the saved URL without its slash", rec.Code, rec.Body)
	}
	rec = do(t, e.srv, "GET", "/api/settings/kimi", nil)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"url":"http://127.0.0.1:7800"}` {
		t.Errorf("GET = %d %s", rec.Code, rec.Body)
	}
}

func TestKimiSettingsRejectsABadURL(t *testing.T) {
	e := newKimiEnv(t)
	rec := do(t, e.srv, "PUT", "/api/settings/kimi", map[string]any{"url": "127.0.0.1:7800"})
	if rec.Code != http.StatusBadRequest || errorMessage(t, rec) != kimi.ErrInvalidURL.Error() {
		t.Errorf("PUT = %d %s, want 400 with the URL message", rec.Code, rec.Body)
	}
	if got, _ := kimi.LoadURL(t.Context(), e.settings); got != e.fakeURL {
		t.Errorf("stored URL = %q, want the old one kept", got)
	}
}

func TestKimiHealth(t *testing.T) {
	e := newKimiEnv(t)
	if rec := do(t, e.srv, "GET", "/api/kimi/health", nil); strings.TrimSpace(rec.Body.String()) != `{"available":true}` {
		t.Errorf("health = %d %s, want available", rec.Code, rec.Body)
	}
	e.fake.mu.Lock()
	e.fake.health = "degraded"
	e.fake.mu.Unlock()
	if rec := do(t, e.srv, "GET", "/api/kimi/health", nil); strings.TrimSpace(rec.Body.String()) != `{"available":false}` {
		t.Errorf("degraded health = %d %s, want unavailable", rec.Code, rec.Body)
	}
}

func TestKimiNamesPassesNotesAndAvoid(t *testing.T) {
	e := newKimiEnv(t)
	rec := do(t, e.srv, "POST", "/api/kimi/names", map[string]any{"notes": "  a bank for little ideas  ", "avoid": []string{"Nugglet"}})
	if rec.Code != http.StatusOK {
		t.Fatalf("names = %d %s", rec.Code, rec.Body)
	}
	want := `{"names":[{"name":"Ideanori","explanation":"IDEA + onigiri","technique":"portmanteau","tone":"witty"}]}`
	if strings.TrimSpace(rec.Body.String()) != want {
		t.Errorf("body = %s, want %s", rec.Body, want)
	}
	sent := e.fake.bodies[0]
	if sent["description"] != "a bank for little ideas" {
		t.Errorf("description = %q, want the trimmed notes", sent["description"])
	}
	if avoid, _ := sent["avoid"].([]any); len(avoid) != 1 || avoid[0] != "Nugglet" {
		t.Errorf("avoid = %v", sent["avoid"])
	}
}

func TestKimiNamesRejectsBadRequests(t *testing.T) {
	e := newKimiEnv(t)
	tooMany := make([]string, 501)
	for i := range tooMany {
		tooMany[i] = "n"
	}
	for name, body := range map[string]any{
		"blank notes":   map[string]any{"notes": "  \n "},
		"missing notes": map[string]any{},
		"avoid > 500":   map[string]any{"notes": "x", "avoid": tooMany},
	} {
		if rec := do(t, e.srv, "POST", "/api/kimi/names", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, rec.Code, rec.Body)
		}
	}
	if len(e.fake.bodies) != 0 {
		t.Errorf("kimi was asked %d times, want 0", len(e.fake.bodies))
	}
}

func TestKimiNamesErrorPassthrough(t *testing.T) {
	cases := map[string]int{
		"ollama_unreachable": http.StatusServiceUnavailable,
		"model_missing":      http.StatusServiceUnavailable,
		"no_names":           http.StatusBadGateway,
		"model_timeout":      http.StatusBadGateway,
	}
	for code, want := range cases {
		t.Run(code, func(t *testing.T) {
			e := newKimiEnv(t)
			e.fake.answer = func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = io.WriteString(w, `{"error":{"message":"secret kimi detail","code":"`+code+`"}}`)
			}
			rec := do(t, e.srv, "POST", "/api/kimi/names", map[string]any{"notes": "x"})
			if rec.Code != want {
				t.Errorf("status = %d, want %d", rec.Code, want)
			}
			if msg := errorMessage(t, rec); msg == "" || strings.Contains(msg, "secret kimi detail") {
				t.Errorf("message = %q, want nuggets' own text, not kimi's", msg)
			}
		})
	}

	t.Run("kimi not running", func(t *testing.T) {
		e := newKimiEnv(t)
		if _, err := kimi.SaveURL(t.Context(), e.settings, "http://127.0.0.1:1"); err != nil {
			t.Fatal(err)
		}
		if rec := do(t, e.srv, "POST", "/api/kimi/names", map[string]any{"notes": "x"}); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("status = %d, want 503", rec.Code)
		}
	})
}
