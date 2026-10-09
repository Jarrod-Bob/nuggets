// Package events tells open browser tabs that something changed in the
// background, so they refetch instead of waiting for a reload. Importers
// publish a small named Event after their writes commit; the Broker fans it
// out to every GET /api/events stream (internal/httpapi/events.go). The
// GitHub sender publishes the same way when a feature request lands, and the
// jev Suggester when a tag check changes a nugget's suggestions. An event
// carries no data: the page refetches what it shows through the regular API.
package events

import "sync"

// Event names one kind of change. The value is the SSE event name the
// frontend listens for (web/src/live/LiveUpdates.tsx).
type Event string

const (
	// IdeasChanged means a background import created, refreshed, archived or
	// detached nuggets. Sent at most once per sync pass, never per item.
	IdeasChanged Event = "ideas-changed"
	// SpicesStatus means the spices status shown in settings changed: the
	// last sync time, the last error, or needs-resync.
	SpicesStatus Event = "spices-status"
	// GitHubChanged means a nugget's feature request was created, failed or
	// is waiting to retry, or the GitHub status shown in settings changed.
	GitHubChanged Event = "github-changed"
	// TagSuggestionsChanged means a tag check changed a nugget's open tag
	// suggestions, or the tag-suggestion status shown in settings changed.
	TagSuggestionsChanged Event = "tag-suggestions-changed"
)

// Publisher is what an importer needs to announce a change. Publish must
// never block the caller.
type Publisher interface {
	Publish(Event)
}

// Nop discards every event. Importers built without a Publisher use it.
type Nop struct{}

func (Nop) Publish(Event) {}

// subscriberBuffer is how many events a subscriber may fall behind before it
// is dropped. Events are batched per sync pass, so a stream this far behind
// has stopped reading; dropping it ends its HTTP response, and the browser's
// EventSource reconnects and refetches everything.
const subscriberBuffer = 16

// Broker is an in-process fan-out from publishers to subscribers. Publish
// never blocks: a subscriber whose buffer is full is dropped (its channel
// closed) rather than holding up a sync loop.
type Broker struct {
	mu     sync.Mutex
	subs   map[chan Event]struct{}
	closed bool
}

func NewBroker() *Broker {
	return &Broker{subs: map[chan Event]struct{}{}}
}

// Subscribe returns a channel of events and a function that ends the
// subscription. The channel is closed when the subscription ends, when the
// subscriber falls too far behind, or when the broker is closed; after
// Close, Subscribe returns an already closed channel. cancel is safe to call
// more than once.
func (b *Broker) Subscribe() (events <-chan Event, cancel func()) {
	ch := make(chan Event, subscriberBuffer)
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		close(ch)
		return ch, func() {}
	}
	b.subs[ch] = struct{}{}
	return ch, func() { b.drop(ch) }
}

// Publish sends e to every subscriber without waiting for any of them.
func (b *Broker) Publish(e Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.subs {
		select {
		case ch <- e:
		default:
			delete(b.subs, ch)
			close(ch)
		}
	}
}

// Close ends every subscription and refuses new ones, so open streams return
// and an http.Server shutdown isn't held up by them.
func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.closed = true
	for ch := range b.subs {
		delete(b.subs, ch)
		close(ch)
	}
}

func (b *Broker) drop(ch chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.subs[ch]; ok {
		delete(b.subs, ch)
		close(ch)
	}
}
