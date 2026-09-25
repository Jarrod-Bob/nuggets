package telegram

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// pollTimeoutSeconds is how long a single getUpdates call holds the request
// open waiting for something to arrive (design §4.2).
const pollTimeoutSeconds = 25

// Poller is the single goroutine allowed to call Telegram (design §4.5). It
// owns Drain, the one routine that fetches everything waiting and saves it;
// startup, the held-open long poll, and the manual sync button are only three
// different ways of causing another call to Drain, never three separate
// implementations.
type Poller struct {
	ideas    *idea.Store
	settings *settings.Store

	// baseURL and httpClient are overridden in tests to point at an
	// httptest.NewServer fake instead of the real Telegram API.
	baseURL    func(token string) string
	httpClient *http.Client

	// baseBackoff is the initial network-failure backoff (design §9: "1s
	// doubling to a 5-minute ceiling"). Tests shrink this so failure-handling
	// tests run in milliseconds instead of minutes.
	baseBackoff time.Duration
	maxBackoff  time.Duration

	wake chan struct{}
}

// Option configures a Poller away from its production defaults. Only tests
// need these.
type Option func(*Poller)

func WithBaseURL(f func(token string) string) Option { return func(p *Poller) { p.baseURL = f } }
func WithHTTPClient(c *http.Client) Option           { return func(p *Poller) { p.httpClient = c } }
func WithBackoff(base, max time.Duration) Option {
	return func(p *Poller) { p.baseBackoff = base; p.maxBackoff = max }
}

