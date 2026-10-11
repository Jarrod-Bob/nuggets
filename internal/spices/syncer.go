package spices

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// DefaultRequestTimeout bounds every call to spices, so a server that never
// answers can't wedge the loop.
const DefaultRequestTimeout = 15 * time.Second

// defaultPageLimit is how many items one GET /api/v1/items asks for. Each
// page's writes and its cursor commit in one transaction, so this also bounds
// how long a page holds the single DB connection.
const defaultPageLimit = 100

var (
	// ErrNotConfigured means no API token is stored: the loop is idle, not
	// failing.
	ErrNotConfigured = errors.New("spices: not connected")
	// ErrNeedsResync means spices answered 409 — its database was reset or
	// restored — and the captain hasn't pressed Re-sync yet. Nothing is
	// pulled until they do (design §5).
	ErrNeedsResync = errors.New("spices: " + ResetMessage)

	// errSuperseded means the settings changed (disconnect, a new token,
	// Re-sync) while a page was in flight, so the page was dropped unsaved
	// and the loop should start over under the new settings.
	errSuperseded = errors.New("spices: settings changed during sync")
)

// Syncer is the only thing in nuggets that calls spices (design §4). Drain
// pulls everything new and saves it; Loop decides when Drain runs — on
// startup, every interval, and whenever Sync is called — which keeps those
// three triggers from becoming three implementations.
type Syncer struct {
	ideas    *idea.Store
	settings *settings.Store
	// events hears about changes open pages should refetch: nuggets after a
	// pass that changed any, and the sync status whenever it changes.
	events events.Publisher

	httpClient     *http.Client
	baseBackoff    time.Duration
	maxBackoff     time.Duration
	requestTimeout time.Duration
	pageLimit      int
	// interval, when nonzero, overrides the stored interval. Only tests set it.
	interval time.Duration

	wake chan struct{}

	// mu is held from a page's arrival through its commit, by Reset and
	// Resync, and while Drain reads the settings it pulls under, so changing
	// the settings can't interleave with a page fetched under the old ones,
	// and a pull never starts from a half-made change — a new address with
	// the old one's cursor (issue #35).
	mu sync.Mutex

	// lastAcked is the cursor spices last accepted an acknowledgement for, or
	// -1 when unknown. Only an in-memory hint: the stored cursor is what
	// counts, and an acknowledgement is only a report (spices design §7).
	lastAcked atomic.Int64
}

// Option configures a Syncer away from its production defaults. Only tests
// need these, apart from WithEvents.
type Option func(*Syncer)

// WithEvents publishes changes to p (by default they go nowhere).
func WithEvents(p events.Publisher) Option { return func(s *Syncer) { s.events = p } }

func WithHTTPClient(c *http.Client) Option { return func(s *Syncer) { s.httpClient = c } }
func WithBackoff(base, max time.Duration) Option {
	return func(s *Syncer) { s.baseBackoff = base; s.maxBackoff = max }
}
func WithRequestTimeout(d time.Duration) Option { return func(s *Syncer) { s.requestTimeout = d } }
func WithPageLimit(n int) Option                { return func(s *Syncer) { s.pageLimit = n } }
func WithInterval(d time.Duration) Option       { return func(s *Syncer) { s.interval = d } }

