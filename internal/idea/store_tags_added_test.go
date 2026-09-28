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

type tagsAddedCall struct {
	id    int64
	added []string
}

func newHookedStore(t *testing.T, fail error) (*Store, *[]tagsAddedCall) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	var calls []tagsAddedCall
	store := NewStore(database, WithTagsAdded(func(ctx context.Context, tx *sql.Tx, id int64, added []string) error {
		calls = append(calls, tagsAddedCall{id, append([]string(nil), added...)})
		return fail
	}))
	return store, &calls
}

func TestTagsAddedHearsOnlyNewTags(t *testing.T) {
	store, calls := newHookedStore(t, nil)
	ctx := context.Background()
	title := "Hooked"
	created, err := store.Create(ctx, Draft{Title: &title, Tags: &[]string{"B", "a"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ctx, created.ID, Draft{Notes: &title}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ctx, created.ID, Draft{Tags: &[]string{"a", "b", "c"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Update(ctx, created.ID, Draft{Tags: &[]string{"a"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 1, Title: "x", Tags: []string{"s"}}}, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := store.ApplySynced(ctx, SourceSpices, []SyncedItem{{Ref: "1", Rev: 2, Title: "x", Tags: []string{"s", "t"}}}, nil); err != nil {
		t.Fatal(err)
	}

	want := []tagsAddedCall{
		{created.ID, []string{"b", "a"}},
		{created.ID, []string{"c"}},
		{created.ID + 1, []string{"s"}},
		{created.ID + 1, []string{"t"}},
	}
	if !reflect.DeepEqual(*calls, want) {
		t.Errorf("calls = %+v, want %+v", *calls, want)
	}
}

func TestTagsAddedErrorRollsTheWriteBack(t *testing.T) {
	store, _ := newHookedStore(t, errors.New("boom"))
	title := "Never saved"
	if _, err := store.Create(context.Background(), Draft{Title: &title, Tags: &[]string{"x"}}); err == nil {
		t.Fatal("Create succeeded despite the hook failing")
	}
	all, err := store.List(context.Background(), ListFilter{})
	if err != nil || len(all) != 0 {
		t.Errorf("List = %d nuggets, %v; want none saved", len(all), err)
	}
}
