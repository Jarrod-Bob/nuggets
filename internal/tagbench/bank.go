package tagbench

import (
	"context"
	"database/sql"
	"strconv"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/jev"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// LoadBank reads the active nuggets, with their dismissed suggestions,
// through the app's own stores. Open the database with db.OpenReadOnly.
func LoadBank(ctx context.Context, database *sql.DB) ([]Item, error) {
	nuggets, err := idea.NewStore(database).List(ctx, idea.ListFilter{})
	if err != nil {
		return nil, err
	}
	q := jev.NewQueue(database, settings.NewStore(database))
	items := make([]Item, 0, len(nuggets))
	for _, n := range nuggets {
		dismissed, err := q.Dismissed(ctx, n.ID)
		if err != nil {
			return nil, err
		}
		items = append(items, Item{
			ID: strconv.FormatInt(n.ID, 10), Dataset: DatasetBank, Group: DatasetBank, NuggetID: n.ID,
			Title: n.Title, Notes: n.Notes, Tags: n.Tags, UpdatedAt: n.UpdatedAt, Dismissed: dismissed,
		})
	}
	return items, nil
}

// JevKey reads the TypeSafe key the app stores (jev.KeyAPIKey). It is
// never logged or written anywhere.
func JevKey(ctx context.Context, database *sql.DB) (string, error) {
	key, _, err := settings.NewStore(database).Get(ctx, jev.KeyAPIKey)
	return key, err
}