func NewSyncer(ideas *idea.Store, settingsStore *settings.Store, opts ...Option) *Syncer {
	s := &Syncer{
		ideas:          ideas,
		settings:       settingsStore,
		events:         events.Nop{},
		httpClient:     http.DefaultClient,
		baseBackoff:    time.Second,
		maxBackoff:     5 * time.Minute,
		requestTimeout: DefaultRequestTimeout,
		pageLimit:      defaultPageLimit,
		wake:           make(chan struct{}, 1),
	}
	s.lastAcked.Store(-1)
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Sync wakes the loop for an immediate pull. It never calls spices itself
// and never blocks.
func (s *Syncer) Sync() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// Reset runs clear, which changes the stored connection, without racing a
// page in progress, then wakes the loop so it picks up the change.
func (s *Syncer) Reset(clear func() error) error {
	s.mu.Lock()
	err := clear()
	s.mu.Unlock()
	if err == nil {
		s.events.Publish(events.SpicesStatus)
	}
	s.Sync()
	return err
}

// Resync is the captain's answer to a 409 (design §5). In one transaction it
// detaches every spices nugget — source becomes spices-detached and the old
// id moves out of source_ref, so a reset spices reusing that id can never
// match it — resets the cursor to 0 and clears the 409 state. Then it wakes
// the loop to pull everything again. No nugget is deleted or edited. It
// returns how many nuggets were detached.
func (s *Syncer) Resync(ctx context.Context) (int64, error) {
	s.mu.Lock()
	moved, err := s.ideas.DetachSource(ctx, idea.SourceSpices, idea.SourceSpicesDetached,
		func(ctx context.Context, tx *sql.Tx) error {
			if err := s.settings.SetTx(ctx, tx, KeyCursor, "0"); err != nil {
				return err
			}
			if err := s.settings.DeleteTx(ctx, tx, KeyNeedsResync); err != nil {
				return err
			}
			return s.settings.DeleteTx(ctx, tx, KeyLastError)
		})
	if err == nil {
		s.lastAcked.Store(-1)
	}
	s.mu.Unlock()
	if err != nil {
		return 0, err
	}
	log.Printf("spices: re-sync detached %d nuggets and reset the cursor to 0", moved)
	if moved > 0 {
		s.events.Publish(events.IdeasChanged)
	}
	s.events.Publish(events.SpicesStatus)
	s.Sync()
	return moved, nil
}

// Drain pulls every idea after the stored cursor, a page at a time while
// spices reports has_more, saving each page and its new cursor in one
// transaction. Then it acknowledges the cursor (best effort) and records the
// sync time. It returns ErrNotConfigured with no token, ErrNeedsResync after
// a 409, and otherwise whatever spices or the network said. However many
// pages it saved, a pass that changed any nugget publishes IdeasChanged once,
// even if a later page failed.
func (s *Syncer) Drain(ctx context.Context) error {
	s.mu.Lock()
	cfg, err := LoadConfig(ctx, s.settings)
	s.mu.Unlock()
	if err != nil {
		return err
	}
	if !cfg.Connected {
		return ErrNotConfigured
	}
	if cfg.NeedsResync {
		return ErrNeedsResync
	}

	changed := false
	defer func() {
		if changed {
			s.events.Publish(events.IdeasChanged)
		}
	}()

	client := NewClient(cfg.URL, cfg.token, s.httpClient)
	cursor := cfg.Cursor
	for {
		reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
		page, err := client.Items(reqCtx, cursor, []string{ItemType}, s.pageLimit)
		cancel()
		if err != nil {
			var apiErr *APIError
			if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusConflict {
				return s.markNeedsResync(ctx, cfg, cursor)
			}
			return err
		}
		if page.Undecodable > 0 {
			log.Printf("spices: skipped %d undecodable items after cursor %d", page.Undecodable, cursor)
		}
		if page.NextCursor < cursor || (page.HasMore && page.NextCursor == cursor) {
			// A cursor that goes backwards or doesn't move would loop forever.
			return fmt.Errorf("spices: next_cursor %d does not advance past %d", page.NextCursor, cursor)
		}

		pageChanged, err := s.apply(ctx, cfg, cursor, page)
		changed = changed || pageChanged
		if err != nil {
			return err
		}
		cursor = page.NextCursor
		if !page.HasMore {
			break
		}
	}

	s.ack(ctx, client, cursor)
	return s.recordSync(ctx, cfg)
}

// apply saves one page and its cursor, unless the settings changed since the
// page was requested, in which case the page is dropped unsaved and Drain
// returns errSuperseded. It reports whether any nugget changed.
func (s *Syncer) apply(ctx context.Context, cfg Config, since int64, page Page) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	current, err := LoadConfig(ctx, s.settings)
	if err != nil {
		return false, err
	}
	if !current.sameSource(cfg) || current.NeedsResync || current.Cursor != since {
		return false, errSuperseded
	}
	if len(page.Items) == 0 && page.NextCursor == since {
		return false, nil // caught up: nothing to write
	}

	items := make([]idea.SyncedItem, 0, len(page.Items))
	for _, it := range page.Items {
		if it.Type != "" && it.Type != ItemType {
			continue // asked for ideas only; ignore anything else defensively
		}
		items = append(items, ToSynced(it))
	}
	result, err := s.ideas.ApplySynced(ctx, idea.SourceSpices, items, func(ctx context.Context, tx *sql.Tx) error {
		return s.settings.SetTx(ctx, tx, KeyCursor, strconv.FormatInt(page.NextCursor, 10))
	})
	if err != nil {
		return false, err
	}
	changed := result.Created+result.Updated+result.Archived > 0
	if changed {
		log.Printf("spices: pulled up to %d: %d new, %d refreshed, %d archived", page.NextCursor, result.Created, result.Updated, result.Archived)
	}
	return changed, nil
}

// markNeedsResync records a 409 and stops the loop from pulling until
// Re-sync. It never touches a nugget: detaching them is Re-sync's job, and
// only the captain starts it (design §5).
func (s *Syncer) markNeedsResync(ctx context.Context, cfg Config, since int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := LoadConfig(ctx, s.settings)
	if err != nil {
		return err
	}
	if !current.sameSource(cfg) || current.Cursor != since {
		return errSuperseded
	}
	if err := s.settings.Set(ctx, KeyNeedsResync, "1"); err != nil {
		return err
	}
	if err := s.settings.Set(ctx, KeyLastError, ResetMessage); err != nil {
		return err
	}
	s.events.Publish(events.SpicesStatus)
	log.Printf("spices: cursor %d is ahead of spices (409); pulling stops until Re-sync", since)
	return ErrNeedsResync
}

