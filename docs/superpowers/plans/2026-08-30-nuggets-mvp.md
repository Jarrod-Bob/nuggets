# nuggets MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the nuggets MVP — a single Go binary that serves a JSON API and an embedded React frontend, storing ideas with tags in one SQLite file.

**Architecture:** A Go backend exposes a small REST API over SQLite; all SQL lives in one store file, all HTTP in one package. A TypeScript/React frontend is ported from the supplied design system and talks to that API through a single typed module. In production the Go binary serves both from one origin; in development Vite proxies `/api` to Go.

**Tech Stack:** Go (stdlib `net/http`, `database/sql`), `modernc.org/sqlite`, `goose`, React, Vite, TypeScript, the nuggets design system.

**Spec:** [`docs/superpowers/specs/2026-08-29-nuggets-design.md`](../specs/2026-08-29-nuggets-design.md)

## Global Constraints

- **Module path:** `github.com/Jarrod-Bob/nuggets`. Go floor **1.24** (`net/http` method+wildcard routing needs ≥1.22).
- **SQLite driver name is `"sqlite"`, not `"sqlite3"`** (`modernc.org/sqlite`). Goose's *dialect* name is still `"sqlite3"` — these differ, and both are correct.
- **Never use `mattn/go-sqlite3`.** It requires cgo and a gcc toolchain on Windows.
- **DSN pragmas are mandatory:** `?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)`. Foreign keys are OFF by default in SQLite; without this `idea_tags` enforces nothing.
- **Bind `127.0.0.1:7777`, never `:7777`** — binding all interfaces triggers a Windows Defender Firewall prompt and exposes the app to the LAN.
- **Database path:** `os.UserConfigDir()` → `%AppData%\nuggets\nuggets.db`. Never a relative path. Run through `filepath.ToSlash` before putting it in a `file:` DSN.
- **`db.SetMaxOpenConns(1)`** — single-user app; eliminates `SQLITE_BUSY`.
- **Tag normalization is server-side on every write path:** trimmed, lowercased.
- **`PATCH` replaces the whole tag set.** No add-one/remove-one endpoints.
- **`q` and `tag` combine with AND.** `q` is case-insensitive `LIKE '%q%'` over title and notes.
- **`archived` accepts only `true`.** Omitted lists active ideas; `archived=true` lists only archived. There is no combined view.
- **`title` is required and non-empty after trimming.** Blank title is a 400.
- **No toast system, no error boundaries.** Errors render inline.
- **Go tests use a real SQLite DB in `t.TempDir()`.** No mocks, no store interface, no testify. Run with `-race`.
- **PowerShell 5.1 has no `&&`.** Chain with `;` and `if ($?) { }`, or use npm scripts.
- **Copy is fixed by the design system.** Exact strings: primary CTA `Drop a nugget`; create submit `Drop it in`; edit submit `Save`; draw button `Draw a nugget`; draw dialog title `Your challenge`; reroll `Reroll`; title validation `A nugget needs a title.`; empty bank `Nothing in the bank yet` / `Drop your first nugget in. Half-formed is fine.`; empty search `No nuggets match` / `Try a different word, or clear the tag filter.` The wordmark is always lowercase `nuggets`. No emoji.
- **Design system reference copy at `.claude/skills/nuggets-design/` is read-only.** Port *copies* into `web/src/`; never edit the skill folder, so a later re-sync from the designer can be diffed.

---

## Parallelization Map

The API contract is frozen in spec §6 and §6.1, so the backend and frontend never need to negotiate. They can be built simultaneously by different agents.

```
Phase 0   Task 1  Repo scaffolding                    [blocks everything]
              |
    +---------+---------------------------------+
    |                                           |
 TRACK A (Go backend)                    TRACK B (Frontend)
    |                                           |
  Task 2  db + migrations                  Task 9  Vite + TS scaffold
    |                                           |
  Task 3  domain + Create/Get              +----+----+
    |                                      |         |
    +-----+-----+-----+                 Task 10   Task 11
    |     |     |     |                 vendor    port DS
  Task4 Task5 Task6 Task7               fonts     primitives
  List  Update Arch  Random             + icons      |
    |     |     |     |                            Task 12
    +-----+--+--+-----+                            port nuggets
             |                                     components
          Task 8  HTTP handlers                       |
             |                                        |
    +--------+----------------------------------------+
    |
 Phase 2   Task 13  api.ts + App wiring     [needs both tracks]
           Task 14  embed + build + run
```

**Parallel groups:**
- **Track A ‖ Track B** — the big win. Tasks 2–8 and 9–12 share no files.
- **Tasks 4, 5, 6, 7** — all depend on Task 3, none on each other. Four agents can take one each. They all touch `internal/idea/store.go`, so either serialize the commits or have each agent write to its own file (`store_list.go`, `store_update.go`, `store_archive.go`, `store_random.go`) — the plan uses separate files for exactly this reason.
- **Task 10 ‖ Task 11** — different directories.

**Strictly sequential:** 1 → (2 → 3) → 8 → 13 → 14.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `go.mod`, `.gitattributes`, `.gitignore`, `build.ps1` | Project scaffolding |
| `internal/db/db.go` | DSN construction, pragmas, connection limits, migration run |
| `internal/db/migrations/00001_init.sql` | Schema |
| `internal/idea/idea.go` | Domain types, errors, tag normalization |
| `internal/idea/store.go` | Store struct, `Create`, `Get`, shared tag upsert + load helpers |
| *(deviation)* | Spec §10 shows a single `store.go`. The plan splits the store across five files so Tasks 4–7 can run in parallel without edit conflicts. All SQL still lives in one package, which is what spec §9.2 actually requires for the accounts migration. |
| `internal/idea/store_list.go` | `List` with q/tag/archived filters |
| `internal/idea/store_update.go` | `Update` with whole-set tag replacement |
| `internal/idea/store_archive.go` | `Archive`, `Restore`, `Purge` |
| `internal/idea/store_random.go` | `Random`, `Tags` |
| `internal/httpapi/respond.go` | `writeJSON`, `writeError`, error-to-status mapping |
| `internal/httpapi/server.go` | Route table, logging + recovery middleware |
| `internal/httpapi/ideas.go` | Handlers |
| `internal/web/embed.go` | Embedded frontend + SPA fallback |
| `cmd/nuggets/main.go` | Wiring, browser launch, listen |
| `web/src/api.ts` | Every `fetch` call and every shared type |
| `web/src/components/**` | Design system components, ported to `.tsx` |
| `web/src/App.tsx` | Screen composition |

---

## Task 1: Repo scaffolding

**Files:**
- Create: `.gitattributes`, `.gitignore`, `go.mod`, `build.ps1`

**Interfaces:**
- Consumes: nothing
- Produces: module path `github.com/Jarrod-Bob/nuggets` that every later import uses

- [ ] **Step 1: Create `.gitattributes`**

This must come first. Git has already emitted 120+ CRLF warnings on this repo; every file added before this exists will churn on its next touch.

```
* text=auto eol=lf
*.png binary
*.woff2 binary
*.svg text eol=lf
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
internal/web/dist/
!internal/web/dist/.gitkeep
*.db
*.db-wal
*.db-shm
nuggets.exe
dist/
.claude/worktrees/
.superpowers/
```

Preserve the last two lines if they are already present — `.claude/` is a
tracked directory in this repo (the design system lives there), so the
worktree and scratch directories must stay ignored.

The negation matters: `internal/web/embed.go` will not compile before the first
frontend build unless `dist/` exists, so Task 14 adds a `.gitkeep` that must
survive this ignore rule.

- [ ] **Step 3: Initialise the Go module**

```bash
go mod init github.com/Jarrod-Bob/nuggets
go mod edit -go=1.24
```

- [ ] **Step 4: Create `build.ps1`**

PowerShell 5.1 has no `&&`, so this exists instead of a Makefile.

