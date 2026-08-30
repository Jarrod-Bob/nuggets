package idea

import (
	"context"
	"testing"
)

// seedIdeas, titles and archiveForTest come from Task 3's store_test.go —
// same package, so they are already available here. Do not redefine them.

func TestListReturnsNewestFirst(t *testing.T) {
	store := newTestStore(t)
	seedIdeas(t, store)

	got, err := store.List(context.Background(), ListFilter{})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	if got[0].Title != "Recipe sorter" {
		t.Errorf("first = %q, want %q (newest first)", got[0].Title, "Recipe sorter")
	}
}

func TestListSearchIsCaseInsensitiveAcrossTitleAndNotes(t *testing.T) {
	store := newTestStore(t)
	seedIdeas(t, store)

	got, err := store.List(context.Background(), ListFilter{Query: "bank"})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	// "Idea bank" matches on title, "Recipe sorter" on its notes ("BANK of recipes").
	if len(got) != 2 {
		t.Fatalf("titles = %v, want 2 matches", titles(got))
	}
}

func TestListQueryAndTagCombineWithAnd(t *testing.T) {
	store := newTestStore(t)
	seedIdeas(t, store)

	got, err := store.List(context.Background(), ListFilter{Query: "bank", Tag: "go"})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got) != 1 || got[0].Title != "Idea bank" {
		t.Errorf("titles = %v, want [Idea bank]", titles(got))
	}
}

func TestListExcludesArchivedByDefault(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	all, _ := store.List(ctx, ListFilter{})
	if err := store.archiveForTest(ctx, all[0].ID); err != nil {
		t.Fatalf("archiving: %v", err)
	}

	active, err := store.List(ctx, ListFilter{})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(active) != 2 {
		t.Errorf("active = %v, want 2", titles(active))
	}

	archived, err := store.List(ctx, ListFilter{Archived: true})
	if err != nil {
		t.Fatalf("List(archived) error = %v", err)
	}
	if len(archived) != 1 {
		t.Errorf("archived = %v, want 1", titles(archived))
	}
}

func TestListLoadsTags(t *testing.T) {
	store := newTestStore(t)
	seedIdeas(t, store)

	got, err := store.List(context.Background(), ListFilter{Tag: "saas"})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1", len(got))
	}
	if len(got[0].Tags) != 2 {
		t.Errorf("Tags = %v, want both go and saas", got[0].Tags)
	}
}
