package httpapi

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
)

// defaultHeartbeat is how often an idle event stream gets a comment line, so
// nothing between here and the browser decides the connection is dead.
const defaultHeartbeat = 20 * time.Second

// streamWriteTimeout bounds each write to an event stream, so a client that
// stopped reading can't pin its handler forever.
const streamWriteTimeout = 10 * time.Second

// eventsHandler serves GET /api/events: a server-sent event stream telling
// the page when to refetch (see internal/events). It never touches the
// database; the page refetches through the regular routes.
type eventsHandler struct {
	broker    *events.Broker
	heartbeat time.Duration
}

func (h *eventsHandler) stream(w http.ResponseWriter, r *http.Request) {
	if h.broker == nil {
		writeError(w, http.StatusNotFound, "Not found.")
		return
	}
	updates, cancel := h.broker.Subscribe()
	defer cancel()

	rc := http.NewResponseController(w)
	header := w.Header()
	header.Set("Content-Type", "text/event-stream")
	header.Set("Cache-Control", "no-cache")
	header.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	write := func(chunk string) bool {
		// Not every ResponseWriter supports deadlines (httptest's recorder
		// doesn't); writing without one is still correct.
		_ = rc.SetWriteDeadline(time.Now().Add(streamWriteTimeout))
		if _, err := fmt.Fprint(w, chunk); err != nil {
			return false
		}
		return rc.Flush() == nil
	}

	// retry: how long EventSource waits before reconnecting after the stream
	// ends (a restart, or this subscriber dropped for falling behind).
	if !write("retry: 3000\n: connected\n\n") {
		return
	}

	ticker := time.NewTicker(h.heartbeat)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case e, ok := <-updates:
			if !ok {
				return // dropped as too slow, or the server is shutting down
			}
			if !write(fmt.Sprintf("event: %s\ndata: {}\n\n", e)) {
				return
			}
		case <-ticker.C:
			if !write(": heartbeat\n\n") {
				return
			}
		}
	}
}