```powershell
# Build the frontend, then embed it in the Go binary.
Push-Location web
npm run build
if (-not $?) { Pop-Location; throw "frontend build failed" }
Pop-Location
go build -o nuggets.exe ./cmd/nuggets
if (-not $?) { throw "go build failed" }
Write-Host "built nuggets.exe"
```

- [ ] **Step 5: Verify and commit**

Run: `go build ./...`
Expected: succeeds with no output (no packages yet is fine).

```bash
git add .gitattributes .gitignore go.mod build.ps1
git commit -m "chore: scaffold Go module and repo config"
```

---

# TRACK A — Go backend

## Task 2: Database open, pragmas, and migrations

**Files:**
- Create: `internal/db/db.go`, `internal/db/migrations/00001_init.sql`, `internal/db/db_test.go`

**Interfaces:**
- Consumes: nothing
- Produces: `db.Open(path string) (*sql.DB, error)`, `db.DefaultPath() (string, error)`

- [ ] **Step 1: Add dependencies**

```bash
go get modernc.org/sqlite
go get github.com/pressly/goose/v3
```

- [ ] **Step 2: Write the migration**

Create `internal/db/migrations/00001_init.sql`:

```sql
-- +goose Up
CREATE TABLE ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    archived_at TIMESTAMP
);

CREATE TABLE tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE idea_tags (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);

CREATE INDEX idx_ideas_archived_created ON ideas(archived_at, created_at DESC);
CREATE INDEX idx_idea_tags_tag ON idea_tags(tag_id);

-- +goose Down
DROP TABLE idea_tags;
DROP TABLE tags;
DROP TABLE ideas;
```

- [ ] **Step 3: Write the failing test**

Create `internal/db/db_test.go`. The foreign-key assertion is the important one — SQLite silently ignores foreign keys unless the pragma is set, which would let `idea_tags` accumulate orphans forever.

```go
package db

import (
	"path/filepath"
	"testing"
)

func TestOpenEnablesForeignKeys(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer database.Close()

	var enabled int
	if err := database.QueryRow("PRAGMA foreign_keys").Scan(&enabled); err != nil {
		t.Fatalf("reading pragma: %v", err)
	}
	if enabled != 1 {
		t.Errorf("foreign_keys = %d, want 1 (idea_tags would enforce nothing)", enabled)
	}
}

func TestOpenAppliesMigrations(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer database.Close()

	for _, table := range []string{"ideas", "tags", "idea_tags"} {
		var name string
		err := database.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q missing after migration: %v", table, err)
		}
	}
}

func TestOpenIsIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	first, err := Open(path)
	if err != nil {
		t.Fatalf("first Open() error = %v", err)
	}
	first.Close()

	second, err := Open(path)
	if err != nil {
		t.Fatalf("second Open() error = %v (migrations should be re-runnable)", err)
	}
	second.Close()
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `go test ./internal/db/ -v`
Expected: FAIL — `undefined: Open`

- [ ] **Step 5: Implement `internal/db/db.go`**

```go
// Package db opens the nuggets SQLite database and keeps its schema current.
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	// Registers the "sqlite" driver. Pure Go — no cgo, no gcc on Windows.
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// DefaultPath returns %AppData%\nuggets\nuggets.db, creating the directory.
// Never use a relative path: the database would otherwise move depending on
// which directory the shortcut launched from.
func DefaultPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locating user config dir: %w", err)
	}
	dir := filepath.Join(base, "nuggets")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("creating %s: %w", dir, err)
	}
	return filepath.Join(dir, "nuggets.db"), nil
}

// dsn builds the connection string. ToSlash matters on Windows: backslashes in
// a file: URI are misparsed as escape sequences.
func dsn(path string) string {
	return "file:" + filepath.ToSlash(path) +
		"?_pragma=foreign_keys(1)" +
		"&_pragma=journal_mode(WAL)" +
		"&_pragma=busy_timeout(5000)"
}

// Open connects to the database and migrates it to the latest schema.
func Open(path string) (*sql.DB, error) {
	database, err := sql.Open("sqlite", dsn(path))
	if err != nil {
		return nil, fmt.Errorf("opening %s: %w", path, err)
	}

	// Single-user app: one connection removes SQLITE_BUSY entirely.
	database.SetMaxOpenConns(1)

	if err := database.Ping(); err != nil {
		database.Close()
		return nil, fmt.Errorf("connecting to %s: %w", path, err)
	}

	goose.SetBaseFS(migrationFS)
	goose.SetLogger(goose.NopLogger())
	// Goose's dialect name is "sqlite3" even though the driver is "sqlite".
	if err := goose.SetDialect("sqlite3"); err != nil {
		database.Close()
		return nil, fmt.Errorf("setting goose dialect: %w", err)
	}
	if err := goose.Up(database, "migrations"); err != nil {
		database.Close()
		return nil, fmt.Errorf("migrating: %w", err)
	}

	return database, nil
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `go test ./internal/db/ -v -race`
Expected: PASS — all three tests.

- [ ] **Step 7: Commit**

```bash
git add internal/db go.mod go.sum
git commit -m "feat(db): open SQLite with pragmas and run embedded migrations"
```

---

## Task 3: Domain types and Create/Get

**Files:**
- Create: `internal/idea/idea.go`, `internal/idea/store.go`, `internal/idea/store_test.go`

**Interfaces:**
- Consumes: `db.Open`
- Produces:
  - `idea.Idea{ID int64; Title, Notes string; Tags []string; CreatedAt, UpdatedAt time.Time; ArchivedAt *time.Time}`
  - `idea.Tag{Name string; Count int}`
  - `idea.Draft{Title, Notes string; Tags []string}`
  - `idea.NormalizeTag(string) string`
  - `idea.ErrNotFound`, `idea.ErrEmptyTitle`
  - `idea.NewStore(*sql.DB) *Store`
  - `(*Store).Create(ctx, Draft) (*Idea, error)`
  - `(*Store).Get(ctx, int64) (*Idea, error)`
  - unexported helpers `upsertTags`, `loadTags`, `scanIdea` used by Tasks 4–7

- [ ] **Step 1: Write `internal/idea/idea.go`**

The `ErrEmptyTitle` text is the design system's exact validation copy, so the API and the UI say the same thing.

```go
// Package idea holds the nuggets domain types and all SQL.
package idea

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrNotFound   = errors.New("nugget not found")
	ErrEmptyTitle = errors.New("A nugget needs a title.")
)

// Idea is one row of the ideas table plus its tags.
type Idea struct {
	ID         int64      `json:"id"`
	Title      string     `json:"title"`
	Notes      string     `json:"notes"`
	Tags       []string   `json:"tags"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	ArchivedAt *time.Time `json:"archived_at"`
}

// Tag is a tag name with how many active ideas carry it.
type Tag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Draft is the writable shape of an idea. Tags is always the complete set:
// PATCH replaces rather than merges.
type Draft struct {
	Title string   `json:"title"`
	Notes string   `json:"notes"`
	Tags  []string `json:"tags"`
}

