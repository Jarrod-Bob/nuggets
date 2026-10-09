package db

import (
	"path/filepath"
	"testing"
)

func TestOpenReadOnlyReadsButNeverWrites(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nuggets.db")
	rw, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := rw.Exec(`INSERT INTO settings (key, value) VALUES ('k', 'v')`); err != nil {
		t.Fatal(err)
	}
	rw.Close()

	ro, err := OpenReadOnly(path)
	if err != nil {
		t.Fatal(err)
	}
	defer ro.Close()
	var v string
	if err := ro.QueryRow(`SELECT value FROM settings WHERE key = 'k'`).Scan(&v); err != nil || v != "v" {
		t.Fatalf("read = %q, %v", v, err)
	}
	if _, err := ro.Exec(`INSERT INTO settings (key, value) VALUES ('x', 'y')`); err == nil {
		t.Fatal("a write through a read-only handle succeeded")
	}
}

func TestOpenReadOnlyRefusesAMissingFile(t *testing.T) {
	if _, err := OpenReadOnly(filepath.Join(t.TempDir(), "nope.db")); err == nil {
		t.Fatal("opening a missing database succeeded")
	}
}
