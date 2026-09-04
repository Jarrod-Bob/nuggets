package idea

import (
	"context"
	"errors"
	"testing"
)

func TestUpdateReplacesEntireTagSet(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{Title: ptr("Original"), Tags: ptr([]string{"go", "saas"})})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	updated, err := store.Update(ctx, created.ID, Draft{
		Title: ptr("Renamed"), Notes: ptr("new notes"), Tags: ptr([]string{"weekend"}),
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}

	if len(updated.Tags) != 1 || updated.Tags[0] != "weekend" {
		t.Errorf("Tags = %v, want [weekend] — PATCH replaces, never merges", updated.Tags)
	}
	if updated.Title != "Renamed" {
		t.Errorf("Title = %q, want Renamed", updated.Title)
	}
	if updated.Notes != "new notes" {
		t.Errorf("Notes = %q, want %q", updated.Notes, "new notes")
	}
}

func TestUpdateWithEmptyTagsClearsThem(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Tagged"), Tags: ptr([]string{"go"})})
	// A present-but-empty array is a deliberate clear, distinct from absent.
	updated, err := store.Update(ctx, created.ID, Draft{Tags: ptr([]string{})})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if len(updated.Tags) != 0 {
		t.Errorf("Tags = %v, want empty", updated.Tags)
	}
}

func TestUpdateRejectsBlankTitleWhenPresent(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Has a title")})
	_, err := store.Update(ctx, created.ID, Draft{Title: ptr("   ")})
	if !errors.Is(err, ErrEmptyTitle) {
		t.Errorf("Update() error = %v, want ErrEmptyTitle", err)
	}
}

func TestUpdateMissingReturnsErrNotFound(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Update(context.Background(), 9999, Draft{Title: ptr("Ghost")})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Update() error = %v, want ErrNotFound", err)
	}
}

func TestUpdateAdvancesUpdatedAt(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Original")})
	updated, err := store.Update(ctx, created.ID, Draft{Title: ptr("Changed")})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if !updated.UpdatedAt.After(created.UpdatedAt) && !updated.UpdatedAt.Equal(created.UpdatedAt) {
		t.Errorf("UpdatedAt went backwards: %v before %v", updated.UpdatedAt, created.UpdatedAt)
	}
	if !updated.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("CreatedAt changed: %v, want %v", updated.CreatedAt, created.CreatedAt)
	}
}

// --- Partial save: absent means unchanged (spec §"The save behaviour has to
// change first"). These are the reason Draft became pointers. ---

func TestUpdateWithOnlyStatusLeavesEverythingElse(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{
		Title: ptr("Keep me"), Notes: ptr("all my notes"), Tags: ptr([]string{"go", "saas"}),
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	updated, err := store.Update(ctx, created.ID, Draft{Status: ptr(StatusBuilding)})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}

	if updated.Status != StatusBuilding {
		t.Errorf("Status = %q, want building", updated.Status)
	}
	if updated.Title != "Keep me" {
		t.Errorf("Title = %q, want it untouched", updated.Title)
	}
	if updated.Notes != "all my notes" {
		t.Errorf("Notes = %q, want it untouched", updated.Notes)
	}
	if len(updated.Tags) != 2 {
		t.Errorf("Tags = %v, want the original two untouched", updated.Tags)
	}
}

func TestUpdateWithOnlyTitleLeavesTagsUntouched(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	// The case that was broken before Draft became pointers: a save omitting
	// tags used to wipe every tag.
	created, _ := store.Create(ctx, Draft{Title: ptr("Old"), Tags: ptr([]string{"go", "saas"})})

	updated, err := store.Update(ctx, created.ID, Draft{Title: ptr("New")})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if updated.Title != "New" {
		t.Errorf("Title = %q, want New", updated.Title)
	}
	if len(updated.Tags) != 2 {
		t.Errorf("Tags = %v, want [go saas] preserved — omitting tags must not wipe them", updated.Tags)
	}
}

func TestUpdateWithNothingPresentIsANoOp(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{
		Title: ptr("Untouched"), Notes: ptr("notes"), Tags: ptr([]string{"go"}),
	})

	updated, err := store.Update(ctx, created.ID, Draft{})
	if err != nil {
		t.Fatalf("Update() with empty body error = %v, want the current nugget", err)
	}
	if updated.Title != "Untouched" || updated.Notes != "notes" || len(updated.Tags) != 1 {
		t.Errorf("no-op update changed the nugget: %+v", updated)
	}
	// updated_at is not advanced on a no-op — nothing was written.
	if !updated.UpdatedAt.Equal(created.UpdatedAt) {
		t.Errorf("UpdatedAt = %v, want %v (no-op must not touch it)", updated.UpdatedAt, created.UpdatedAt)
	}
}

func TestUpdateRejectsUnknownStatus(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: ptr("Real")})
	bogus := Status("shipping")
	_, err := store.Update(ctx, created.ID, Draft{Status: &bogus})
	if !errors.Is(err, ErrInvalidStatus) {
		t.Errorf("Update() error = %v, want ErrInvalidStatus", err)
	}
}
