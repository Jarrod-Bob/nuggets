package idea

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
)

// newTestStore gives every test its own real database. SQLite creates one in
// about a millisecond, which is why there is no store interface and no mocks.
func newTestStore(t *testing.T) *Store {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return NewStore(database)
}

// --- Shared fixtures. These live in Task 3 because Tasks 4 and 7 both use
// them, and those two tasks are meant to run in parallel. ---

// seedIdeas inserts three ideas whose titles, notes and tags are chosen so that
// search, AND-combination and tag filtering can each be tested distinctly.
func seedIdeas(t *testing.T, store *Store) {
	t.Helper()
	ctx := context.Background()
	seeds := []Draft{
		{Title: "Idea bank", Notes: "store nuggets", Tags: []string{"go", "saas"}},
		{Title: "Tiny CLI", Notes: "for renaming files", Tags: []string{"go"}},
		{Title: "Recipe sorter", Notes: "BANK of recipes", Tags: []string{"weekend"}},
	}
	for _, seed := range seeds {
		if _, err := store.Create(ctx, seed); err != nil {
			t.Fatalf("seeding %q: %v", seed.Title, err)
		}
	}
}

// titles pulls titles out of a result set for readable assertion failures.
func titles(ideas []Idea) []string {
	out := make([]string, len(ideas))
	for i, v := range ideas {
		out[i] = v.Title
	}
	return out
}

// archiveForTest sets archived_at directly, so tests in Tasks 4 and 7 do not
// depend on Task 6's Archive method being written yet.
func (s *Store) archiveForTest(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE ideas SET archived_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	return err
}

func TestCreateNormalizesTags(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	got, err := store.Create(ctx, Draft{
		Title: "Idea bank",
		Notes: "the one you're reading",
		Tags:  []string{"  SaaS ", "saas", "Weekend", ""},
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	want := []string{"saas", "weekend"}
	if len(got.Tags) != len(want) {
		t.Fatalf("Tags = %v, want %v", got.Tags, want)
	}
	for i := range want {
		if got.Tags[i] != want[i] {
			t.Errorf("Tags[%d] = %q, want %q", i, got.Tags[i], want[i])
		}
	}
}

func TestCreateRejectsBlankTitle(t *testing.T) {
	store := newTestStore(t)
	for _, title := range []string{"", "   ", "\t\n"} {
		_, err := store.Create(context.Background(), Draft{Title: title})
		if !errors.Is(err, ErrEmptyTitle) {
			t.Errorf("Create(title=%q) error = %v, want ErrEmptyTitle", title, err)
		}
	}
}

func TestCreateTrimsTitle(t *testing.T) {
	store := newTestStore(t)
	got, err := store.Create(context.Background(), Draft{Title: "  Spaced  "})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if got.Title != "Spaced" {
		t.Errorf("Title = %q, want %q", got.Title, "Spaced")
	}
}

func TestGetReturnsCreatedIdea(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{Title: "Findable", Tags: []string{"go"}})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	got, err := store.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.Title != "Findable" {
		t.Errorf("Title = %q, want %q", got.Title, "Findable")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "go" {
		t.Errorf("Tags = %v, want [go]", got.Tags)
	}
	if got.ArchivedAt != nil {
		t.Errorf("ArchivedAt = %v, want nil for a new idea", got.ArchivedAt)
	}
}

func TestGetMissingReturnsErrNotFound(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Get(context.Background(), 9999)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Get(9999) error = %v, want ErrNotFound", err)
	}
}

func TestTagsAreSharedNotDuplicated(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	if _, err := store.Create(ctx, Draft{Title: "One", Tags: []string{"go"}}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := store.Create(ctx, Draft{Title: "Two", Tags: []string{"GO"}}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	var count int
	if err := store.db.QueryRow("SELECT COUNT(*) FROM tags").Scan(&count); err != nil {
		t.Fatalf("counting tags: %v", err)
	}
	if count != 1 {
		t.Errorf("tags rows = %d, want 1 (go and GO are the same tag)", count)
	}
}
