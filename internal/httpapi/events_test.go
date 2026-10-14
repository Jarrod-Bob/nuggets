package httpapi

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
)

// openStream GETs /api/events on srv and returns the response and a reader
// of its lines. The stream is closed when the test ends.
func openStream(t *testing.T, srv *httptest.Server) (*http.Response, *bufio.Reader) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("GET /api/events: %v", err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp, bufio.NewReader(resp.Body)
}

// readUntil reads lines until one equals want, failing after a second.
func readUntil(t *testing.T, r *bufio.Reader, want string) {
	t.Helper()
	found := make(chan error, 1)
	go func() {
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				found <- err
				return
			}
			if strings.TrimRight(line, "\n") == want {
				found <- nil
				return
			}
		}
	}()
	select {
	case err := <-found:
		if err != nil {
			t.Fatalf("stream ended before %q: %v", want, err)
		}
	case <-time.After(time.Second):
		t.Fatalf("no %q line within a second", want)
	}
}

func TestEventsStreamSendsPublishedEvents(t *testing.T) {
	broker := events.NewBroker()
	srv := httptest.NewServer(NewServer(nil, nil, nil, nil, nil, nil, broker, nil))
	t.Cleanup(srv.Close)

	resp, r := openStream(t, srv)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Type"); got != "text/event-stream" {
		t.Errorf("Content-Type = %q, want text/event-stream", got)
	}
	if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
		t.Errorf("Cache-Control = %q, want no-cache", got)
	}
	readUntil(t, r, "retry: 3000")

	// The handler subscribed before answering, so this can't be missed.
	broker.Publish(events.IdeasChanged)
	readUntil(t, r, "event: ideas-changed")
	readUntil(t, r, "data: {}")
}

func TestEventsStreamHeartbeatsWhileIdle(t *testing.T) {
	h := &eventsHandler{broker: events.NewBroker(), heartbeat: 10 * time.Millisecond}
	srv := httptest.NewServer(http.HandlerFunc(h.stream))
	t.Cleanup(srv.Close)

	_, r := openStream(t, srv)
	readUntil(t, r, ": heartbeat")
	readUntil(t, r, ": heartbeat")
}

func TestEventsStreamEndsWhenTheBrokerCloses(t *testing.T) {
	broker := events.NewBroker()
	srv := httptest.NewServer(NewServer(nil, nil, nil, nil, nil, nil, broker, nil))
	t.Cleanup(srv.Close)

	_, r := openStream(t, srv)
	readUntil(t, r, "retry: 3000")
	broker.Close()

	ended := make(chan struct{})
	go func() {
		for {
			if _, err := r.ReadString('\n'); err != nil {
				close(ended)
				return
			}
		}
	}()
	select {
	case <-ended:
	case <-time.After(time.Second):
		t.Fatal("stream still open after the broker closed")
	}
}

// TestNuggetWritesPublishIdeasChanged: a hand edit in one tab reaches every
// other open page, so each of the API's nugget writes announces itself once
// it has committed.
func TestNuggetWritesPublishIdeasChanged(t *testing.T) {
	broker := events.NewBroker()
	t.Cleanup(broker.Close)
	srv := newTestServerWith(t, broker)
	ch, cancel := broker.Subscribe()
	defer cancel()

	do := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		return rec
	}
	expectEvent := func(step string) {
		t.Helper()
		select {
		case e := <-ch:
			if e != events.IdeasChanged {
				t.Fatalf("%s: published %q, want %q", step, e, events.IdeasChanged)
			}
		case <-time.After(time.Second):
			t.Fatalf("%s: no ideas-changed event", step)
		}
	}
	expectQuiet := func(step string) {
		t.Helper()
		select {
		case e := <-ch:
			t.Fatalf("%s: published %q, want nothing", step, e)
		default:
		}
	}

	if rec := do("POST", "/api/ideas", `{"title":"a pickle","description":"x"}`); rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	expectEvent("create")
	if rec := do("PATCH", "/api/ideas/1", `{"title":"a better pickle"}`); rec.Code != http.StatusOK {
		t.Fatalf("edit: %d %s", rec.Code, rec.Body)
	}
	expectEvent("edit")
	if rec := do("POST", "/api/ideas/1/archive", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("bin: %d", rec.Code)
	}
	expectEvent("bin")
	if rec := do("POST", "/api/ideas/1/restore", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("restore: %d", rec.Code)
	}
	expectEvent("restore")
	if rec := do("DELETE", "/api/ideas/1", ""); rec.Code != http.StatusNoContent {
		t.Fatalf("purge: %d", rec.Code)
	}
	expectEvent("purge")

	// A write that fails commits nothing, so announces nothing.
	if rec := do("PATCH", "/api/ideas/999", `{"title":"ghost"}`); rec.Code != http.StatusNotFound {
		t.Fatalf("edit missing: %d", rec.Code)
	}
	expectQuiet("failed edit")
}