// NormalizeTag is the single definition of tag identity. The server owns this
// rule; the frontend only previews it.
func NormalizeTag(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// normalizeTagSet normalizes, drops blanks, and de-duplicates while preserving
// first-seen order.
func normalizeTagSet(names []string) []string {
	seen := make(map[string]bool, len(names))
	out := make([]string, 0, len(names))
	for _, raw := range names {
		n := NormalizeTag(raw)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}
```

- [ ] **Step 2: Write the failing test**

Create `internal/idea/store_test.go`. `newTestStore` is the shared fixture every later store test reuses — a real database, created fresh per test in about a millisecond.

```go
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `go test ./internal/idea/ -v`
Expected: FAIL — `undefined: Store`, `undefined: NewStore`

- [ ] **Step 4: Implement `internal/idea/store.go`**

```go
package idea

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Store is the only place SQL is written. Keeping every query here means
// adding user accounts later is a WHERE clause in one file (spec §9.2).
type Store struct {
	db *sql.DB
}

func NewStore(database *sql.DB) *Store {
	return &Store{db: database}
}

// Create inserts an idea and its tags in one transaction.
func (s *Store) Create(ctx context.Context, draft Draft) (*Idea, error) {
	title := strings.TrimSpace(draft.Title)
	if title == "" {
		return nil, ErrEmptyTitle
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`INSERT INTO ideas (title, notes, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		title, draft.Notes, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting idea: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("reading new id: %w", err)
	}

	tags := normalizeTagSet(draft.Tags)
	if err := upsertTags(ctx, tx, id, tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return &Idea{
		ID: id, Title: title, Notes: draft.Notes, Tags: tags,
		CreatedAt: now, UpdatedAt: now,
	}, nil
}

// Get loads one idea, archived or not, with its tags.
func (s *Store) Get(ctx context.Context, id int64) (*Idea, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, title, notes, created_at, updated_at, archived_at
		 FROM ideas WHERE id = ?`, id)

	found, err := scanIdea(row)
	if err != nil {
		return nil, err
	}
	if found.Tags, err = loadTags(ctx, s.db, found.ID); err != nil {
		return nil, err
	}
	return found, nil
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanIdea(row rowScanner) (*Idea, error) {
	var found Idea
	var archivedAt sql.NullTime
	err := row.Scan(&found.ID, &found.Title, &found.Notes,
		&found.CreatedAt, &found.UpdatedAt, &archivedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scanning idea: %w", err)
	}
	if archivedAt.Valid {
		found.ArchivedAt = &archivedAt.Time
	}
	found.Tags = []string{} // never nil: JSON must be [] not null
	return &found, nil
}

// querier covers *sql.DB and *sql.Tx.
type querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func loadTags(ctx context.Context, q querier, ideaID int64) ([]string, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT t.name FROM tags t
		 JOIN idea_tags it ON it.tag_id = t.id
		 WHERE it.idea_id = ?
		 ORDER BY t.name`, ideaID)
	if err != nil {
		return nil, fmt.Errorf("loading tags: %w", err)
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, name)
	}
	return tags, rows.Err()
}

// upsertTags creates any missing tags and links them all to the idea.
// Callers pass an already-normalized set.
func upsertTags(ctx context.Context, q querier, ideaID int64, tags []string) error {
	for _, name := range tags {
		if _, err := q.ExecContext(ctx,
			`INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING`,
			name,
		); err != nil {
			return fmt.Errorf("inserting tag %q: %w", name, err)
		}
		var tagID int64
		if err := q.QueryRowContext(ctx,
			`SELECT id FROM tags WHERE name = ?`, name,
		).Scan(&tagID); err != nil {
			return fmt.Errorf("reading tag %q: %w", name, err)
		}
		if _, err := q.ExecContext(ctx,
			`INSERT INTO idea_tags (idea_id, tag_id) VALUES (?, ?)
			 ON CONFLICT DO NOTHING`, ideaID, tagID,
		); err != nil {
			return fmt.Errorf("linking tag %q: %w", name, err)
		}
	}
	return nil
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `go test ./internal/idea/ -v -race`
Expected: PASS — six tests.

- [ ] **Step 6: Commit**

```bash
git add internal/idea
git commit -m "feat(idea): domain types, tag normalization, Create and Get"
```

---

> **Tasks 4, 5, 6 and 7 are independent of one another.** Each depends only on Task 3. They are in separate files so four agents can work simultaneously without conflicts.

## Task 4: List with search and filters

**Files:**
- Create: `internal/idea/store_list.go`, `internal/idea/store_list_test.go`

**Interfaces:**
- Consumes: `Store`, `scanIdea`, `loadTags` (Task 3)
- Produces: `idea.ListFilter{Query string; Tag string; Archived bool}`, `(*Store).List(ctx, ListFilter) ([]Idea, error)`

- [ ] **Step 1: Write the failing test**

```go
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/idea/ -run TestList -v`
Expected: FAIL — `undefined: ListFilter`

- [ ] **Step 3: Implement `internal/idea/store_list.go`**

```go
package idea

import (
	"context"
	"fmt"
	"strings"
)

// ListFilter narrows the bank. Query and Tag combine with AND.
// Archived is a separate place, never merged with active ideas.
type ListFilter struct {
	Query    string
	Tag      string
	Archived bool
}

// List returns matching ideas, newest first, each with its tags loaded.
func (s *Store) List(ctx context.Context, filter ListFilter) ([]Idea, error) {
	var where []string
	var args []any

	if filter.Archived {
		where = append(where, "i.archived_at IS NOT NULL")
	} else {
		where = append(where, "i.archived_at IS NULL")
	}

	if q := strings.TrimSpace(filter.Query); q != "" {
		// LIKE is case-insensitive for ASCII in SQLite by default.
		where = append(where, "(i.title LIKE ? OR i.notes LIKE ?)")
		pattern := "%" + q + "%"
		args = append(args, pattern, pattern)
	}

	if tag := NormalizeTag(filter.Tag); tag != "" {
		where = append(where, `i.id IN (
			SELECT it.idea_id FROM idea_tags it
			JOIN tags t ON t.id = it.tag_id
			WHERE t.name = ?)`)
		args = append(args, tag)
	}

	// Archived ideas sort by when they were binned; active by when created.
	order := "i.created_at DESC, i.id DESC"
	if filter.Archived {
		order = "i.archived_at DESC, i.id DESC"
	}

	query := fmt.Sprintf(
		`SELECT i.id, i.title, i.notes, i.created_at, i.updated_at, i.archived_at
		 FROM ideas i WHERE %s ORDER BY %s`,
		strings.Join(where, " AND "), order)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing ideas: %w", err)
	}
	defer rows.Close()

	ideas := []Idea{}
	for rows.Next() {
		found, err := scanIdea(rows)
		if err != nil {
			return nil, err
		}
		ideas = append(ideas, *found)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating ideas: %w", err)
	}

	// Tags load after the rows are closed: SetMaxOpenConns(1) means a query
	// issued while rows are open would deadlock.
	for i := range ideas {
		if ideas[i].Tags, err = loadTags(ctx, s.db, ideas[i].ID); err != nil {
			return nil, err
		}
	}
	return ideas, nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `go test ./internal/idea/ -v -race`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/idea/store_list.go internal/idea/store_list_test.go
git commit -m "feat(idea): list with search, tag filter and archived split"
```

---

## Task 5: Update with whole-set tag replacement

**Files:**
- Create: `internal/idea/store_update.go`, `internal/idea/store_update_test.go`

**Interfaces:**
- Consumes: `Store`, `upsertTags`, `loadTags` (Task 3)
- Produces: `(*Store).Update(ctx, id int64, draft Draft) (*Idea, error)`

- [ ] **Step 1: Write the failing test**

```go
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/idea/ -run TestUpdate -v`
Expected: FAIL — `store.Update undefined`

- [ ] **Step 3: Implement `internal/idea/store_update.go`**

```go
package idea

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Update rewrites an idea. The tag set is replaced wholesale: the request
// carries the complete array, so anything absent is removed (spec §6.1).
func (s *Store) Update(ctx context.Context, id int64, draft Draft) (*Idea, error) {
	title := strings.TrimSpace(draft.Title)
	if title == "" {
		return nil, ErrEmptyTitle
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`UPDATE ideas SET title = ?, notes = ?, updated_at = ? WHERE id = ?`,
		title, draft.Notes, now, id)
	if err != nil {
		return nil, fmt.Errorf("updating idea: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("reading rows affected: %w", err)
	}
	if affected == 0 {
		return nil, ErrNotFound
	}

	// Clear then re-link: simplest correct implementation of set replacement.
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM idea_tags WHERE idea_id = ?`, id); err != nil {
		return nil, fmt.Errorf("clearing tags: %w", err)
	}
	tags := normalizeTagSet(draft.Tags)
	if err := upsertTags(ctx, tx, id, tags); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing: %w", err)
	}

	return s.Get(ctx, id)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `go test ./internal/idea/ -v -race`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/idea/store_update.go internal/idea/store_update_test.go
