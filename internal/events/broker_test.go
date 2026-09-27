package events

import (
	"testing"
	"time"
)

func receive(t *testing.T, ch <-chan Event) (Event, bool) {
	t.Helper()
	select {
	case e, ok := <-ch:
		return e, ok
	case <-time.After(time.Second):
		t.Fatal("no event within a second")
		return "", false
	}
}

func TestBrokerFansOutToEverySubscriber(t *testing.T) {
	b := NewBroker()
	a, cancelA := b.Subscribe()
	defer cancelA()
	c, cancelC := b.Subscribe()
	defer cancelC()

	b.Publish(IdeasChanged)
	b.Publish(SpicesStatus)

	for _, ch := range []<-chan Event{a, c} {
		if e, _ := receive(t, ch); e != IdeasChanged {
			t.Fatalf("first event = %q, want %q", e, IdeasChanged)
		}
		if e, _ := receive(t, ch); e != SpicesStatus {
			t.Fatalf("second event = %q, want %q", e, SpicesStatus)
		}
	}
}

func TestBrokerDropsASlowSubscriberWithoutBlocking(t *testing.T) {
	b := NewBroker()
	slow, cancelSlow := b.Subscribe()
	defer cancelSlow()
	fast, cancelFast := b.Subscribe()
	defer cancelFast()

	done := make(chan struct{})
	go func() {
		defer close(done)
		// One more than the buffer holds: the slow subscriber never reads.
		for i := 0; i <= subscriberBuffer; i++ {
			b.Publish(IdeasChanged)
			<-fast
		}
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a subscriber that stopped reading")
	}

	// The slow channel holds what fit in its buffer and is then closed.
	for i := 0; i < subscriberBuffer; i++ {
		if _, ok := receive(t, slow); !ok {
			t.Fatalf("slow subscriber closed after %d events, want %d buffered first", i, subscriberBuffer)
		}
	}
	if _, ok := receive(t, slow); ok {
		t.Fatal("slow subscriber still open after overflowing its buffer")
	}

	// The fast subscriber is untouched.
	b.Publish(SpicesStatus)
	if e, ok := receive(t, fast); !ok || e != SpicesStatus {
		t.Fatalf("fast subscriber got %q (open %v) after the slow one was dropped", e, ok)
	}
}

func TestBrokerCancelAndClose(t *testing.T) {
	b := NewBroker()
	ch, cancel := b.Subscribe()
	cancel()
	cancel() // idempotent
	if _, ok := receive(t, ch); ok {
		t.Fatal("cancelled subscription still open")
	}
	b.Publish(IdeasChanged) // no subscribers left: must not panic on a closed channel

	open, cancelOpen := b.Subscribe()
	defer cancelOpen()
	b.Close()
	if _, ok := receive(t, open); ok {
		t.Fatal("subscription still open after Close")
	}
	late, cancelLate := b.Subscribe()
	defer cancelLate()
	if _, ok := receive(t, late); ok {
		t.Fatal("Subscribe after Close returned an open channel")
	}
	b.Publish(IdeasChanged) // after Close: a no-op
}
