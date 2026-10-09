package idea

import (
	"context"
	"testing"
)

func TestProjectNameRoundTripsThroughCreatePatchAndClear(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{Title: ptr("A bank for little ideas"), ProjectName: ptr("  Ideanori  ")})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.ProjectName != "Ideanori" {
		t.Errorf("created ProjectName = %q, want Ideanori (trimmed)", created.ProjectName)
	}

	// Absent leaves it unchanged.
	kept, err := store.Update(ctx, created.ID, Draft{Notes: ptr("more")})
	if err != nil {
		t.Fatalf("Update notes: %v", err)
	}
	if kept.ProjectName != "Ideanori" {
		t.Errorf("after notes-only patch ProjectName = %q, want Ideanori", kept.ProjectName)
	}

	renamed, err := store.Update(ctx, created.ID, Draft{ProjectName: ptr("Nugglet")})
	if err != nil {
		t.Fatalf("Update project name: %v", err)
	}
	if renamed.ProjectName != "Nugglet" {
		t.Errorf("patched ProjectName = %q, want Nugglet", renamed.ProjectName)
	}

	cleared, err := store.Update(ctx, created.ID, Draft{ProjectName: ptr("   ")})
	if err != nil {
		t.Fatalf("Update clear: %v", err)
	}
	if cleared.ProjectName != "" {
		t.Errorf("cleared ProjectName = %q, want empty", cleared.ProjectName)
	}

	plain, err := store.Create(ctx, Draft{Title: ptr("No project name")})
	if err != nil {
		t.Fatalf("Create plain: %v", err)
	}
	if plain.ProjectName != "" {
		t.Errorf("default ProjectName = %q, want empty", plain.ProjectName)
	}
}

func TestSearchMatchesProjectName(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if _, err := store.Create(ctx, Draft{Title: ptr("A bank for little ideas"), ProjectName: ptr("Ideanori")}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := store.Create(ctx, Draft{Title: ptr("Something else")}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := store.List(ctx, ListFilter{Query: "ideanori"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(got) != 1 || got[0].ProjectName != "Ideanori" {
		t.Errorf("search for the project name = %+v, want just the Ideanori nugget", got)
	}
}

func TestProjectNameOnlySaveKeepsSpicesNuggetUnedited(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old", Notes: "old notes"})
	imported := onlyIdea(t, store, ListFilter{})

	if _, err := store.Update(ctx, imported.ID, Draft{ProjectName: ptr("Ideanori")}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "New", Notes: "new notes"})
	if result.Updated != 1 {
		t.Fatalf("result = %+v, want 1 updated: a project-name-only save isn't an edit", result)
	}
	got := onlyIdea(t, store, ListFilter{})
	if got.Title != "New" || got.Notes != "new notes" {
		t.Errorf("got %q / %q, want spices' refresh", got.Title, got.Notes)
	}
	if got.ProjectName != "Ideanori" {
		t.Errorf("ProjectName = %q, want Ideanori kept through the refresh", got.ProjectName)
	}
}

// The edit form sends every field on save, so "only the project name changed"
// is about values, not which keys are present.
func TestFormShapedProjectNameSaveKeepsSpicesNuggetUnedited(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old", Notes: "old notes", Tags: []string{"b", "a"}})
	imported := onlyIdea(t, store, ListFilter{})

	if _, err := store.Update(ctx, imported.ID, Draft{
		Title:       ptr(" Old "),
		Notes:       ptr("old notes"),
		Tags:        ptr([]string{"B", "a"}),
		Status:      ptr(StatusRaw),
		Links:       ptr([]Link{}),
		ProjectName: ptr("Ideanori"),
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "New"}); result.Updated != 1 {
		t.Fatalf("result = %+v, want 1 updated", result)
	}
}

func TestFormShapedSaveWithStatusChangeMarksSpicesNuggetEdited(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old"})
	imported := onlyIdea(t, store, ListFilter{})

	if _, err := store.Update(ctx, imported.ID, Draft{
		Title: ptr("Old"), Notes: ptr(""), Tags: ptr([]string{}), Status: ptr(StatusBuilding),
		Links: ptr([]Link{}), ProjectName: ptr("Ideanori"),
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "New"}); result.Unchanged != 1 {
		t.Fatalf("result = %+v, want 1 unchanged", result)
	}
}

func TestProjectNameSaveWithTitleChangeMarksSpicesNuggetEdited(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old"})
	imported := onlyIdea(t, store, ListFilter{})

	if _, err := store.Update(ctx, imported.ID, Draft{Title: ptr("Mine now"), ProjectName: ptr("Ideanori")}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "From spices"}); result.Unchanged != 1 {
		t.Fatalf("result = %+v, want 1 unchanged", result)
	}
	if got := onlyIdea(t, store, ListFilter{}); got.Title != "Mine now" {
		t.Errorf("Title = %q, want the captain's edit kept", got.Title)
	}
}

func TestProjectNameOnlySaveKeepsEditedNuggetEdited(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	mustApply(t, store, SyncedItem{Ref: "1", Rev: 5, Title: "Old"})
	imported := onlyIdea(t, store, ListFilter{})
	if _, err := store.Update(ctx, imported.ID, Draft{Title: ptr("Mine now")}); err != nil {
		t.Fatalf("Update title: %v", err)
	}
	if _, err := store.Update(ctx, imported.ID, Draft{ProjectName: ptr("Ideanori")}); err != nil {
		t.Fatalf("Update project name: %v", err)
	}

	if result := mustApply(t, store, SyncedItem{Ref: "1", Rev: 9, Title: "From spices"}); result.Unchanged != 1 {
		t.Fatalf("result = %+v, want 1 unchanged: naming must not un-edit a nugget", result)
	}
}