// NewPoller builds a Poller against the real Telegram API. Pass Options to
// point it at a fake for tests.
func NewPoller(ideas *idea.Store, settingsStore *settings.Store, opts ...Option) *Poller {
	p := &Poller{
		ideas:       ideas,
		settings:    settingsStore,
		baseURL:     DefaultBaseURL,
		httpClient:  http.DefaultClient,
		baseBackoff: time.Second,
		maxBackoff:  5 * time.Minute,
		wake:        make(chan struct{}, 1),
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

// Sync wakes the loop for an immediate fetch. It never calls Telegram itself
// and never blocks — the loop's own in-flight getUpdates call remains the
// only caller (design §4.5, §6).
func (p *Poller) Sync() {
	select {
	case p.wake <- struct{}{}:
	default:
	}
}

// ErrNotConfigured is Drain's answer when no bot token is stored: capture is
// idle, not failing (design §3.4), and there is nothing to fetch until a
// token is connected.
var ErrNotConfigured = errors.New("telegram: no bot token connected")

// Drain fetches everything Telegram is holding for this bot and imports it.
// It returns ErrNotConfigured when there is no token yet and nil after a
// successful fetch, however many messages that fetch contained. Any other
// error is a Telegram or network failure the caller (Loop) decides how to
// handle (design §9).
func (p *Poller) Drain(ctx context.Context) error {
	return p.drain(ctx, ctx)
}

// drain is Drain with the getUpdates wait under its own pollCtx. Cancelling
// pollCtx abandons the wait, but a batch that has already arrived is imported
// and its offset saved under ctx, so a Sync can never leave one half-done.
func (p *Poller) drain(ctx, pollCtx context.Context) error {
	token, ok, err := p.settings.Get(ctx, KeyToken)
	if err != nil {
		return err
	}
	if !ok || token == "" {
		return ErrNotConfigured
	}

	offset, err := p.getOffset(ctx)
	if err != nil {
		return err
	}

	client := NewClient(p.baseURL(token), p.httpClient)
	updates, err := client.GetUpdates(pollCtx, offset, pollTimeoutSeconds)
	if err != nil {
		return err
	}
	if len(updates) == 0 {
		return nil
	}

	chatIDStr, paired, err := p.settings.Get(ctx, KeyChatID)
	if err != nil {
		return err
	}
	var chatID int64
	if paired {
		chatID, err = strconv.ParseInt(chatIDStr, 10, 64)
		if err != nil {
			paired = false // corrupt row: treat as unpaired rather than crash
		}
	}

	var lastUpdateID int64
	for _, u := range updates {
		lastUpdateID = u.UpdateID

		if u.Message == nil {
			continue // not a message at all (e.g. an edit): skip, advance position
		}
		msg := u.Message

		if !paired {
			// Authorization comes before anything else: an unpaired chat
			// never gets a reply, whether it sent the pairing code, a
			// nugget, or a photo — answering would confirm to a stranger
			// that the bot is live and listening (design §4.4).
			matched, err := p.tryPair(ctx, msg)
			if err != nil {
				log.Printf("telegram: pairing attempt: %v", err)
			}
			if matched {
				paired = true
				chatID = msg.Chat.ID
				p.reply(ctx, client, chatID, "Paired ✓ nuggets will save whatever you send here.")
			}
			continue
		}

		if msg.Chat.ID != chatID {
			continue // wrong chat: drop, advance position
		}

		if strings.TrimSpace(msg.Text) == "" {
			p.reply(ctx, client, chatID, "text only for now")
			continue // no text (photo, voice, document, ...): skip, advance position
		}

		parsed := ParseMessage(msg.Text)
		if parsed.Title == "" {
			continue // empty after trimming: skip like idea.ErrEmptyTitle
		}

		created, err := p.ideas.CreateImported(ctx, parsed.Title, parsed.Notes, parsed.Tags,
			SourceTelegram, strconv.FormatInt(msg.MessageID, 10))
		switch {
		case err == nil:
			p.reply(ctx, client, chatID, fmt.Sprintf("saved ✓ %s", created.Title))
		case errors.Is(err, idea.ErrAlreadyImported):
			// Already imported under this message id: a no-op, not a failure
			// (design §4.6). No reply — Telegram only redelivers this on a
			// restart or an offset problem, not on a fresh send.
		default:
			log.Printf("telegram: importing message %d: %v", msg.MessageID, err)
		}
	}

	return p.settings.Set(ctx, KeyOffset, strconv.FormatInt(lastUpdateID+1, 10))
}

func (p *Poller) getOffset(ctx context.Context) (int64, error) {
	raw, ok, err := p.settings.Get(ctx, KeyOffset)
	if err != nil || !ok || raw == "" {
		return 0, err
	}
	offset, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, nil // malformed stored offset: refetch from the start of Telegram's window rather than fail closed
	}
	return offset, nil
}

// tryPair checks msg against the active pairing code. A match binds chatID as
// the owner and consumes the code; anything else — wrong code, no code
// active, an expired one — leaves the bot unpaired.
func (p *Poller) tryPair(ctx context.Context, msg *Message) (bool, error) {
	active, ok, err := ActivePairCode(ctx, p.settings)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	candidate := strings.ToUpper(strings.TrimSpace(msg.Text))
	if candidate != active.Code {
		return false, nil
	}
	if err := p.settings.Set(ctx, KeyChatID, strconv.FormatInt(msg.Chat.ID, 10)); err != nil {
		return false, err
	}
	if err := p.settings.Delete(ctx, KeyPairCode); err != nil {
		return false, err
	}
	return true, nil
}

// reply sends a confirmation. Failures here are logged and otherwise
// ignored: the nugget (if any) is already saved, which is what matters
// (design §7).
func (p *Poller) reply(ctx context.Context, client *Client, chatID int64, text string) {
	if err := client.SendMessage(ctx, chatID, text); err != nil {
		log.Printf("telegram: replying to chat: %v", err)
	}
}

func (p *Poller) recordError(ctx context.Context, message string) {
	if err := p.settings.Set(ctx, KeyLastError, message); err != nil {
		log.Printf("telegram: recording last error: %v", err)
	}
}

func (p *Poller) clearError(ctx context.Context) {
	if err := p.settings.Delete(ctx, KeyLastError); err != nil {
		log.Printf("telegram: clearing last error: %v", err)
	}
}

// Loop runs Drain forever until ctx is cancelled. It is the only place that
// decides when to call Telegram again (design §4.2, §9): on success it loops
// immediately (Drain's own getUpdates call already held the connection open
// for up to 25s), a manual Sync() cancels the current wait and loops
// immediately, and a failure backs off or parks depending on what Telegram
// said. Parking (no token, 401, 409) stops all calls to Telegram but keeps
// this, the only getUpdates goroutine, alive: the next Sync() — connecting a
// token from settings, or the manual sync button — resumes capture without a
// process restart.
func (p *Poller) Loop(ctx context.Context) {
	backoff := p.baseBackoff

	for {
		pollCtx, cancel := context.WithCancel(ctx)
		done := make(chan error, 1)
		go func() { done <- p.drain(ctx, pollCtx) }()

		var err error
		woken := false
		select {
		case err = <-done:
		case <-p.wake:
			woken = true
			cancel()
			err = <-done
		case <-ctx.Done():
			cancel()
			<-done
			return
		}
		cancel()

		if err != nil && !errors.Is(err, context.Canceled) {
			if reason, ok := parkReason(err); ok {
				if woken {
					// The Sync that raced this result may carry its fix (a
					// newly connected token), so it earns one more try.
					continue
				}
				if reason != "" {
					p.recordError(ctx, reason)
				}
				if !p.park(ctx) {
					return
				}
				backoff = p.baseBackoff
				continue
			}
			var apiErr *APIError
			if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusTooManyRequests {
				p.recordError(ctx, "Telegram is rate-limiting this bot.")
				wait := time.Duration(apiErr.RetryAfter) * time.Second
				if wait <= 0 {
					wait = backoff
				}
				if !p.sleep(ctx, wait) {
					return
				}
				continue
			}
			// 5xx, anything else Telegram sent, and network failures: back
			// off and retry (design §9).
			if !p.sleep(ctx, backoff) {
				return
			}
			backoff *= 2
			if backoff > p.maxBackoff {
				backoff = p.maxBackoff
			}
			continue
		}

		backoff = p.baseBackoff
		p.clearError(ctx)
	}
}

// parkReason reports whether err means calling Telegram again cannot help
// until the user changes something and Syncs, and the message to show them
// for it, if any (design §9).
func parkReason(err error) (string, bool) {
	if errors.Is(err, ErrNotConfigured) {
		return "", true
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case http.StatusUnauthorized:
			// Retrying cannot help: wait for the user to connect a new token.
			return "The bot token is wrong or was revoked.", true
		case http.StatusConflict:
			// Retrying makes it worse: wait for the user to clear the
			// conflict and reconnect or press sync.
			return "Another poller or a registered webhook is already using this bot.", true
		}
	}
	return "", false
}

// park waits, without calling Telegram, until Sync() wakes the loop or ctx is
// cancelled, reporting whether it was woken.
func (p *Poller) park(ctx context.Context) bool {
	select {
	case <-p.wake:
		return true
	case <-ctx.Done():
		return false
	}
}

// sleep waits for d or ctx cancellation, reporting which happened.
func (p *Poller) sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