git commit -m "feat(idea): update an idea, replacing the whole tag set"
```

---

## Task 6: Archive, Restore, Purge

**Files:**
- Create: `internal/idea/store_archive.go`, `internal/idea/store_archive_test.go`

**Interfaces:**
- Consumes: `Store`, `ErrNotFound` (Task 3)
- Produces: `(*Store).Archive(ctx, int64) error`, `(*Store).Restore(ctx, int64) error`, `(*Store).Purge(ctx, int64) error`

- [ ] **Step 1: Write the failing test**

```go
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/idea/ -run "TestArchive|TestRestore|TestPurge" -v`
Expected: FAIL — `store.Archive undefined`

- [ ] **Step 3: Implement `internal/idea/store_archive.go`**

```go
package idea

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Archive moves an idea to the trash. The row survives — losing an idea should
// take deliberate action (spec §1).
func (s *Store) Archive(ctx context.Context, id int64) error {
	return s.exec(ctx, "archiving",
		`UPDATE ideas SET archived_at = ?, updated_at = ? WHERE id = ?`,
		time.Now().UTC(), time.Now().UTC(), id)
}

// Restore brings an idea back out of the trash.
func (s *Store) Restore(ctx context.Context, id int64) error {
	return s.exec(ctx, "restoring",
		`UPDATE ideas SET archived_at = NULL, updated_at = ? WHERE id = ?`,
		time.Now().UTC(), id)
}

// Purge deletes an idea permanently. idea_tags rows go with it via
// ON DELETE CASCADE, which requires the foreign_keys pragma.
func (s *Store) Purge(ctx context.Context, id int64) error {
	return s.exec(ctx, "purging", `DELETE FROM ideas WHERE id = ?`, id)
}

// exec runs a statement that must affect exactly one row.
func (s *Store) exec(ctx context.Context, action, query string, args ...any) error {
	var res sql.Result
	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("%s idea: %w", action, err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("%s idea: reading rows affected: %w", action, err)
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `go test ./internal/idea/ -v -race`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/idea/store_archive.go internal/idea/store_archive_test.go
git commit -m "feat(idea): archive, restore and purge"
```

---

## Task 7: Random draw and tag listing

**Files:**
- Create: `internal/idea/store_random.go`, `internal/idea/store_random_test.go`

**Interfaces:**
- Consumes: `Store`, `scanIdea`, `loadTags`, `Tag` (Task 3)
- Produces: `(*Store).Random(ctx, tag string) (*Idea, error)`, `(*Store).Tags(ctx) ([]Tag, error)`

- [ ] **Step 1: Write the failing test**

Do not inject a seeded RNG. Assert membership and that repeated calls eventually vary — that tests the real thing.

```go
package idea

import (
	"context"
	"errors"
	"testing"
)

func TestRandomReturnsAStoredIdea(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	got, err := store.Random(ctx, "")
	if err != nil {
		t.Fatalf("Random() error = %v", err)
	}
	valid := map[string]bool{"Idea bank": true, "Tiny CLI": true, "Recipe sorter": true}
	if !valid[got.Title] {
		t.Errorf("Title = %q, not one of the seeded ideas", got.Title)
	}
}

func TestRandomEventuallyVaries(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	seen := map[string]bool{}
	for i := 0; i < 40; i++ {
		got, err := store.Random(ctx, "")
		if err != nil {
			t.Fatalf("Random() error = %v", err)
		}
		seen[got.Title] = true
	}
	if len(seen) < 2 {
		t.Errorf("40 draws returned only %v — not random", seen)
	}
}

func TestRandomRespectsTagFilter(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	for i := 0; i < 10; i++ {
		got, err := store.Random(ctx, "weekend")
		if err != nil {
			t.Fatalf("Random() error = %v", err)
		}
		if got.Title != "Recipe sorter" {
			t.Fatalf("Title = %q, want the only #weekend idea", got.Title)
		}
	}
}

func TestRandomExcludesArchived(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Binned"})
	if err := store.archiveForTest(ctx, created.ID); err != nil {
		t.Fatalf("archiving: %v", err)
	}

	_, err := store.Random(ctx, "")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Random() error = %v, want ErrNotFound — archived must not be drawn", err)
	}
}

func TestRandomOnEmptyBankReturnsErrNotFound(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Random(context.Background(), "")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Random() error = %v, want ErrNotFound", err)
	}
}

func TestTagsCountsOnlyActiveIdeas(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	seedIdeas(t, store)

	got, err := store.Tags(ctx)
	if err != nil {
		t.Fatalf("Tags() error = %v", err)
	}
	counts := map[string]int{}
	for _, tag := range got {
		counts[tag.Name] = tag.Count
	}
	if counts["go"] != 2 {
		t.Errorf("go count = %d, want 2", counts["go"])
	}
	if counts["weekend"] != 1 {
		t.Errorf("weekend count = %d, want 1", counts["weekend"])
	}
}

func TestTagsOmitsTagsWithOnlyArchivedIdeas(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{Title: "Only user of this tag", Tags: []string{"orphan"}})
	if err := store.archiveForTest(ctx, created.ID); err != nil {
		t.Fatalf("archiving: %v", err)
	}

	got, err := store.Tags(ctx)
	if err != nil {
		t.Fatalf("Tags() error = %v", err)
	}
	for _, tag := range got {
		if tag.Name == "orphan" {
			t.Error("orphan tag still offered for autocomplete")
		}
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `go test ./internal/idea/ -run "TestRandom|TestTags" -v`
Expected: FAIL — `store.Random undefined`

- [ ] **Step 3: Implement `internal/idea/store_random.go`**

```go
package idea

import (
	"context"
	"fmt"
)

// Random draws one active idea, optionally from a single tag. Stateless:
// nothing is recorded, so rerolling is free. ORDER BY RANDOM() is O(n), which
// is instant at this scale — do not optimise it.
func (s *Store) Random(ctx context.Context, tag string) (*Idea, error) {
	query := `SELECT i.id, i.title, i.notes, i.created_at, i.updated_at, i.archived_at
	          FROM ideas i WHERE i.archived_at IS NULL`
	var args []any

	if name := NormalizeTag(tag); name != "" {
		query += ` AND i.id IN (
			SELECT it.idea_id FROM idea_tags it
			JOIN tags t ON t.id = it.tag_id
			WHERE t.name = ?)`
		args = append(args, name)
	}
	query += ` ORDER BY RANDOM() LIMIT 1`

	found, err := scanIdea(s.db.QueryRowContext(ctx, query, args...))
	if err != nil {
		return nil, err // ErrNotFound when the bank (or the tag) is empty
	}
	if found.Tags, err = loadTags(ctx, s.db, found.ID); err != nil {
		return nil, err
	}
	return found, nil
}

// Tags lists tags carrying at least one active idea, with counts. Tags whose
// only ideas are archived are omitted: with no tag management screen they
// would otherwise haunt the autocomplete forever.
func (s *Store) Tags(ctx context.Context) ([]Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.name, COUNT(i.id) AS n
		 FROM tags t
		 JOIN idea_tags it ON it.tag_id = t.id
		 JOIN ideas i ON i.id = it.idea_id AND i.archived_at IS NULL
		 GROUP BY t.id, t.name
		 HAVING n > 0
		 ORDER BY t.name`)
	if err != nil {
		return nil, fmt.Errorf("listing tags: %w", err)
	}
	defer rows.Close()

	tags := []Tag{}
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.Name, &tag.Count); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `go test ./internal/idea/ -v -race`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/idea/store_random.go internal/idea/store_random_test.go
git commit -m "feat(idea): random draw and active tag listing"
```

---

## Task 8: HTTP API

**Files:**
- Create: `internal/httpapi/respond.go`, `internal/httpapi/server.go`, `internal/httpapi/ideas.go`, `internal/httpapi/ideas_test.go`, `internal/httpapi/testdata/idea.golden.json`

**Interfaces:**
- Consumes: everything from Tasks 3–7
- Produces: `httpapi.NewServer(*idea.Store, http.Handler) http.Handler`

- [ ] **Step 1: Write `internal/httpapi/respond.go`**

```go
package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// errorBody is the one error shape the API ever returns.
type errorBody struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("writing response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	var body errorBody
	body.Error.Message = message
	writeJSON(w, status, body)
}

