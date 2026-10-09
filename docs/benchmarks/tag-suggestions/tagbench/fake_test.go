package tagbench

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// fakeAnthropic is just enough of POST /v1/messages: it records each body
// and answers with the next scripted handler, or with reply. It never talks
// to the real API.
type fakeAnthropic struct {
	mu     sync.Mutex
	bodies []map[string]any
	script []http.HandlerFunc
	reply  func(body map[string]any) (text string, stop string)
}

func newFakeAnthropic(t *testing.T) (*fakeAnthropic, *httptest.Server) {
	t.Helper()
	f := &fakeAnthropic{reply: func(map[string]any) (string, string) { return "{}", "end_turn" }}
	srv := httptest.NewServer(http.HandlerFunc(f.handle))
	t.Cleanup(srv.Close)
	return f, srv
}

func (f *fakeAnthropic) handle(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/v1/messages" {
		http.NotFound(w, r)
		return
	}
	raw, _ := io.ReadAll(r.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	f.mu.Lock()
	f.bodies = append(f.bodies, body)
	var scripted http.HandlerFunc
	if len(f.script) > 0 {
		scripted, f.script = f.script[0], f.script[1:]
	}
	reply := f.reply
	f.mu.Unlock()
	if scripted != nil {
		scripted(w, r)
		return
	}
	text, stop := reply(body)
	writeMessage(w, text, stop, 120, 40)
}

func writeMessage(w http.ResponseWriter, text, stop string, in, out int) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"id": "msg_test", "type": "message", "role": "assistant", "model": "claude-haiku-5-5",
		"content":     []map[string]any{{"type": "text", "text": text}},
		"stop_reason": stop, "stop_sequence": nil,
		"usage": map[string]any{"input_tokens": in, "output_tokens": out},
	})
}

func anthropicError(status int, retryAfter string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if retryAfter != "" {
			w.Header().Set("Retry-After", retryAfter)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write([]byte(`{"type":"error","error":{"type":"rate_limit_error","message":"slow down"}}`))
	}
}

// fakeTypeSafe answers each noul with the probability set for its tag (0.1
// otherwise) and reports usage. It never talks to the real TypeSafe.
type fakeTypeSafe struct {
	mu       sync.Mutex
	answers  map[string]float64
	requests []map[string]any
	script   []http.HandlerFunc
}

func newFakeTypeSafe(t *testing.T) (*fakeTypeSafe, *httptest.Server) {
	t.Helper()
	f := &fakeTypeSafe{answers: map[string]float64{}}
	srv := httptest.NewServer(http.HandlerFunc(f.handle))
	t.Cleanup(srv.Close)
	return f, srv
}

func (f *fakeTypeSafe) handle(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(r.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	f.mu.Lock()
	f.requests = append(f.requests, body)
	var scripted http.HandlerFunc
	if len(f.script) > 0 {
		scripted, f.script = f.script[0], f.script[1:]
	}
	f.mu.Unlock()
	if scripted != nil {
		scripted(w, r)
		return
	}
	answers := map[string]any{}
	questions, _ := body["questions"].(map[string]any)
	for id, q := range questions {
		tag := q.(map[string]any)["instructions"].(map[string]any)["tag"].(string)
		f.mu.Lock()
		p, ok := f.answers[tag]
		f.mu.Unlock()
		if !ok {
			p = 0.1
		}
		answers[id] = map[string]any{"type": "noul", "noul": p}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"model": "jev-1.13.0", "answers": answers,
		"usage": map[string]any{"input_tokens": 300 * len(questions), "output_tokens": 20},
	})
}
