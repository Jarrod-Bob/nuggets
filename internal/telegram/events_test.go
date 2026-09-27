package telegram

import (
	"context"
	"sync"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/events"
)

type recorder struct {
	mu     sync.Mutex
	events []events.Event
}

func (r *recorder) Publish(e events.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}

func (r *recorder) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.events)
}

func TestDrainPublishesOncePerBatchThatSavesNuggets(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{
			{UpdateID: 10, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "One"}},
			{UpdateID: 11, Message: &Message{MessageID: 2, Chat: Chat{ID: 555}, Text: "Two"}},
		},
		// Only a stranger's message: nothing saved, nothing announced.
		{{UpdateID: 12, Message: &Message{MessageID: 3, Chat: Chat{ID: 999}, Text: "Spam"}}},
	}}
	rec := &recorder{}
	poller, settingsStore, _ := newTestPoller(t, fake, WithEvents(rec))
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	if got := rec.count(); got != 1 {
		t.Fatalf("events after a batch of two nuggets = %d, want 1", got)
	}
	if rec.events[0] != events.IdeasChanged {
		t.Errorf("event = %q, want %q", rec.events[0], events.IdeasChanged)
	}

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("second Drain: %v", err)
	}
	if got := rec.count(); got != 1 {
		t.Errorf("events after a batch that saved nothing = %d, want still 1", got)
	}
}
