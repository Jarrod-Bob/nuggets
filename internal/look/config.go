// Package look owns the one setting that picks how nuggets looks: Classic or
// Comic (see CONTEXT.md and docs/adr/0002-two-looks-split-at-the-view.md).
package look

import (
	"context"
	"errors"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// KeyLook is the one settings key this package keeps. Nothing else reads or
// writes it: the settings API and the page server go through Load and Save.
const KeyLook = "look"

// The two Looks.
const (
	Classic = "classic"
	Comic   = "comic"
)

// ErrInvalid is the 400 message for a value that isn't a Look.
var ErrInvalid = errors.New("the look has to be classic or comic.")

// Valid reports whether v names a Look.
func Valid(v string) bool { return v == Classic || v == Comic }

// Load returns the saved Look. Unset or unrecognised reads as Classic.
func Load(ctx context.Context, store *settings.Store) (string, error) {
	raw, _, err := store.Get(ctx, KeyLook)
	if err != nil {
		return "", err
	}
	if !Valid(raw) {
		return Classic, nil
	}
	return raw, nil
}

// Save stores v, which must be a Look.
func Save(ctx context.Context, store *settings.Store, v string) error {
	if !Valid(v) {
		return ErrInvalid
	}
	return store.Set(ctx, KeyLook, v)
}
