package idea

import (
	"context"
	"database/sql"
	"testing"
	"time"
)

// detachedNugget imports item, applies edit to it, and detaches it as a
// Re-sync would, returning the nugget as the captain left it.
func detachedNugget(t *testing.T, store *Store, item SyncedItem, edit Draft) *Idea {
	t.Helper()
	ctx := context.Background()
	if result := mustApply(t, store, item); result.Created != 1 {
		t.Fatalf("importing %q: %+v", item.Title, result)
	}
	var id int64
	if err := store.db.QueryRow(`SELECT id FROM ideas WHERE source = ? AND source_ref = ?`, SourceSpices, item.Ref).Scan(&id); err != nil {
		t.Fatalf("finding imported nugget: %v", err)
	}
	if _, err := store.Update(ctx, id, edit); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if _, err := store.DetachSource(ctx, SourceSpices, SourceSpicesDetached, nil); err != nil {
		t.Fatalf("DetachSource: %v", err)
	}
	got, err := store.Get(ctx, id)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	return got
}

func mustReattach(t *testing.T, store *Store, items ...SyncedItem) SyncResult {
	t.Helper()
	result, err := store.ReattachSynced(context.Background(), SourceSpices, SourceSpicesDetached, items, nil)
	if err != nil {
		t.Fatalf("ReattachSynced: %v", err)
	}
	return result
}

func countIdeas(t *testing.T, store *Store) int {
	t.Helper()
	var n int
	if err := store.db.QueryRow(`SELECT COUNT(*) FROM ideas`).Scan(&n); err != nil {
		t.Fatalf("counting: %v", err)
	}
	return n
}

