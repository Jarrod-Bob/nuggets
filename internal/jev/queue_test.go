package jev

import (
	"context"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func TestNothingIsQueuedWithoutAKey(t *testing.T) {
	e := newTestEnv(t)
	n := e.create(t, "Dark mode", "")
	title := "Darker mode"
	if _, err := e.ideas.Update(context.Background(), n.ID, idea.Draft{Title: &title}); err != nil {
		t.Fatal(err)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d with no key, want 0", got)
	}
}

func TestAContentChangeQueuesOneCheckPerNugget(t *testing.T) {
	e := newTestEnv(t)
	e.setKey(t, testKey)
	ctx := context.Background()
	n := e.create(t, "Dark mode", "")
	for _, notes := range []string{"one", "two", "three"} {
		if _, err := e.ideas.Update(ctx, n.ID, idea.Draft{Notes: &notes}); err != nil {
			t.Fatal(err)
		}
	}
	if got := e.pending(t); got != 1 {
		t.Errorf("pending = %d after a create and three edits, want 1", got)
	}
	e.create(t, "Light mode", "")
	if got := e.pending(t); got != 2 {
		t.Errorf("pending = %d after a second nugget, want 2", got)
	}
}

func TestATagsOnlySaveQueuesNothing(t *testing.T) {
	e := newTestEnv(t)
	n := e.create(t, "Dark mode", "")
	e.setKey(t, testKey)
	if _, err := e.ideas.Update(context.Background(), n.ID, idea.Draft{Tags: &[]string{"ui"}}); err != nil {
		t.Fatal(err)
	}
	if got := e.pending(t); got != 0 {
		t.Errorf("pending = %d after a tags-only save, want 0", got)
	}
}
