package idea

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"
)

func mustApply(t *testing.T, store *Store, items ...SyncedItem) SyncResult {
	t.Helper()
	result, err := store.ApplySynced(context.Background(), SourceSpices, items, nil)
	if err != nil {
		t.Fatalf("ApplySynced: %v", err)
	}
	return result
}

func onlyIdea(t *testing.T, store *Store, filter ListFilter) *Idea {
	t.Helper()
	ideas, err := store.List(context.Background(), filter)
	if err != nil {
		t.Fatalf("listing: %v", err)
	}
	if len(ideas) != 1 {
		t.Fatalf("ideas = %d, want 1", len(ideas))
	}
	return &ideas[0]
}

func TestApplySyncedInsertsWithOrigin(t *testing.T) {
	store := newTestStore(t)
	result := mustApply(t, store, SyncedItem{Ref: "42", Rev: 57, Title: " Price tracker ", Notes: "pings me", Tags: []string{"Lego"}})
	if result.Created != 1 {
		t.Fatalf("result = %+v, want 1 created", result)
	}

	got := onlyIdea(t, store, ListFilter{})
	if got.Title != "Price tracker" || got.Notes != "pings me" || got.Status != StatusRaw {
		t.Errorf("got %q / %q / %q", got.Title, got.Notes, got.Status)
	}
	if len(got.Tags) != 1 || got.Tags[0] != "lego" {
		t.Errorf("Tags = %v, want [lego]", got.Tags)
	}
	if got.Source == nil || *got.Source != SourceSpices || got.SourceRef == nil || *got.SourceRef != "42" {
		t.Errorf("Source/SourceRef = %v/%v, want spices/42", got.Source, got.SourceRef)
	}
	if got.Origin == nil || *got.Origin != "spices" {
		t.Errorf("Origin = %v, want spices", got.Origin)
	}
}

func TestApplySyncedReplayIsNoOp(t *testing.T) {
	store := newTestStore(t)
	item := SyncedItem{Ref: "1", Rev: 5, Title: "Once"}
	mustApply(t, store, item)
	before := onlyIdea(t, store, ListFilter{})

	result := mustApply(t, store, item)
	if result.Unchanged != 1 || result.Created != 0 {
		t.Fatalf("replay result = %+v, want 1 unchanged", result)
	}
	after := onlyIdea(t, store, ListFilter{})
	if !after.UpdatedAt.Equal(before.UpdatedAt) {
		t.Errorf("updated_at moved on replay: %v -> %v", before.UpdatedAt, after.UpdatedAt)
	}
}

func TestApplySyncedRefreshesUneditedNugget(t *testing.T) {
	store := newTestStore(t)
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old", Tags: []string{"a"}})

	result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "New", Notes: "more", Tags: []string{"b"}})
	if result.Updated != 1 {
		t.Fatalf("result = %+v, want 1 updated", result)
	}
	got := onlyIdea(t, store, ListFilter{})
	if got.Title != "New" || got.Notes != "more" || len(got.Tags) != 1 || got.Tags[0] != "b" {
		t.Errorf("got %q / %q / %v, want refreshed", got.Title, got.Notes, got.Tags)
	}

	// Still unedited after a refresh, so the next newer rev refreshes too.
	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 10, Title: "Newer"}); result.Updated != 1 {
		t.Errorf("second refresh result = %+v, want 1 updated", result)
	}
}

func TestApplySyncedLeavesEditedNuggetAlone(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old"})
	imported := onlyIdea(t, store, ListFilter{})
	if _, err := store.Update(ctx, imported.ID, Draft{Title: ptr("Mine now")}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "From spices"})
	if result.Unchanged != 1 {
		t.Fatalf("result = %+v, want 1 unchanged", result)
	}
	if got := onlyIdea(t, store, ListFilter{}); got.Title != "Mine now" {
		t.Errorf("Title = %q, want the captain's edit kept", got.Title)
	}
}

func TestApplySyncedSkipsEmptyTitle(t *testing.T) {
	store := newTestStore(t)
	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "   "}); result.Skipped != 1 {
		t.Fatalf("result = %+v, want 1 skipped", result)
	}
	ideas, _ := store.List(context.Background(), ListFilter{})
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0", len(ideas))
	}
}

