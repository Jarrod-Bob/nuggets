// Package settings stores small app-level key/value preferences — currently
// only the Telegram integration's state — in the settings table added by
// migration 00003. It is deliberately dumb: no validation, no defaults beyond
// "missing", so every caller decides for itself what an absent key means.
package settings

import (
	"context"
	"database/sql"
	"fmt"
)

// Store reads and writes rows of the settings table. Like idea.Store, it
// holds no state beyond the *sql.DB; every method call passes through to the
// single connection (internal/db's SetMaxOpenConns(1)).
type Store struct {
	db *sql.DB
}

func NewStore(database *sql.DB) *Store {
	return &Store{db: database}
}

// Get returns the value for key and true, or "" and false if the row is
// missing.
func (s *Store) Get(ctx context.Context, key string) (string, bool, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("reading setting %q: %w", key, err)
	}
	return value, true, nil
}

// Set writes key, replacing any existing value.
func (s *Store) Set(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key, value,
	)
	if err != nil {
		return fmt.Errorf("writing setting %q: %w", key, err)
	}
	return nil
}

// Delete removes key. Deleting a key that does not exist is not an error.
func (s *Store) Delete(ctx context.Context, key string) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key); err != nil {
		return fmt.Errorf("deleting setting %q: %w", key, err)
	}
	return nil
}
