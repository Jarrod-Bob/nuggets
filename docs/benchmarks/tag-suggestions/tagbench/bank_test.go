package tagbench

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/jev"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

func TestLoadBankReadsActiveNuggetsAndTheJevKeyReadOnly(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "nuggets.db")
	rw, err := db.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	store := idea.NewStore(rw)
	create := func(title string, tags ...string) *idea.Idea {
		n, err := store.Create(ctx, idea.Draft{Title: &title, Tags: &tags})
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
	synth := create("Synth", "music", "hardware")
	gone := create("Old", "music")
	if err := store.Archive(ctx, gone.ID); err != nil {
		t.Fatal(err)
	}
	q := jev.NewQueue(rw, settings.NewStore(rw))
	if err := q.Dismiss(ctx, synth.ID, "web"); err != nil {
		t.Fatal(err)
	}
	if err := settings.NewStore(rw).Set(ctx, jev.KeyAPIKey, "ts_secret"); err != nil {
		t.Fatal(err)
	}
	rw.Close()

	ro, err := db.OpenReadOnly(path)
	if err != nil {
		t.Fatal(err)
	}
	defer ro.Close()
	items, err := LoadBank(ctx, ro)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("%d items, want only the active nugget", len(items))
	}
	it := items[0]
	if it.Dataset != DatasetBank || it.Group != DatasetBank || it.NuggetID != synth.ID || it.Title != "Synth" ||
		!reflect.DeepEqual(it.Tags, []string{"hardware", "music"}) || !reflect.DeepEqual(it.Dismissed, []string{"web"}) || it.UpdatedAt.IsZero() {
		t.Errorf("item = %+v", it)
	}
	key, err := JevKey(ctx, ro)
	if err != nil || key != "ts_secret" {
		t.Errorf("key = %q, %v", key, err)
	}
}
