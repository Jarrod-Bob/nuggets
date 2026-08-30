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
