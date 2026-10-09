package idea

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
)

func openHookTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

func TestContentChangedFiresOnlyWhenTitleOrNotesChange(t *testing.T) {
	var checked []int64
	store := NewStore(openHookTestDB(t), WithContentChanged(func(ctx context.Context, tx *sql.Tx, id int64) error {
		checked = append(checked, id)
		return nil
	}))
	ctx := context.Background()
	title, notes := "Hooked", "Some notes"
	created, err := store.Create(ctx, Draft{Title: &title, Notes: &notes, Tags: &[]string{"a"}})
	if err != nil {
		t.Fatal(err)
	}
	id := created.ID
	expect := func(step string, want []int64) {
		t.Helper()
		if !reflect.DeepEqual(checked, want) {
			t.Fatalf("after %s: content changed for %v, want %v", step, checked, want)
		}
	}
	expect("create", []int64{id})

	// The edit form sends every field: unchanged title and notes are not a change.
	raw := StatusExploring
	project := "Hookery"
	links := []Link{{URL: "https://example.com"}}
	tags := []string{"a", "b"}
	if _, err := store.Update(ctx, id, Draft{Title: &title, Notes: &notes, Tags: &tags, Status: &raw, Links: &links, ProjectName: &project}); err != nil {
		t.Fatal(err)
	}
	expect("a save changing only tags, status, links and project name", []int64{id})

	newTitle := "Hooked again"
	if _, err := store.Update(ctx, id, Draft{Title: &newTitle, Notes: &notes}); err != nil {
		t.Fatal(err)
	}
	expect("a title edit", []int64{id, id})
	newNotes := "Other notes"
	if _, err := store.Update(ctx, id, Draft{Notes: &newNotes}); err != nil {
		t.Fatal(err)
	}
	expect("a notes edit", []int64{id, id, id})

	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 1, Title: "Imported", Notes: "n"}}, nil); err != nil {
		t.Fatal(err)
	}
	imported := id + 1
	expect("an import", []int64{id, id, id, imported})
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 2, Title: "Imported", Notes: "n", Tags: []string{"x"}}}, nil); err != nil {
		t.Fatal(err)
	}
	expect("a refresh changing only tags", []int64{id, id, id, imported})
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 3, Title: "Imported", Notes: "new notes"}}, nil); err != nil {
		t.Fatal(err)
	}
	expect("a refresh changing the notes", []int64{id, id, id, imported, imported})
}

func TestContentChangedErrorRollsTheWriteBack(t *testing.T) {
	store := NewStore(openHookTestDB(t), WithContentChanged(func(context.Context, *sql.Tx, int64) error {
		return errors.New("boom")
	}))
	title := "Never saved"
	if _, err := store.Create(context.Background(), Draft{Title: &title}); err == nil {
		t.Fatal("Create succeeded despite the hook failing")
	}
	if all, _ := store.List(context.Background(), ListFilter{}); len(all) != 0 {
		t.Errorf("List = %d nuggets, want none saved", len(all))
	}
}

func TestSeveralTagsAddedHooksRunInOrderAndAnyErrorRollsBack(t *testing.T) {
	var order []string
	hook := func(name string, fail error) TagsAddedFunc {
		return func(context.Context, *sql.Tx, int64, []string) error {
			order = append(order, name)
			return fail
		}
	}
	store := NewStore(openHookTestDB(t), WithTagsAdded(hook("first", nil)), WithTagsAdded(hook("second", nil)))
	ctx := context.Background()
	title := "Two hooks"
	if _, err := store.Create(ctx, Draft{Title: &title, Tags: &[]string{"x"}}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(order, []string{"first", "second"}) {
		t.Errorf("hooks ran %v, want first then second", order)
	}

	failing := NewStore(openHookTestDB(t), WithTagsAdded(hook("ok", nil)), WithTagsAdded(hook("fails", errors.New("boom"))))
	if _, err := failing.Create(ctx, Draft{Title: &title, Tags: &[]string{"x"}}); err == nil {
		t.Fatal("Create succeeded despite the second hook failing")
	}
	if all, _ := failing.List(ctx, ListFilter{}); len(all) != 0 {
		t.Errorf("List = %d nuggets, want none saved", len(all))
	}
}

func TestTagsRemovedHearsOnlyRemovedTags(t *testing.T) {
	var calls []tagsAddedCall
	store := NewStore(openHookTestDB(t), WithTagsRemoved(func(ctx context.Context, tx *sql.Tx, id int64, removed []string) error {
		calls = append(calls, tagsAddedCall{id, append([]string(nil), removed...)})
		return nil
	}))
	ctx := context.Background()
	title := "Losing tags"
	created, err := store.Create(ctx, Draft{Title: &title, Tags: &[]string{"a", "b", "c"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ctx, created.ID, Draft{Tags: &[]string{"a", "b", "c", "d"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ctx, created.ID, Draft{Tags: &[]string{"A", "d"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 1, Title: "x", Tags: []string{"s", "t"}}}, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 2, Title: "x", Tags: []string{"t", "u"}}}, nil); err != nil {
		t.Fatal(err)
	}

	want := []tagsAddedCall{
		{created.ID, []string{"b", "c"}},
		{created.ID + 1, []string{"s"}},
	}
	if !reflect.DeepEqual(calls, want) {
		t.Errorf("calls = %+v, want %+v", calls, want)
	}
}
