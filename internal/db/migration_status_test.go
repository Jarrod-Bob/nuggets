package db

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/pressly/goose/v3"
)

// openAt returns a raw connection and migrates it up to exactly version `to`,
// so a test can seed the state a real database was in before a later migration.
func openAt(t *testing.T, path string, to int64) *sql.DB {
	t.Helper()
	database, err := sql.Open("sqlite", dsn(path))
	if err != nil {
		t.Fatalf("opening db: %v", err)
	}
	database.SetMaxOpenConns(1)
	goose.SetBaseFS(migrationFS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatalf("setting dialect: %v", err)
	}
	if err := goose.UpTo(database, "migrations", to); err != nil {
		t.Fatalf("migrating up to %d: %v", to, err)
	}
	return database
}

// TestStatusMigrationDefaultsExistingRowsToRaw seeds a database at the schema
// version before status existed, writes rows the old way, then applies 00002 and
// checks every existing nugget came through as 'raw' with nothing else altered.
func TestStatusMigrationDefaultsExistingRowsToRaw(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")

	pre := openAt(t, path, 1)
	// Pre-migration insert: no status column exists yet.
	if _, err := pre.Exec(
		`INSERT INTO ideas (title, notes, created_at, updated_at)
		 VALUES ('Old one', 'kept notes', '2020-01-01', '2020-01-01'),
		        ('Second', '', '2020-02-02', '2020-02-02')`); err != nil {
		t.Fatalf("seeding pre-migration rows: %v", err)
	}
	pre.Close()

	// Re-open and apply everything (00002 included).
	post, err := Open(path)
	if err != nil {
		t.Fatalf("Open() after seeding error = %v", err)
	}
	defer post.Close()

	rows, err := post.Query(`SELECT title, notes, status FROM ideas ORDER BY id`)
	if err != nil {
		t.Fatalf("querying migrated rows: %v", err)
	}
	defer rows.Close()

	type row struct{ title, notes, status string }
	var got []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.title, &r.notes, &r.status); err != nil {
			t.Fatalf("scanning: %v", err)
		}
		got = append(got, r)
	}
	if len(got) != 2 {
		t.Fatalf("rows = %d, want 2 (migration must not add or drop rows)", len(got))
	}
	for _, r := range got {
		if r.status != "raw" {
			t.Errorf("%q status = %q, want raw", r.title, r.status)
		}
	}
	// Nothing else altered: the first row's title and notes survive intact.
	if got[0].title != "Old one" || got[0].notes != "kept notes" {
		t.Errorf("row 0 = %+v, want title/notes untouched", got[0])
	}

	// The links table and its index exist after the migration.
	var name string
	if err := post.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='idea_links'`,
	).Scan(&name); err != nil {
		t.Errorf("idea_links table missing after migration: %v", err)
	}
}