// writeStoreError maps domain errors onto status codes in one place.
func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, idea.ErrNotFound):
		writeError(w, http.StatusNotFound, "That nugget isn't in the bank.")
	case errors.Is(err, idea.ErrEmptyTitle):
		writeError(w, http.StatusBadRequest, idea.ErrEmptyTitle.Error())
	default:
		log.Printf("unexpected store error: %v", err)
		writeError(w, http.StatusInternalServerError, "Something went wrong saving that.")
	}
}
```

- [ ] **Step 2: Write `internal/httpapi/server.go`**

```go
package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// NewServer builds the full handler: API routes plus the embedded frontend.
func NewServer(store *idea.Store, frontend http.Handler) http.Handler {
	h := &handlers{store: store}
	mux := http.NewServeMux()

	// Go 1.22+ method+wildcard patterns. Unmatched methods give 405 for free.
	mux.HandleFunc("GET /api/ideas", h.list)
	mux.HandleFunc("POST /api/ideas", h.create)
	mux.HandleFunc("GET /api/ideas/random", h.random)
	mux.HandleFunc("GET /api/ideas/{id}", h.get)
	mux.HandleFunc("PATCH /api/ideas/{id}", h.update)
	mux.HandleFunc("DELETE /api/ideas/{id}", h.purge)
	mux.HandleFunc("POST /api/ideas/{id}/archive", h.archive)
	mux.HandleFunc("POST /api/ideas/{id}/restore", h.restore)
	mux.HandleFunc("GET /api/tags", h.tags)

	if frontend != nil {
		mux.Handle("/", frontend)
	}

	return recoverer(logger(mux))
}

// recoverer turns a panic into a 500 instead of killing the server mid-session.
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("panic serving %s %s: %v", r.Method, r.URL.Path, v)
				writeError(w, http.StatusInternalServerError, "Something went wrong.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
```

- [ ] **Step 3: Write `internal/httpapi/ideas.go`**

```go
package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

type handlers struct {
	store *idea.Store
}

// pathID reads {id} and writes the 400 itself when it is not a number.
func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "That nugget id isn't a number.")
		return 0, false
	}
	return id, true
}

func decodeDraft(w http.ResponseWriter, r *http.Request) (idea.Draft, bool) {
	var draft idea.Draft
	if err := json.NewDecoder(r.Body).Decode(&draft); err != nil {
		writeError(w, http.StatusBadRequest, "That request wasn't valid JSON.")
		return draft, false
	}
	return draft, true
}

func (h *handlers) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ideas, err := h.store.List(r.Context(), idea.ListFilter{
		Query:    q.Get("q"),
		Tag:      q.Get("tag"),
		Archived: q.Get("archived") == "true",
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ideas)
}

func (h *handlers) create(w http.ResponseWriter, r *http.Request) {
	draft, ok := decodeDraft(w, r)
	if !ok {
		return
	}
	created, err := h.store.Create(r.Context(), draft)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *handlers) get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	found, err := h.store.Get(r.Context(), id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, found)
}

func (h *handlers) update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	draft, ok := decodeDraft(w, r)
	if !ok {
		return
	}
	updated, err := h.store.Update(r.Context(), id, draft)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *handlers) archive(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Archive)
}

func (h *handlers) restore(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Restore)
}

func (h *handlers) purge(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, h.store.Purge)
}

// mutate runs an id-only state change and returns 204.
func (h *handlers) mutate(w http.ResponseWriter, r *http.Request, action func(context.Context, int64) error) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if err := action(r.Context(), id); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) random(w http.ResponseWriter, r *http.Request) {
	drawn, err := h.store.Random(r.Context(), r.URL.Query().Get("tag"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, drawn)
}

func (h *handlers) tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.Tags(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tags)
}
```

- [ ] **Step 4: Write the failing test**

Create `internal/httpapi/ideas_test.go`.

```go
package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return NewServer(idea.NewStore(database), nil)
}

func do(t *testing.T, srv http.Handler, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshalling body: %v", err)
		}
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, target, reader)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestCreateThenListRoundTrip(t *testing.T) {
	srv := newTestServer(t)

	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{
		Title: "Idea bank", Notes: "this one", Tags: []string{"GO ", "saas"},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST status = %d, want 201; body = %s", rec.Code, rec.Body)
	}

	var created idea.Idea
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decoding create response: %v", err)
	}
	if len(created.Tags) != 2 || created.Tags[0] != "go" {
		t.Errorf("Tags = %v, want normalized [go saas]", created.Tags)
	}

	rec = do(t, srv, "GET", "/api/ideas", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want 200", rec.Code)
	}
	var listed []idea.Idea
	if err := json.Unmarshal(rec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decoding list: %v", err)
	}
	if len(listed) != 1 {
		t.Errorf("listed %d ideas, want 1", len(listed))
	}
}

func TestCreateBlankTitleReturns400WithMessage(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{Title: "  "})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v", err)
	}
	if body.Error.Message != "A nugget needs a title." {
		t.Errorf("message = %q, want the design system's copy", body.Error.Message)
	}
}

func TestEmptyListSerializesAsArrayNotNull(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "GET", "/api/ideas", nil)
	if got := bytes.TrimSpace(rec.Body.Bytes()); string(got) != "[]" {
		t.Errorf("body = %s, want [] — null would break the frontend's .map()", got)
	}
}

func TestArchiveRemovesFromActiveListAndAddsToTrash(t *testing.T) {
	srv := newTestServer(t)
	do(t, srv, "POST", "/api/ideas", idea.Draft{Title: "Bin me"})

	if rec := do(t, srv, "POST", "/api/ideas/1/archive", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("archive status = %d, want 204", rec.Code)
	}

	var active []idea.Idea
	json.Unmarshal(do(t, srv, "GET", "/api/ideas", nil).Body.Bytes(), &active)
	if len(active) != 0 {
		t.Errorf("active = %d, want 0", len(active))
	}

	var trash []idea.Idea
	json.Unmarshal(do(t, srv, "GET", "/api/ideas?archived=true", nil).Body.Bytes(), &trash)
	if len(trash) != 1 {
		t.Errorf("trash = %d, want 1", len(trash))
	}
}

func TestUnknownIdeaReturns404(t *testing.T) {
	srv := newTestServer(t)
	if rec := do(t, srv, "GET", "/api/ideas/999", nil); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestWrongMethodReturns405(t *testing.T) {
	srv := newTestServer(t)
	if rec := do(t, srv, "PUT", "/api/ideas", nil); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405 (ServeMux gives this free)", rec.Code)
	}
}

// TestIdeaJSONMatchesGolden is the drift alarm on the TypeScript contract:
// rename a field here and this fails, reminding you to update web/src/api.ts.
func TestIdeaJSONMatchesGolden(t *testing.T) {
	sample := idea.Idea{
		ID: 1, Title: "Idea bank", Notes: "this one",
		Tags: []string{"go", "saas"},
	}
	encoded, err := json.MarshalIndent(sample, "", "  ")
	if err != nil {
		t.Fatalf("marshalling: %v", err)
	}

	goldenPath := filepath.Join("testdata", "idea.golden.json")
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(goldenPath, encoded, 0o644); err != nil {
			t.Fatalf("writing golden: %v", err)
		}
	}
	want, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("reading golden (run with UPDATE_GOLDEN=1 to create): %v", err)
	}
	if string(bytes.TrimSpace(want)) != string(bytes.TrimSpace(encoded)) {
		t.Errorf("Idea JSON changed.\n got: %s\nwant: %s\n\nUpdate web/src/api.ts to match, then rerun with UPDATE_GOLDEN=1.", encoded, want)
	}
}
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `go test ./internal/httpapi/ -v`
Expected: FAIL — the golden file does not exist yet, and compilation errors if any handler is missing.