func TestApplySyncedTombstoneArchivesNeverDeletes(t *testing.T) {
	store := newTestStore(t)
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Gone soon"})

	deleted := time.Date(2026, 9, 26, 8, 0, 0, 0, time.UTC)
	result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 2, DeletedAt: &deleted})
	if result.Archived != 1 {
		t.Fatalf("result = %+v, want 1 archived", result)
	}

	active, _ := store.List(context.Background(), ListFilter{})
	if len(active) != 0 {
		t.Errorf("active ideas = %d, want 0 after tombstone", len(active))
	}
	got := onlyIdea(t, store, ListFilter{Archived: true})
	if got.ArchivedAt == nil || got.Title != "Gone soon" {
		t.Errorf("got %+v, want the nugget kept, in the trash", got)
	}

	var recorded sql.NullTime
	if err := store.db.QueryRow(`SELECT source_deleted_at FROM ideas WHERE id = ?`, got.ID).Scan(&recorded); err != nil {
		t.Fatalf("reading tombstone: %v", err)
	}
	if !recorded.Valid || !recorded.Time.Equal(deleted) {
		t.Errorf("source_deleted_at = %v, want %v", recorded, deleted)
	}
}

func TestApplySyncedTombstoneForUnknownItemIsSkipped(t *testing.T) {
	store := newTestStore(t)
	deleted := time.Now()
	if result := mustApply(t, store, SyncedItem{Ref: "9", Rev: 3, DeletedAt: &deleted}); result.Skipped != 1 {
		t.Fatalf("result = %+v, want 1 skipped", result)
	}
}

func TestApplySyncedRollsBackPageWhenInTxFails(t *testing.T) {
	store := newTestStore(t)
	boom := errors.New("cursor write failed")
	_, err := store.ApplySynced(context.Background(), SourceSpices,
		[]SyncedItem{{Ref: "1", Rev: 1, Title: "Half"}},
		func(context.Context, *sql.Tx) error { return boom })
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want %v", err, boom)
	}
	ideas, _ := store.List(context.Background(), ListFilter{})
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0: the page must not commit without its cursor", len(ideas))
	}
}

func TestDetachSourceKeepsEditsAndFreesRefs(t *testing.T) {
	ctx := context.Background()
	store := newTestStore(t)
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Original", Tags: []string{"x"}})
	imported := onlyIdea(t, store, ListFilter{})
	edited, err := store.Update(ctx, imported.ID, Draft{Title: ptr("Edited"), Notes: ptr("my notes"), Status: ptr(StatusBuilding)})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	moved, err := store.DetachSource(ctx, SourceSpices, SourceSpicesDetached, nil)
	if err != nil || moved != 1 {
		t.Fatalf("DetachSource = %d, %v; want 1, nil", moved, err)
	}

	got, err := store.Get(ctx, imported.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Title != "Edited" || got.Notes != "my notes" || got.Status != StatusBuilding || len(got.Tags) != 1 {
		t.Errorf("got %+v, want the edits intact", got)
	}
	if !got.UpdatedAt.Equal(edited.UpdatedAt) {
		t.Errorf("updated_at changed on detach")
	}
	if got.Source == nil || *got.Source != SourceSpicesDetached || got.SourceRef != nil {
		t.Errorf("Source/SourceRef = %v/%v, want spices-detached/nil", got.Source, got.SourceRef)
	}
	if got.Origin == nil || *got.Origin != "spices" {
		t.Errorf("Origin = %v, want spices", got.Origin)
	}
	var oldRef string
	if err := store.db.QueryRow(`SELECT source_detached_ref FROM ideas WHERE id = ?`, got.ID).Scan(&oldRef); err != nil || oldRef != "1" {
		t.Errorf("source_detached_ref = %q, %v; want 1", oldRef, err)
	}

	// The reset spices reuses id 1 for something else: it arrives as a new
	// nugget, and the detached one is untouched.
	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 1, Title: "Unrelated"}); result.Created != 1 {
		t.Fatalf("result = %+v, want a new nugget for the reused id", result)
	}
	if again, _ := store.Get(ctx, imported.ID); again.Title != "Edited" {
		t.Errorf("detached nugget title = %q, want Edited", again.Title)
	}

	// A second reset detaches again without tripping the unique index.
	if moved, err := store.DetachSource(ctx, SourceSpices, SourceSpicesDetached, nil); err != nil || moved != 1 {
		t.Fatalf("second DetachSource = %d, %v; want 1, nil", moved, err)
	}
}
