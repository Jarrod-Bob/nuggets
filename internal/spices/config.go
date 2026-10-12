package spices

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Settings keys (design §3). The spices package owns them: the settings API
// handlers and the Syncer are the only readers and writers.
const (
	KeyURL       = "spices_url"
	KeyToken     = "spices_token" // write-only: never returned by the API or logged
	KeyInterval  = "spices_interval_seconds"
	KeyCursor    = "spices_cursor"
	KeyLastSync  = "spices_last_sync_at" // RFC 3339
	KeyLastError = "spices_last_error"
	// KeyNeedsResync is "1" after spices answered 409 (its database was reset
	// or restored) or the address changed after a pull. Nothing is pulled
	// until the captain presses Re-sync.
	KeyNeedsResync = "spices_needs_resync"
	// KeyReattach is "1" from a Re-sync until the pull of everything that
	// follows it commits. That pull is applied in one go so its ideas can
	// reattach to the detached nuggets they match (design §5).
	KeyReattach = "spices_reattach"
)

const (
	// DefaultBaseURL is where spices listens by default (spices design §7).
	DefaultBaseURL = "http://127.0.0.1:7788"
	// DefaultInterval is how often the loop pulls when nothing else wakes it.
	DefaultInterval = 60 * time.Second
	// MinInterval and MaxInterval bound what the settings screen accepts.
	MinInterval = 10 * time.Second
	MaxInterval = 24 * time.Hour

	// ConsumerName is the name nuggets acknowledges its cursor under.
	ConsumerName = "nuggets"
	// ItemType is the only spices type nuggets pulls.
	ItemType = "idea"

	// ResetMessage is the Spices status error after a 409.
	ResetMessage = "spices was reset or restored; press Re-sync"
	// AddressChangedMessage is the Spices status error after the address
	// changed with something already pulled from the old one.
	AddressChangedMessage = "spices address changed; press Re-sync"
)

// Config is everything stored about the spices connection. Token is only
// ever read by the Syncer; handlers use Connected.
type Config struct {
	URL         string
	token       string
	Connected   bool
	Interval    time.Duration
	Cursor      int64
	LastSync    *time.Time
	LastError   string
	NeedsResync bool
	Reattach    bool
}

// sameSource reports whether c and other point at the same spices with the
// same credential, i.e. whether work fetched under one is still wanted under
// the other.
func (c Config) sameSource(other Config) bool {
	return c.Connected == other.Connected && c.URL == other.URL && c.token == other.token
}

// LoadConfig reads the stored connection, filling in defaults for anything
// missing or malformed.
func LoadConfig(ctx context.Context, store *settings.Store) (Config, error) {
	get := func(key string) (string, error) {
		v, _, err := store.Get(ctx, key)
		return v, err
	}

	cfg := Config{URL: DefaultBaseURL, Interval: DefaultInterval}
	var err error

	var raw string
	if raw, err = get(KeyURL); err != nil {
		return Config{}, err
	}
	if raw != "" {
		cfg.URL = raw
	}
	if cfg.token, err = get(KeyToken); err != nil {
		return Config{}, err
	}
	cfg.Connected = cfg.token != ""

	if raw, err = get(KeyInterval); err != nil {
		return Config{}, err
	}
	if secs, perr := strconv.Atoi(raw); perr == nil && secs > 0 {
		cfg.Interval = time.Duration(secs) * time.Second
	}

	if raw, err = get(KeyCursor); err != nil {
		return Config{}, err
	}
	if n, perr := strconv.ParseInt(raw, 10, 64); perr == nil && n > 0 {
		cfg.Cursor = n
	}

	if raw, err = get(KeyLastSync); err != nil {
		return Config{}, err
	}
	if t, perr := time.Parse(time.RFC3339, raw); perr == nil {
		cfg.LastSync = &t
	}

	if cfg.LastError, err = get(KeyLastError); err != nil {
		return Config{}, err
	}
	if raw, err = get(KeyNeedsResync); err != nil {
		return Config{}, err
	}
	cfg.NeedsResync = raw == "1"
	if raw, err = get(KeyReattach); err != nil {
		return Config{}, err
	}
	cfg.Reattach = raw == "1"
	return cfg, nil
}

// NormalizeBaseURL trims whitespace and trailing slashes, so the stored URL
// compares equal however it was typed.
func NormalizeBaseURL(raw string) string {
	return strings.TrimRight(strings.TrimSpace(raw), "/")
}
