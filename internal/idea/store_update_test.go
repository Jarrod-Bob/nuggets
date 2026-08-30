package idea

import (
	"context"
	"errors"
	"testing"
)

func TestUpdateReplacesEntireTagSet(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{Title: "Original", Tags: []string{"go", "saas"}})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	updated, err := store.Update(ctx, created.ID, Draft{
		Title: "Renamed", Notes: "new notes", Tags: []string{"weekend"},
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

	created, _ := store.Create(ctx, Draft{Title: "Tagged", Tags: []string{"go"}})
	updated, err := store.Update(ctx, created.ID, Draft{Title: "Tagged", Tags: []string{}})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if len(updated.Tags) != 0 {
		t.Errorf("Tags = %v, want empty", updated.Tags)
	}
}

func TestUpdateRejectsBlankTitle(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Has a title"})
	_, err := store.Update(ctx, created.ID, Draft{Title: "   "})
	if !errors.Is(err, ErrEmptyTitle) {
		t.Errorf("Update() error = %v, want ErrEmptyTitle", err)
	}
}

func TestUpdateMissingReturnsErrNotFound(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Update(context.Background(), 9999, Draft{Title: "Ghost"})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Update() error = %v, want ErrNotFound", err)
	}
}

func TestUpdateAdvancesUpdatedAt(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Original"})
	updated, err := store.Update(ctx, created.ID, Draft{Title: "Changed"})
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
