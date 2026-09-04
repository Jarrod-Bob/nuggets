package idea

import (
	"context"
	"errors"
	"testing"
)

func TestRandomReturnsAStoredIdea(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	got, err := store.Random(ctx, "")
	if err != nil {
		t.Fatalf("Random() error = %v", err)
	}
	valid := map[string]bool{"Idea bank": true, "Tiny CLI": true, "Recipe sorter": true}
	if !valid[got.Title] {
		t.Errorf("Title = %q, not one of the seeded ideas", got.Title)
	}
}

func TestRandomEventuallyVaries(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	seen := map[string]bool{}
	for i := 0; i < 40; i++ {
		got, err := store.Random(ctx, "")
		if err != nil {
			t.Fatalf("Random() error = %v", err)
		}
		seen[got.Title] = true
	}
	if len(seen) < 2 {
		t.Errorf("40 draws returned only %v — not random", seen)
	}
}

func TestRandomRespectsTagFilter(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	for i := 0; i < 10; i++ {
		got, err := store.Random(ctx, "weekend")
		if err != nil {
			t.Fatalf("Random() error = %v", err)
		}
		if got.Title != "Recipe sorter" {
			t.Fatalf("Title = %q, want the only #weekend idea", got.Title)
		}
	}
}

func TestRandomExcludesArchived(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Binned")})
	if err := store.archiveForTest(ctx, created.ID); err != nil {
		t.Fatalf("archiving: %v", err)
	}

	_, err := store.Random(ctx, "")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Random() error = %v, want ErrNotFound — archived must not be drawn", err)
	}
}

func TestRandomOnEmptyBankReturnsErrNotFound(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Random(context.Background(), "")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Random() error = %v, want ErrNotFound", err)
	}
}

func TestRandomOnlyDrawsLiveStatuses(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	// Two dead ideas and one live: many draws must only ever return the live one.
	if _, err := store.Create(ctx, Draft{Title: ptr("Parked"), Status: ptr(StatusParked)}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := store.Create(ctx, Draft{Title: ptr("Killed"), Status: ptr(StatusKilled)}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := store.Create(ctx, Draft{Title: ptr("Exploring"), Status: ptr(StatusExploring)}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	for i := 0; i < 25; i++ {
		got, err := store.Random(ctx, "")
		if err != nil {
			t.Fatalf("Random() error = %v", err)
		}
		if got.Title != "Exploring" {
			t.Fatalf("drew %q (%s), want only the live idea", got.Title, got.Status)
		}
	}
}

func TestRandomOnBankOfOnlyDeadIdeasReturnsEmptyState(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if _, err := store.Create(ctx, Draft{Title: ptr("Parked"), Status: ptr(StatusParked)}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := store.Create(ctx, Draft{Title: ptr("Killed"), Status: ptr(StatusKilled)}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	// The empty case is ErrNotFound, which the API turns into the "nothing to
	// draw" empty state — not an error.
	_, err := store.Random(ctx, "")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Random() error = %v, want ErrNotFound for a bank of only dead ideas", err)
	}
}

func TestTagsCountsOnlyActiveIdeas(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	got, err := store.Tags(ctx)
	if err != nil {
		t.Fatalf("Tags() error = %v", err)
	}
	counts := map[string]int{}
	for _, tag := range got {
		counts[tag.Name] = tag.Count
	}
	if counts["go"] != 2 {
		t.Errorf("go count = %d, want 2", counts["go"])
	}
	if counts["weekend"] != 1 {
		t.Errorf("weekend count = %d, want 1", counts["weekend"])
	}
}

func TestTagsOmitsTagsWithOnlyArchivedIdeas(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Only user of this tag"), Tags: ptr([]string{"orphan"})})
	if err := store.archiveForTest(ctx, created.ID); err != nil {
		t.Fatalf("archiving: %v", err)
	}

	got, err := store.Tags(ctx)
	if err != nil {
		t.Fatalf("Tags() error = %v", err)
	}
	for _, tag := range got {
		if tag.Name == "orphan" {
			t.Error("orphan tag still offered for autocomplete")
		}
	}
}
