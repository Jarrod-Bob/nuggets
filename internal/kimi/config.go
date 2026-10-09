package kimi

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// KeyURL is the one settings key the kimi integration keeps (design §3). This
// package owns it: the settings API handlers go through LoadURL and SaveURL.
const KeyURL = "kimi_url"

// DefaultBaseURL is where kimi-no-name-wa listens by default.
const DefaultBaseURL = "http://127.0.0.1:7799"

// ErrInvalidURL is the 400 message for a URL that can't be kimi's address.
var ErrInvalidURL = errors.New("kimi's address needs to be a full http or https URL, with no query or fragment.")

// LoadURL returns kimi's base URL, or DefaultBaseURL when none is saved.
func LoadURL(ctx context.Context, store *settings.Store) (string, error) {
	raw, _, err := store.Get(ctx, KeyURL)
	if err != nil {
		return "", err
	}
	if raw == "" {
		return DefaultBaseURL, nil
	}
	return raw, nil
}

// SaveURL validates raw and stores it, returning the URL as saved.
func SaveURL(ctx context.Context, store *settings.Store, raw string) (string, error) {
	valid, err := ValidateURL(raw)
	if err != nil {
		return "", err
	}
	if err := store.Set(ctx, KeyURL, valid); err != nil {
		return "", err
	}
	return valid, nil
}

// ValidateURL accepts an absolute http:// or https:// URL with a host and no
// query or fragment, and drops trailing slashes so the stored URL compares
// equal however it was typed.
func ValidateURL(raw string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	parsed, err := url.Parse(trimmed)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
		parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" || strings.Contains(trimmed, "#") {
		return "", ErrInvalidURL
	}
	return trimmed, nil
}
