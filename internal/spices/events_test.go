package spices

import (
	"context"
	"sync"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/events"
)

// recorder is an events.Publisher that remembers what it was told.
type recorder struct {
	mu     sync.Mutex
	events []events.Event
}

func (r *recorder) Publish(e events.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}

func (r *recorder) count(e events.Event) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for _, got := range r.events {
		if got == e {
			n++
		}
	}
	return n
}

func TestDrainPublishesOnceForAPassThatImports(t *testing.T) {
	fake := &fakeSpices{}
	for i := int64(1); i <= 5; i++ {
		fake.items = append(fake.items, ideaItem(i, i, "Idea", ""))
	}
	rec := &recorder{}
	// Three pages in one pass: still one event.
	h := newHarness(t, fake, WithPageLimit(2), WithEvents(rec))
	h.connect(t, testToken)

	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	if got := rec.count(events.IdeasChanged); got != 1 {
		t.Errorf("ideas-changed after importing 5 items over 3 pages = %d, want 1", got)
	}
	if got := rec.count(events.SpicesStatus); got != 1 {
		t.Errorf("spices-status after recording the sync = %d, want 1", got)
	}

	// Nothing new: the sync time moves, the nuggets don't.
	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("second Drain: %v", err)
	}
	if got := rec.count(events.IdeasChanged); got != 1 {
		t.Errorf("ideas-changed after a pass that changed nothing = %d, want still 1", got)
	}
	if got := rec.count(events.SpicesStatus); got != 2 {
		t.Errorf("spices-status after the second sync = %d, want 2", got)
	}
}

func TestDrainReplayPublishesNoIdeasChanged(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "Idea", "")}}
	rec := &recorder{}
	h := newHarness(t, fake, WithEvents(rec))
	h.connect(t, testToken)
	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	// Rewind the cursor so the same item is pulled again: a no-op write.
	if err := h.settings.Set(context.Background(), KeyCursor, "0"); err != nil {
		t.Fatal(err)
	}
	if err := h.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("replay Drain: %v", err)
	}
	if got := rec.count(events.IdeasChanged); got != 1 {
		t.Errorf("ideas-changed after a replay = %d, want 1 (the first pass only)", got)
	}
}

func TestStatusChangesPublishSpicesStatus(t *testing.T) {
	fake := &fakeSpices{items: []fakeItem{ideaItem(1, 1, "Idea", "")}}
	rec := &recorder{}
	h := newHarness(t, fake, WithEvents(rec))
	h.connect(t, testToken)
	ctx := context.Background()

	// A 409 sets needs-resync.
	if err := h.settings.Set(ctx, KeyCursor, "99"); err != nil {
		t.Fatal(err)
	}
	if err := h.syncer.Drain(ctx); err == nil {
		t.Fatal("Drain past the latest rev succeeded, want a 409")
	}
	if got := rec.count(events.SpicesStatus); got != 1 {
		t.Fatalf("spices-status after a 409 = %d, want 1", got)
	}

	// An error message is published once, not again while it stays the same.
	h.settings.Delete(ctx, KeyNeedsResync)
	h.settings.Delete(ctx, KeyLastError)
	h.syncer.recordError(ctx, "Couldn't reach spices.")
	h.syncer.recordError(ctx, "Couldn't reach spices.")
	if got := rec.count(events.SpicesStatus); got != 2 {
		t.Fatalf("spices-status after one new error = %d, want 2", got)
	}

	// Settings changed through Reset.
	if err := h.syncer.Reset(func() error { return nil }); err != nil {
		t.Fatal(err)
	}
	if got := rec.count(events.SpicesStatus); got != 3 {
		t.Fatalf("spices-status after Reset = %d, want 3", got)
	}
}