func TestReattachSyncedReattachesASingleMatchKeepingEverything(t *testing.T) {
	ctx := context.Background()
	var contentChanged, tagsAdded []int64
	store := NewStore(openHookTestDB(t),
		WithContentChanged(func(ctx context.Context, tx *sql.Tx, id int64) error {
			contentChanged = append(contentChanged, id)
			return nil
		}),
		WithTagsAdded(func(ctx context.Context, tx *sql.Tx, id int64, added []string) error {
			tagsAdded = append(tagsAdded, id)
			return nil
		}))
	before := detachedNugget(t, store,
		SyncedItem{Ref: "7", Rev: 40, Title: "Price tracker", Notes: "pings me", Tags: []string{"lego"}},
		Draft{Tags: ptr([]string{"lego", "scraper"}), Status: ptr(StatusBuilding), ProjectName: ptr("Brickwatch")})
	if _, err := store.db.Exec(
		`INSERT INTO tag_suggestions (idea_id, tag, state, created_at, updated_at) VALUES (?, 'python', 'dismissed', ?, ?)`,
		before.ID, time.Now().UTC(), time.Now().UTC()); err != nil {
		t.Fatalf("dismissing a suggestion: %v", err)
	}
	contentChanged, tagsAdded = nil, nil

	// The reset spices hands the same idea out under a new id and rev, with
	// different spacing and case.
	result := mustReattach(t, store, SyncedItem{Ref: "3", Rev: 2, Title: "  price   Tracker", Notes: "Pings me\n", Tags: []string{"lego"}})
	if result.Reattached != 1 || result.Created != 0 {
		t.Fatalf("result = %+v, want 1 reattached and nothing created", result)
	}
	if n := countIdeas(t, store); n != 1 {
		t.Fatalf("ideas = %d, want 1 (no copy)", n)
	}

	got, err := store.Get(ctx, before.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Source == nil || *got.Source != SourceSpices || got.SourceRef == nil || *got.SourceRef != "3" {
		t.Errorf("Source/SourceRef = %v/%v, want spices/3", got.Source, got.SourceRef)
	}
	if got.Title != "Price tracker" || got.Notes != "pings me" || got.Status != StatusBuilding ||
		got.ProjectName != "Brickwatch" {
		t.Errorf("got %q / %q / %q / %v, want the captain's nugget unchanged", got.Title, got.Notes, got.Status, got.ProjectName)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "lego" || got.Tags[1] != "scraper" {
		t.Errorf("Tags = %v, want [lego scraper]", got.Tags)
	}
	if !got.UpdatedAt.Equal(before.UpdatedAt) {
		t.Errorf("updated_at moved on reattach: %v -> %v", before.UpdatedAt, got.UpdatedAt)
	}
	var state string
	if err := store.db.QueryRow(`SELECT state FROM tag_suggestions WHERE idea_id = ? AND tag = 'python'`, got.ID).Scan(&state); err != nil || state != "dismissed" {
		t.Errorf("dismissed suggestion = %q, %v; want it kept", state, err)
	}
	var rev int64
	var detachedRef sql.NullString
	if err := store.db.QueryRow(`SELECT source_rev, source_detached_ref FROM ideas WHERE id = ?`, got.ID).Scan(&rev, &detachedRef); err != nil {
		t.Fatalf("reading source columns: %v", err)
	}
	if rev != 2 || detachedRef.Valid {
		t.Errorf("source_rev/source_detached_ref = %d/%v, want 2/NULL", rev, detachedRef)
	}
	if len(contentChanged) != 0 || len(tagsAdded) != 0 {
		t.Errorf("hooks fired on reattach: content %v, tags %v", contentChanged, tagsAdded)
	}

	// From now on the nugget answers to its new id like any spices nugget.
	if result := mustApply(t, store, SyncedItem{Ref: "3", Rev: 2, Title: "Price tracker"}); result.Unchanged != 1 {
		t.Errorf("replay result = %+v, want 1 unchanged", result)
	}
}

func TestReattachSyncedCopiesWhenTwoDetachedNuggetsMatchOneIdea(t *testing.T) {
	store := newTestStore(t)
	detachedNugget(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Twin", Notes: "same"}, Draft{Status: ptr(StatusBuilding)})
	detachedNugget(t, store, SyncedItem{Ref: "2", Rev: 2, Title: "twin", Notes: "Same"}, Draft{Status: ptr(StatusExploring)})

	result := mustReattach(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Twin", Notes: "same"})
	if result.Created != 1 || result.Reattached != 0 {
		t.Fatalf("result = %+v, want a fresh copy", result)
	}
	if n := countIdeas(t, store); n != 3 {
		t.Errorf("ideas = %d, want 3", n)
	}
	if n, _ := store.CountBySource(context.Background(), SourceSpicesDetached); n != 2 {
		t.Errorf("detached = %d, want both left detached", n)
	}
}

func TestReattachSyncedCopiesWhenOneDetachedNuggetMatchesTwoIdeas(t *testing.T) {
	store := newTestStore(t)
	detachedNugget(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Twin", Notes: "same"}, Draft{Status: ptr(StatusBuilding)})

	result := mustReattach(t, store,
		SyncedItem{Ref: "1", Rev: 1, Title: "Twin", Notes: "same"},
		SyncedItem{Ref: "2", Rev: 2, Title: "TWIN", Notes: " same "},
	)
	if result.Created != 2 || result.Reattached != 0 {
		t.Fatalf("result = %+v, want two fresh copies", result)
	}
	if n, _ := store.CountBySource(context.Background(), SourceSpicesDetached); n != 1 {
		t.Errorf("detached = %d, want the nugget left detached", n)
	}
}

func TestReattachSyncedCopiesWhenTheNotesChanged(t *testing.T) {
	store := newTestStore(t)
	detachedNugget(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Price tracker", Notes: "pings me"}, Draft{Status: ptr(StatusBuilding)})

	// Edited in spices since the reset: a different idea.
	result := mustReattach(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Price tracker", Notes: "pings me daily"})
	if result.Created != 1 || result.Reattached != 0 {
		t.Fatalf("result = %+v, want a fresh copy", result)
	}
	if n, _ := store.CountBySource(context.Background(), SourceSpicesDetached); n != 1 {
		t.Errorf("detached = %d, want the nugget left detached", n)
	}
}

func TestReattachSyncedIgnoresTombstonesAndOtherSources(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	detached := detachedNugget(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Kept aside"}, Draft{Status: ptr(StatusBuilding)})
	typed, err := store.Create(ctx, Draft{Title: ptr("Typed here")})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	gone := time.Now()
	result := mustReattach(t, store,
		SyncedItem{Ref: "5", Rev: 5, Title: "Kept aside", DeletedAt: &gone},
		SyncedItem{Ref: "6", Rev: 6, Title: "Typed here"},
	)
	if result.Skipped != 1 || result.Created != 1 || result.Reattached != 0 {
		t.Fatalf("result = %+v, want the tombstone skipped and a nugget typed here left alone", result)
	}
	if got, _ := store.Get(ctx, detached.ID); got.Source == nil || *got.Source != SourceSpicesDetached {
		t.Errorf("detached nugget source = %v, want still detached", got.Source)
	}
	if got, _ := store.Get(ctx, typed.ID); got.Source != nil {
		t.Errorf("typed nugget source = %v, want none", got.Source)
	}
}