- [ ] **Step 6: Create the golden file and rerun**

```bash
mkdir -p internal/httpapi/testdata
UPDATE_GOLDEN=1 go test ./internal/httpapi/ -run TestIdeaJSONMatchesGolden
go test ./internal/httpapi/ -v -race
```

Expected: PASS — all tests. Inspect `internal/httpapi/testdata/idea.golden.json` and confirm the field names are `id`, `title`, `notes`, `tags`, `created_at`, `updated_at`, `archived_at`.

- [ ] **Step 7: Commit**

```bash
git add internal/httpapi
git commit -m "feat(httpapi): REST handlers, error shape and JSON contract test"
```

---

# TRACK B — Frontend

> Runs in parallel with Track A. Shares no files with it.

## Task 9: Vite + TypeScript scaffold

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/.eslintrc.cjs`

**Interfaces:**
- Consumes: nothing
- Produces: a dev server on 5173 proxying `/api` to Go, and a production build into `internal/web/dist`

- [ ] **Step 1: Scaffold**

```bash
cd web
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Pin TypeScript to 6.x**

TypeScript 7.0 ships no stable programmatic API until 7.1, so `typescript-eslint` cannot run on it. ESLint is worth more here than compile speed.

```bash
npm install --save-exact --save-dev typescript@6
npm install --save-dev vitest
```

Confirm `package.json` shows `"typescript": "6.x.x"` with no caret.

- [ ] **Step 3: Configure Vite**

Replace `web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // go:embed cannot reach outside its own package directory, so the
    // frontend builds into internal/web/dist rather than in place.
    outDir: '../internal/web/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Same-origin in dev, so CORS never enters the picture.
    proxy: { '/api': 'http://127.0.0.1:7777' },
  },
});
```

- [ ] **Step 4: Add scripts**

In `web/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "lint": "eslint src"
}
```

- [ ] **Step 5: Verify**

Run: `npm run build`
Expected: succeeds; `internal/web/dist/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add web internal/web/.gitignore
git commit -m "chore(web): scaffold Vite, React and TypeScript 6"
```

---

## Task 10: Vendor fonts and icons

**Files:**
- Create: `web/src/styles/tokens/fonts.css`
- Modify: `web/package.json`

**Interfaces:**
- Consumes: Task 9's package.json
- Produces: `@fontsource` imports replacing the Google Fonts CDN; `lucide-react` replacing the icon CDN

> Runs in parallel with Task 11.

- [ ] **Step 1: Install self-hosted fonts and icons**

The design system loads Baloo 2, Figtree and DM Mono from Google Fonts and Lucide from a CDN. A local-first app that opens at `127.0.0.1` must render correctly with no network, and must not call Google on every launch. Fontsource ships the same families as npm packages, bundled by Vite.

```bash
cd web
npm install @fontsource/baloo-2 @fontsource-variable/figtree @fontsource/dm-mono lucide-react
```

- [ ] **Step 2: Replace the CDN font token file**

Create `web/src/styles/tokens/fonts.css`, replacing the design system's `@import url("https://fonts.googleapis.com/...")`:

```css
/* Self-hosted replacements for the design system's CDN font imports.
   The app must render correctly with no network connection. */
@import "@fontsource/baloo-2/400.css";
@import "@fontsource/baloo-2/600.css";
@import "@fontsource/baloo-2/700.css";
@import "@fontsource/baloo-2/800.css";
@import "@fontsource-variable/figtree";
@import "@fontsource/dm-mono/400.css";
@import "@fontsource/dm-mono/500.css";
```

- [ ] **Step 3: Copy the remaining token files unchanged**

```bash
cp ../.claude/skills/nuggets-design/tokens/colors.css     src/styles/tokens/
cp ../.claude/skills/nuggets-design/tokens/typography.css src/styles/tokens/
cp ../.claude/skills/nuggets-design/tokens/spacing.css    src/styles/tokens/
cp ../.claude/skills/nuggets-design/tokens/shape.css      src/styles/tokens/
cp ../.claude/skills/nuggets-design/tokens/motion.css     src/styles/tokens/
cp ../.claude/skills/nuggets-design/tokens/base.css       src/styles/tokens/
cp -r ../.claude/skills/nuggets-design/assets             src/assets
```

Create `web/src/styles/index.css`:

```css
@import "./tokens/fonts.css";
@import "./tokens/colors.css";
@import "./tokens/typography.css";
@import "./tokens/spacing.css";
@import "./tokens/shape.css";
@import "./tokens/motion.css";
@import "./tokens/base.css";
```

Import it once from `web/src/main.tsx`:

```ts
import './styles/index.css';
```

- [ ] **Step 4: Verify no CDN references remain**

