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
	srv := httptest.NewServer(NewServer(nil, nil, nil, nil, broker, nil))
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
	srv := httptest.NewServer(NewServer(nil, nil, nil, nil, broker, nil))
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