// ack reports the cursor to spices. Best effort: a failure is logged and not
// retried here; the next successful Drain tries again, so a failing ack is
// retried at most once per sync, never in a tight loop.
func (s *Syncer) ack(ctx context.Context, client *Client, cursor int64) {
	if s.lastAcked.Load() == cursor {
		return
	}
	ackCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
	defer cancel()
	if err := client.AckCursor(ackCtx, ConsumerName, cursor); err != nil {
		log.Printf("spices: acknowledging cursor %d: %v", cursor, err)
		return
	}
	s.lastAcked.Store(cursor)
}

// recordSync notes a successful pull and clears the last error, unless the
// connection changed meanwhile.
func (s *Syncer) recordSync(ctx context.Context, cfg Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := LoadConfig(ctx, s.settings)
	if err != nil {
		return err
	}
	if !current.sameSource(cfg) || current.NeedsResync {
		return errSuperseded
	}
	if err := s.settings.Set(ctx, KeyLastSync, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	if err := s.settings.Delete(ctx, KeyLastError); err != nil {
		return err
	}
	s.events.Publish(events.SpicesStatus)
	return nil
}

// recordError stores message for the Spices status, logging it only when it
// changes so a persistent failure doesn't fill the log at poll frequency. It
// stores nothing once disconnected, so a failure racing a disconnect can't
// leave a stale error behind, and it keeps the reason Re-sync is needed while
// one is stored.
func (s *Syncer) recordError(ctx context.Context, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := LoadConfig(ctx, s.settings)
	if err != nil || !cfg.Connected {
		return
	}
	if cfg.LastError == message || (cfg.NeedsResync && cfg.LastError != "") {
		return
	}
	log.Printf("spices: %s", message)
	if err := s.settings.Set(ctx, KeyLastError, message); err != nil {
		log.Printf("spices: recording last error: %v", err)
		return
	}
	s.events.Publish(events.SpicesStatus)
}

// Loop runs Drain until ctx is cancelled (design §4): immediately on start,
// then every interval, and at once whenever Sync is called. Network failures
// and 5xx back off from 1s doubling to 5 minutes; Sync cuts a backoff short.
// A missing token, a rejected token (401/403) or a 409 park the loop — no
// calls to spices at all — until Sync wakes it, which connecting, Re-sync and
// the Sync now button all do.
func (s *Syncer) Loop(ctx context.Context) {
	backoff := s.baseBackoff
	for {
		err := s.Drain(ctx)
		if ctx.Err() != nil {
			return
		}

		switch {
		case err == nil:
			backoff = s.baseBackoff
			if !s.sleep(ctx, s.currentInterval(ctx)) {
				return
			}
		case errors.Is(err, errSuperseded):
			// The settings changed under the pull; start again under the new ones.
		default:
			if reason, park := parkReason(err); park {
				if reason != "" {
					s.recordError(ctx, reason)
				}
				if !s.park(ctx) {
					return
				}
				backoff = s.baseBackoff
				continue
			}
			s.recordError(ctx, describe(err))
			if !s.sleep(ctx, backoff) {
				return
			}
			backoff *= 2
			if backoff > s.maxBackoff {
				backoff = s.maxBackoff
			}
		}
	}
}

func (s *Syncer) currentInterval(ctx context.Context) time.Duration {
	if s.interval > 0 {
		return s.interval
	}
	cfg, err := LoadConfig(ctx, s.settings)
	if err != nil {
		return DefaultInterval
	}
	return cfg.Interval
}

// parkReason reports whether retrying cannot help until the captain changes
// something, and what to tell them.
func parkReason(err error) (string, bool) {
	switch {
	case errors.Is(err, ErrNotConfigured):
		return "", true
	case errors.Is(err, ErrNeedsResync):
		return ResetMessage, true
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) && (apiErr.StatusCode == http.StatusUnauthorized || apiErr.StatusCode == http.StatusForbidden) {
		return "spices rejected the API token. Check it and connect again.", true
	}
	return "", false
}

// describe turns a transient failure into a line for the Spices status. The
// request URL may appear (it holds no secret); the token never does, since
// it only ever travels in a header. Only a transport failure is worded as
// spices being unreachable; anything else (a local database error, an
// undecodable or nonsensical answer) is not a network problem.
func describe(err error) string {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		if apiErr.Message != "" {
			return fmt.Sprintf("spices answered %d: %s", apiErr.StatusCode, apiErr.Message)
		}
		return fmt.Sprintf("spices answered %d.", apiErr.StatusCode)
	}
	var urlErr *url.Error
	var netErr net.Error
	if errors.As(err, &urlErr) || errors.As(err, &netErr) || errors.Is(err, context.DeadlineExceeded) {
		return "Couldn't reach spices: " + err.Error()
	}
	return "Syncing with spices failed: " + err.Error()
}

// park waits, without calling spices, until Sync or cancellation, reporting
// whether it was woken.
func (s *Syncer) park(ctx context.Context) bool {
	select {
	case <-s.wake:
		return true
	case <-ctx.Done():
		return false
	}
}

// sleep waits for d, a Sync, or cancellation, reporting whether to go on.
func (s *Syncer) sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-s.wake:
		return true
	case <-ctx.Done():
		return false
	}
}
