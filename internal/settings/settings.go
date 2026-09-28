// Package settings stores small app-level key/value preferences — the spices
// and GitHub integrations' state — in the settings table added by migration 00003. It is
// deliberately dumb: no validation, no defaults beyond "missing", so every
// caller decides for itself what an absent key means.
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
	return get(ctx, s.db, key)
}

// GetTx is Get inside a caller's transaction. Code already holding a
// transaction must read through it: the database has one connection, so a
// plain Get would wait for the transaction forever.
func (s *Store) GetTx(ctx context.Context, tx *sql.Tx, key string) (string, bool, error) {
	return get(ctx, tx, key)
}

type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func get(ctx context.Context, q rowQuerier, key string) (string, bool, error) {
	var value string
	err := q.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
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
	return set(ctx, s.db, key, value)
}

// SetTx is Set inside a caller's transaction, so a setting can commit
// atomically with other writes — the spices cursor with the page of nuggets
// it covers.
func (s *Store) SetTx(ctx context.Context, tx *sql.Tx, key, value string) error {
	return set(ctx, tx, key, value)
}

// DeleteTx is Delete inside a caller's transaction.
func (s *Store) DeleteTx(ctx context.Context, tx *sql.Tx, key string) error {
	return del(ctx, tx, key)
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func set(ctx context.Context, q execer, key, value string) error {
	_, err := q.ExecContext(ctx,
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
	return del(ctx, s.db, key)
}

func del(ctx context.Context, q execer, key string) error {
	if _, err := q.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key); err != nil {
		return fmt.Errorf("deleting setting %q: %w", key, err)
	}
	return nil
}