Run: `grep -r "fonts.googleapis\|cdn\." web/src/`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add web/src/styles web/src/assets web/package.json web/package-lock.json web/src/main.tsx
git commit -m "feat(web): vendor design tokens, self-hosted fonts and Lucide icons"
```

---

## Task 11: Port design system primitives to TypeScript

**Files:**
- Create: `web/src/components/core/{Button,Card,Badge,Tag,IconButton}.tsx`, `web/src/components/forms/{Input,Textarea,SearchField}.tsx`, `web/src/components/feedback/{Dialog,EmptyState}.tsx`, `web/src/components/navigation/TopBar.tsx`, `web/src/components/brand/{Wordmark,NuggetMark}.tsx`

**Interfaces:**
- Consumes: the design system reference copy
- Produces: typed primitives that Task 12 composes. Prop types are exactly the interfaces in each `.d.ts` — e.g. `ButtonProps{variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'lg'; fullWidth?: boolean; disabled?: boolean; iconLeft?: React.ReactNode; iconRight?: React.ReactNode; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; type?: 'button'|'submit'|'reset'; children?: React.ReactNode; style?: React.CSSProperties}`

> Runs in parallel with Task 10. This is thirteen mechanical conversions and can itself be split across agents by directory (`core/`, `forms/`, `feedback/`, `navigation/`, `brand/`).

- [ ] **Step 1: Understand the conversion recipe**

For each component the design system ships `X.jsx` (implementation) and `X.d.ts` (prop types). Merge them into one `X.tsx`:

1. Copy the body of `X.jsx`.
2. Copy the `interface XProps` from `X.d.ts` into the same file and `export` it.
3. Annotate the function: `export function X({ ... }: XProps) {`.
4. Change `.jsx` import specifiers to extensionless: `from '../core/Tag.jsx'` becomes `from '../core/Tag'`.
5. Delete `export declare function ...` — the real function replaces it.
6. Type the local lookup tables so indexing is safe.

Worked example — `Button.jsx` + `Button.d.ts` become `web/src/components/core/Button.tsx`:

```tsx
import React from 'react';

export interface ButtonProps {
  /** Visual weight. `primary` golden, `danger` ketchup, `secondary` outlined, `ghost` bare. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

interface SizeSpec { padding: string; height: number; fontSize: string; gap: number }
interface VariantSpec { bg: string; bgHover: string; fg: string; border: string; edge: string | null }

const nugBtnSizes: Record<NonNullable<ButtonProps['size']>, SizeSpec> = {
  sm: { padding: '0 14px', height: 34, fontSize: 'var(--text-body-sm)', gap: 6 },
  md: { padding: '0 20px', height: 42, fontSize: 'var(--text-body-md)', gap: 8 },
  lg: { padding: '0 28px', height: 52, fontSize: 'var(--text-body-lg)', gap: 10 },
};

const nugBtnVariants: Record<NonNullable<ButtonProps['variant']>, VariantSpec> = {
  primary:   { bg: 'var(--nug-golden-400)', bgHover: 'var(--nug-golden-500)', fg: 'var(--nug-ink-900)',  border: 'transparent',        edge: 'var(--nug-golden-600)' },
  danger:    { bg: 'var(--nug-ketchup-500)', bgHover: 'var(--nug-ketchup-600)', fg: 'var(--nug-cream-50)', border: 'transparent',      edge: 'var(--nug-ketchup-600)' },
  secondary: { bg: 'var(--nug-cream-50)',   bgHover: 'var(--nug-cream-200)',  fg: 'var(--nug-ink-900)',  border: 'var(--nug-ink-900)', edge: 'var(--nug-ink-900)' },
  ghost:     { bg: 'transparent',           bgHover: 'var(--nug-cream-200)',  fg: 'var(--nug-ink-700)',  border: 'transparent',        edge: null },
};

export function Button({
  variant = 'primary', size = 'md', fullWidth = false, disabled = false,
  iconLeft, iconRight, onClick, type = 'button', children, style,
}: ButtonProps) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = nugBtnSizes[size];
  const v = nugBtnVariants[variant];
  const lift = v.edge && !disabled;
  return (
    <button
      type={type} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, height: s.height, padding: s.padding, width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', fontSize: s.fontSize,
        letterSpacing: '0.005em', color: v.fg, background: hover && !disabled ? v.bgHover : v.bg,
        border: `var(--border-regular) solid ${v.border}`, borderRadius: 'var(--radius-pill)',
        boxShadow: lift ? (press ? `0 1px 0 ${v.edge}` : `0 3px 0 ${v.edge}`) : 'none',
        transform: lift && press ? 'translateY(2px)' : 'translateY(0)',
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        whiteSpace: 'nowrap', ...style,
      }}>
      {iconLeft}{children}{iconRight}
    </button>
  );
}
```

- [ ] **Step 2: Convert the remaining twelve primitives**

Apply the same recipe to `Card`, `Badge`, `Tag`, `IconButton`, `Input`, `Textarea`, `SearchField`, `Dialog`, `EmptyState`, `TopBar`, `Wordmark`, `NuggetMark`.

The code is not reproduced here because it already exists in the repo: read
`.claude/skills/nuggets-design/components/<group>/<Name>.jsx` for the
implementation and `<Name>.d.ts` for the prop interface, and merge them per the
recipe above. Nothing needs inventing — every prop type is already written.
Leave the skill folder itself untouched so a later designer re-sync can be
diffed against it.

- [ ] **Step 3: Verify with the type checker**

These are ports, not new logic, so the compiler is the gate rather than a test suite.

Run: `cd web; npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components
git commit -m "feat(web): port design system primitives to TypeScript"
```

---

## Task 12: Port the nuggets components and test the pure logic

**Files:**
- Create: `web/src/components/nuggets/{IdeaCard,IdeaList,IdeaForm,TagCombobox,TagFilter,RandomNugget,TrashView}.tsx`, `web/src/components/nuggets/fluidRadius.test.ts`, `web/src/lib/normalizeTag.ts`, `web/src/lib/normalizeTag.test.ts`

**Interfaces:**
- Consumes: Task 11's primitives
- Produces: `IdeaCard`, `IdeaList`, `IdeaForm`, `TagCombobox`, `TagFilter`, `RandomNugget`, `TrashView`, plus `fluidRadius(seed: string, min?: number, max?: number): string` and `normalizeTag(name: string): string`. Prop interfaces are exactly those in the design system's `.d.ts` files — `IdeaListItem{id: number|string; title: string; notes?: string; tags?: string[]; date?: string}`, `IdeaDraft{title: string; notes: string; tags: string[]}`, `ArchivedIdea{id: number|string; title: string; notes?: string; tags?: string[]; archivedAt?: string}`, `TagFilterItem{name: string; count?: number}`, `RandomIdea{title: string; notes?: string; tags?: string[]}`

- [ ] **Step 1: Port the seven components using Task 11's recipe**

Sources at `.claude/skills/nuggets-design/components/nuggets/`. Two notes while converting:

- `TagCombobox.d.ts` says "shadcn Command + Popover in the real build". **That comment is stale** — spec §4.1 was revised and shadcn is not used. Delete the parenthetical; keep the rest of the doc comment.
- `IdeaCard.jsx` exports `fluidRadius` alongside the component. Extract it into its own module so it can be unit tested, and re-export it from `IdeaCard.tsx` to preserve the design system's public surface.

- [ ] **Step 2: Write the failing tests for the pure functions**

These two functions are the only frontend logic worth testing — everything else is presentation the compiler already checks.

Create `web/src/lib/normalizeTag.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeTag } from './normalizeTag';

describe('normalizeTag', () => {
  it('lowercases and trims, matching the server rule', () => {
    expect(normalizeTag('  SaaS ')).toBe('saas');
    expect(normalizeTag('GO')).toBe('go');
  });

  it('is idempotent', () => {
    expect(normalizeTag(normalizeTag(' Weekend '))).toBe('weekend');
  });

  it('collapses to empty for whitespace only', () => {
    expect(normalizeTag('   ')).toBe('');
  });
});
```

Create `web/src/components/nuggets/fluidRadius.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fluidRadius } from './fluidRadius';

describe('fluidRadius', () => {
  it('is deterministic, so a card never changes shape between renders', () => {
    expect(fluidRadius('Idea bank')).toBe(fluidRadius('Idea bank'));
  });

  it('gives different seeds different shapes', () => {
    expect(fluidRadius('Idea bank')).not.toBe(fluidRadius('Tiny CLI'));
  });

  it('produces an eight-value border-radius string', () => {
    const [horizontal, vertical] = fluidRadius('Idea bank').split('/');
    expect(horizontal.trim().split(/\s+/)).toHaveLength(4);
    expect(vertical.trim().split(/\s+/)).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd web; npm test`
Expected: FAIL — cannot resolve `./normalizeTag` or `./fluidRadius`.

- [ ] **Step 4: Implement `web/src/lib/normalizeTag.ts`**

```ts
/**
 * Previews the server's tag rule so the lowercase normalization is never a
 * surprise in the combobox. The server owns the rule; this only mirrors it.
 */
export function normalizeTag(name: string): string {
  return name.trim().toLowerCase();
}
```

Then extract `fluidRadius` from the design system's `IdeaCard.jsx` into `web/src/components/nuggets/fluidRadius.ts`, adding types to the existing implementation, and re-export it from `IdeaCard.tsx`:

```ts
export { fluidRadius } from './fluidRadius';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd web; npm test; if ($?) { npm run typecheck }`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/nuggets web/src/lib
git commit -m "feat(web): port nuggets components with tested pure helpers"
```

---

# PHASE 2 — Integration

## Task 13: API client and screen composition

**Files:**
- Create: `web/src/api.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: Task 8's endpoints, Task 12's components
- Produces: `Idea`, `Tag`, `Draft` types and `api.{list,create,get,update,archive,restore,purge,random,tags}`

- [ ] **Step 1: Write `web/src/api.ts`**

Every fetch call and every shared type lives here, so the contract cannot drift unnoticed. These types mirror `internal/httpapi/testdata/idea.golden.json` — if that golden test fails, this file is what needs updating.

```ts
/** Mirrors internal/idea.Idea. Keep in sync with testdata/idea.golden.json. */
export interface Idea {
  id: number;
  title: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** Mirrors internal/idea.Tag. */
export interface Tag {
  name: string;
  count: number;
}

/** Mirrors internal/idea.Draft. tags is always the complete set. */
export interface Draft {
  title: string;
  notes: string;
  tags: string[];
}

export interface ListFilter {
  q?: string;
  tag?: string | null;
  archived?: boolean;
}

/** The API's single error shape: { "error": { "message": "..." } } */
export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed (${response.status})`;
    throw new ApiError(message);
  }
  return payload as T;
}

function query(filter: ListFilter): string {
  const params = new URLSearchParams();
  if (filter.q) params.set('q', filter.q);
  if (filter.tag) params.set('tag', filter.tag);
  if (filter.archived) params.set('archived', 'true');
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const api = {
  list: (filter: ListFilter = {}) => request<Idea[]>(`/api/ideas${query(filter)}`),
  get: (id: number) => request<Idea>(`/api/ideas/${id}`),
  create: (draft: Draft) =>
    request<Idea>('/api/ideas', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: number, draft: Draft) =>
    request<Idea>(`/api/ideas/${id}`, { method: 'PATCH', body: JSON.stringify(draft) }),
  archive: (id: number) => request<void>(`/api/ideas/${id}/archive`, { method: 'POST' }),
  restore: (id: number) => request<void>(`/api/ideas/${id}/restore`, { method: 'POST' }),
  purge: (id: number) => request<void>(`/api/ideas/${id}`, { method: 'DELETE' }),
  /** Returns null when the bank (or the filtered tag) has nothing active. */
  random: async (tag: string | null = null): Promise<Idea | null> => {
    try {
      return await request<Idea>(`/api/ideas/random${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`);
    } catch (err) {
      if (err instanceof ApiError) return null;
      throw err;
    }
  },
  tags: () => request<Tag[]>('/api/tags'),
};
```

- [ ] **Step 2: Compose the screen in `web/src/App.tsx`**

Use `.claude/skills/nuggets-design/ui_kits/web_app/BankApp.jsx` as the reference for composition — it is a working recreation of this exact screen against seed data. Replace its `data.js` seed arrays with `api` calls. The structure is: `TopBar` with the wordmark and a `Drop a nugget` button, `RandomNugget` wired to `api.random`, then either `IdeaList` or `TrashView` depending on a `showTrash` toggle, plus `IdeaForm` as the create/edit dialog and a purge confirm `Dialog`.

Required behaviour:
- Refetch the list whenever `q`, `activeTag` or `showTrash` changes.
- Refetch tags after any write, since `GET /api/tags` only returns tags with an active idea.
- On create or edit, pass the whole tag array — `PATCH` replaces the set.
- Render `ApiError.message` inline under the title field in `IdeaForm`. No toasts.
- Purge always goes behind the confirm dialog. Copy: `Purge this nugget? It's gone for good — restoring won't be an option.`

- [ ] **Step 3: Verify against the running backend**

In one terminal: `go run ./cmd/nuggets` (needs Task 14's `main.go`; until then run `go test ./... -race`).
In another: `cd web; npm run dev`, then open `http://localhost:5173`.

Check: create an idea, see it listed, search for it, filter by its tag, edit its tags and confirm removal sticks, archive it, find it in the trash, restore it, draw a random nugget and reroll, purge from the trash behind the confirm.

- [ ] **Step 4: Commit**

```bash
git add web/src/api.ts web/src/App.tsx
git commit -m "feat(web): typed API client and screen composition"
```

---

## Task 14: Embed the frontend and ship one binary

**Files:**
- Create: `internal/web/embed.go`, `cmd/nuggets/main.go`

**Interfaces:**
- Consumes: `httpapi.NewServer`, `db.Open`, `db.DefaultPath`, the Vite build output
- Produces: `nuggets.exe`

- [ ] **Step 1: Write `internal/web/embed.go`**

```go
// Package web serves the built frontend from inside the binary.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// The all: prefix matters — plain embed skips files beginning with _ or .,
// which would drop some Vite assets.
//
//go:embed all:dist
var dist embed.FS

// Handler serves the SPA, falling back to index.html for unknown paths so
// client-side routes survive a refresh.
func Handler() (http.Handler, error) {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil, err
	}
	files := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if _, err := fs.Stat(sub, name); err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		files.ServeHTTP(w, r)
	}), nil
}
```

Add `internal/web/dist/.gitkeep` so the package compiles before the first frontend build.

- [ ] **Step 2: Write `cmd/nuggets/main.go`**

```go
// Command nuggets serves the idea bank and opens it in a browser.
package main

import (
	"flag"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/httpapi"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/web"
)

func main() {
	// 127.0.0.1, never :7777 — binding all interfaces prompts the Windows
	// firewall on every rebuild and exposes the bank to the LAN.
	addr := flag.String("addr", "127.0.0.1:7777", "address to listen on")
	dbPath := flag.String("db", "", "database file (default: %AppData%\\nuggets\\nuggets.db)")
	open := flag.Bool("open", true, "open a browser on start")
	flag.Parse()

	path := *dbPath
	if path == "" {
		resolved, err := db.DefaultPath()
		if err != nil {
			log.Fatalf("locating database: %v", err)
		}
		path = resolved
	}

	database, err := db.Open(path)
	if err != nil {
		log.Fatalf("opening database: %v", err)
	}
	defer database.Close()

	frontend, err := web.Handler()
	if err != nil {
		log.Fatalf("loading frontend: %v", err)
	}

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listening on %s: %v", *addr, err)
	}

	url := "http://" + *addr
	log.Printf("nuggets is at %s (db: %s)", url, path)
	if *open {
		go func() {
			time.Sleep(200 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				log.Printf("could not open a browser: %v", err)
			}
		}()
	}

	server := &http.Server{
		Handler:           httpapi.NewServer(idea.NewStore(database), frontend),
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := server.Serve(listener); err != nil {
		log.Fatalf("serving: %v", err)
	}
}

// openBrowser launches the default browser. For a chromeless window instead,
// run: msedge --app=http://127.0.0.1:7777
func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		// The empty string is start's window-title argument; without it a
		// quoted URL would be swallowed as the title.
		return exec.Command("cmd", "/c", "start", "", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}
```

- [ ] **Step 3: Build and run end to end**

```bash
./build.ps1
./nuggets.exe
```

Expected: a browser opens at `http://127.0.0.1:7777`, the bank renders with the design system's styling, and every action from Task 13's checklist works against the real database at `%AppData%\nuggets\nuggets.db`.

- [ ] **Step 4: Confirm it works offline**

Disconnect from the network and reload. Fonts and icons must still render — that is what Task 10 bought.

- [ ] **Step 5: Run the whole test suite**

```bash
go test ./... -race
cd web; npm run typecheck; if ($?) { npm test }
```

Expected: all pass.

- [ ] **Step 6: Update the README's status section**

Replace "Designed, not built yet" with build and run instructions: `./build.ps1` then `./nuggets.exe`, plus the `msedge --app=` tip for a chromeless window.

- [ ] **Step 7: Commit**

```bash
git add internal/web cmd README.md
git commit -m "feat: embed frontend and ship a single self-opening binary"
```

---

## Verification checklist

Before calling the MVP done, confirm each spec requirement:

- [ ] An idea can be created with title, notes and tags (§2.1)
- [ ] Tags autocomplete from tags already in use (§2.2)
- [ ] `#SaaS` and `#saas` are the same tag (§5)
- [ ] Search matches title and notes, case-insensitively (§6)
- [ ] `q` and `tag` combine with AND (§6.1)
- [ ] Blank title returns 400 with `A nugget needs a title.` (§6.1)
- [ ] `PATCH` with fewer tags removes the missing ones (§6.1)
- [ ] Random draws only active ideas, and respects a tag filter (§6)
- [ ] Rerolling changes the result (§2.4)
- [ ] Archive hides from the list but keeps the row (§5)
- [ ] Trash shows archived ideas, newest binned first (§6)
- [ ] Restore returns an idea to the bank (§6)
- [ ] Purge is permanent and behind a confirm (§6)
- [ ] A tag whose only ideas are archived disappears from autocomplete (§6)
- [ ] Foreign keys are enforced — `PRAGMA foreign_keys` returns 1 (§11.3)
- [ ] The database is at `%AppData%\nuggets\nuggets.db` (§11.5)
- [ ] The app renders correctly with no network connection (§4.1)
- [ ] `go build` works without gcc installed (§11.1)
- [ ] `go test ./... -race` passes (§4)
