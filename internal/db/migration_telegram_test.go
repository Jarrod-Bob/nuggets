package db

import (
	"path/filepath"
	"reflect"
	"testing"
)

// TestRetireTelegramMigrationDropsOnlyTelegramSettings seeds a database at the
// schema version before 00005 with every key the retired Telegram integration
// wrote alongside the spices keys, applies 00005, and checks exactly the
// Telegram rows are gone.
func TestRetireTelegramMigrationDropsOnlyTelegramSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")

	pre := openAt(t, path, 4)
	if _, err := pre.Exec(
		`INSERT INTO settings (key, value) VALUES
		    ('telegram_token', '123:secret'),
		    ('telegram_username', 'nuggets_bot'),
		    ('telegram_chat_id', '42'),
		    ('telegram_offset', '1001'),
		    ('telegram_pair_code', 'ABC234|1790000000'),
		    ('telegram_last_error', 'boom'),
		    ('telegram_last_sync_at', '2026-09-26T12:00:00Z'),
		    ('spices_url', 'http://127.0.0.1:8080'),
		    ('spices_token', 'spices-secret'),
		    ('spices_interval_seconds', '300'),
		    ('spices_cursor', '17'),
		    ('spices_last_sync_at', '2026-09-26T12:00:00Z'),
		    ('spices_last_error', 'nope'),
		    ('spices_needs_resync', '1'),
		    ('telegramXnot_ours', 'kept: _ is literal, not a wildcard')`); err != nil {
		t.Fatalf("seeding settings: %v", err)
	}
	pre.Close()

	post, err := Open(path)
	if err != nil {
		t.Fatalf("Open() after seeding error = %v", err)
	}
	defer post.Close()

	rows, err := post.Query(`SELECT key, value FROM settings ORDER BY key`)
	if err != nil {
		t.Fatalf("querying settings: %v", err)
	}
	defer rows.Close()
	got := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			t.Fatalf("scanning: %v", err)
		}
		got[key] = value
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterating: %v", err)
	}

	want := map[string]string{
		"spices_url":              "http://127.0.0.1:8080",
		"spices_token":            "spices-secret",
		"spices_interval_seconds": "300",
		"spices_cursor":           "17",
		"spices_last_sync_at":     "2026-09-26T12:00:00Z",
		"spices_last_error":       "nope",
		"spices_needs_resync":     "1",
		"telegramXnot_ours":       "kept: _ is literal, not a wildcard",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("settings after 00005 =\n %v\nwant\n %v", got, want)
	}
}
