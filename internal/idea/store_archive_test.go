package idea

import (
	"context"
	"errors"
	"testing"
)

func TestArchiveSetsArchivedAt(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Bin me"})
	if err := store.Archive(ctx, created.ID); err != nil {
		t.Fatalf("Archive() error = %v", err)
	}

	got, err := store.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get() error = %v — archiving must not delete the row", err)
	}
	if got.ArchivedAt == nil {
		t.Error("ArchivedAt = nil, want a timestamp")
	}
}

func TestRestoreClearsArchivedAt(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Back again"})
	if err := store.Archive(ctx, created.ID); err != nil {
		t.Fatalf("Archive() error = %v", err)
	}
	if err := store.Restore(ctx, created.ID); err != nil {
		t.Fatalf("Restore() error = %v", err)
	}

	got, _ := store.Get(ctx, created.ID)
	if got.ArchivedAt != nil {
		t.Errorf("ArchivedAt = %v, want nil after restore", got.ArchivedAt)
	}
}

func TestPurgeRemovesIdeaAndItsTagLinks(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Gone", Tags: []string{"go"}})
	if err := store.Purge(ctx, created.ID); err != nil {
		t.Fatalf("Purge() error = %v", err)
	}

	if _, err := store.Get(ctx, created.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get() error = %v, want ErrNotFound", err)
	}

	// ON DELETE CASCADE only fires because the foreign_keys pragma is set.
	var links int
	if err := store.db.QueryRow(
		"SELECT COUNT(*) FROM idea_tags WHERE idea_id = ?", created.ID,
	).Scan(&links); err != nil {
		t.Fatalf("counting links: %v", err)
	}
	if links != 0 {
		t.Errorf("idea_tags rows = %d, want 0 (cascade should have fired)", links)
	}
}

func TestArchiveRestorePurgeMissingReturnErrNotFound(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if err := store.Archive(ctx, 9999); !errors.Is(err, ErrNotFound) {
		t.Errorf("Archive(9999) = %v, want ErrNotFound", err)
	}
	if err := store.Restore(ctx, 9999); !errors.Is(err, ErrNotFound) {
		t.Errorf("Restore(9999) = %v, want ErrNotFound", err)
	}
	if err := store.Purge(ctx, 9999); !errors.Is(err, ErrNotFound) {
		t.Errorf("Purge(9999) = %v, want ErrNotFound", err)
	}
}
