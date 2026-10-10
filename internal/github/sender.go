package github

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// DefaultRequestTimeout bounds every call to GitHub, so a request that never
// answers can't wedge the queue.
const DefaultRequestTimeout = 15 * time.Second

const (
	// maxIdle is the longest the loop sleeps with nothing due. A pass that
	// finds nothing only reads the database.
	maxIdle = 5 * time.Minute
	// searchSlack widens the duplicate search's lower bound, in case
	// GitHub's clock is behind ours.
	searchSlack = 5 * time.Minute
)

// Messages for the GitHub status line and for rows waiting on it.
const (
	RejectedMessage = "GitHub rejected the token. Check it (Issues: Read and write on the repository) and save it again."
	waitingForToken = "Waiting for a GitHub token that works."
)

var (
	// errNotConfigured means no token is stored: rows wait, nothing is sent.
	errNotConfigured = errors.New("github: not connected")
	// errRejected means GitHub answered 401 for the stored token. Nothing is
	// sent until the token changes.
	errRejected = errors.New("github: token rejected")
)

// pausedError stops a pass until a time: a rate limit, or backing off after
// GitHub was unreachable or failing.
type pausedError struct{ until time.Time }

func (e *pausedError) Error() string { return "github: paused until " + e.until.Format(time.RFC3339) }

// Sender is the only thing in nuggets that calls GitHub (design §5). Loop
// runs passes; each pass sends every due row of the Outbox in turn.
type Sender struct {
	outbox   *Outbox
	ideas    *idea.Store
	settings *settings.Store
	events   events.Publisher

	httpClient     *http.Client
	baseURL        string
	baseBackoff    time.Duration
	maxBackoff     time.Duration
	requestTimeout time.Duration
	now            func() time.Time

	// mu guards the fields below and is held by Reset and while recording
	// the status, so a settings change can't interleave with a status write
	// made under the old settings. Never held across a network call.
	mu sync.Mutex
	// rejectedToken is the token GitHub last answered 401 for. While it is
	// still the stored token, passes send nothing.
	rejectedToken string
	// pauseUntil holds every row back after a rate limit or a transient
	// failure.
	pauseUntil time.Time
	// failures counts consecutive transient failures, for pauseUntil's
	// backoff.
	failures int
}

// Option configures a Sender away from its production defaults. Only tests
// need these, apart from WithEvents.
type Option func(*Sender)

// WithEvents publishes changes to p (by default they go nowhere).
func WithEvents(p events.Publisher) Option { return func(s *Sender) { s.events = p } }

func WithHTTPClient(c *http.Client) Option { return func(s *Sender) { s.httpClient = c } }

// WithBaseURL points the Sender at a fake GitHub. Production always uses
// DefaultBaseURL.
func WithBaseURL(u string) Option { return func(s *Sender) { s.baseURL = u } }

func WithBackoff(base, max time.Duration) Option {
	return func(s *Sender) { s.baseBackoff = base; s.maxBackoff = max }
}
func WithRequestTimeout(d time.Duration) Option { return func(s *Sender) { s.requestTimeout = d } }

// WithClock replaces the clock Pass uses to decide when a pause or a retry is
// over (the Loop's own sleeps still use real time),
// so tests don't depend on timer resolution.
func WithClock(now func() time.Time) Option { return func(s *Sender) { s.now = now } }

func NewSender(outbox *Outbox, ideas *idea.Store, settingsStore *settings.Store, opts ...Option) *Sender {
	s := &Sender{
		outbox:         outbox,
		ideas:          ideas,
		settings:       settingsStore,
		events:         events.Nop{},
		httpClient:     http.DefaultClient,
		baseURL:        DefaultBaseURL,
		baseBackoff:    5 * time.Second,
		maxBackoff:     30 * time.Minute,
		requestTimeout: DefaultRequestTimeout,
		now:            time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Wake asks for a pass now. It never calls GitHub itself and never blocks.
func (s *Sender) Wake() { s.outbox.Wake() }

// Issues returns a nugget's feature requests.
func (s *Sender) Issues(ctx context.Context, ideaID int64) ([]Issue, error) {
	return s.outbox.ForIdea(ctx, ideaID)
}

// Retry puts a failed feature request back in the queue.
func (s *Sender) Retry(ctx context.Context, id int64) (Issue, error) {
	is, err := s.outbox.Retry(ctx, id)
	if err == nil {
		s.events.Publish(events.GitHubChanged)
	}
	return is, err
}

// Counts reports how many feature requests are queued and how many failed.
func (s *Sender) Counts(ctx context.Context) (pending, failed int, err error) {
	return s.outbox.Counts(ctx)
}

// Reset runs change, which edits the stored GitHub settings, without racing
// a status write, then wakes the loop. A new token lifts a 401 park and any
// pause: it has its own rate limit and deserves a fresh try.
func (s *Sender) Reset(ctx context.Context, change func() error) error {
	s.mu.Lock()
	before, err := LoadConfig(ctx, s.settings)
	if err == nil {
		err = change()
	}
	if err == nil {
		after, loadErr := LoadConfig(ctx, s.settings)
		if loadErr == nil && after.token != before.token {
			s.rejectedToken = ""
			s.pauseUntil = time.Time{}
			s.failures = 0
		}
	}
	s.mu.Unlock()
	if err == nil {
		s.events.Publish(events.GitHubChanged)
	}
	s.Wake()
	return err
}

// Pass sends every due row, one at a time, until none is due or something
// stops the pass: no token, a rejected token, a rate limit, or a transient
// failure. A row GitHub refuses for good is marked failed and the pass
// moves on.
func (s *Sender) Pass(ctx context.Context) error {
	cfg, err := LoadConfig(ctx, s.settings)
	if err != nil {
		return err
	}
	if !cfg.Connected {
		return errNotConfigured
	}
	s.mu.Lock()
	rejected := s.rejectedToken != "" && s.rejectedToken == cfg.token
	pause := s.pauseUntil
	s.mu.Unlock()
	if rejected {
		return errRejected
	}
	if s.now().Before(pause) {
		return &pausedError{until: pause}
	}

	client := NewClient(s.baseURL, cfg.token, s.httpClient)
	for ctx.Err() == nil {
		row, ok, err := s.outbox.nextDue(ctx, s.now().UTC())
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		if err := s.send(ctx, client, cfg, row); err != nil {
			return err
		}
	}
	return ctx.Err()
}

// send delivers one row: it looks for an issue an earlier attempt may have
// created, then posts, then records the answer.
func (s *Sender) send(ctx context.Context, client *Client, cfg Config, row Issue) error {
	nugget, err := s.ideas.Get(ctx, row.IdeaID)
	if errors.Is(err, idea.ErrNotFound) {
		// Purging a nugget deletes its rows (ON DELETE CASCADE), so this is
		// only a guard.
		if err := s.outbox.markFailed(ctx, row.ID, "The nugget no longer exists."); err != nil {
			return err
		}
		s.events.Publish(events.GitHubChanged)
		return nil
	}
	if err != nil {
		return err
	}
	marker := row.marker
	if marker == "" {
		marker = Marker(row.IdeaID, row.key)
	}

	if row.Attempts > 0 {
		since := time.Now()
		if row.sentAt != nil {
			since = *row.sentAt
		}
		reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
		found, err := client.FindIssue(reqCtx, row.Repo, marker, since.Add(-searchSlack))
		cancel()
		if err != nil {
			return s.failed(ctx, cfg, row, err)
		}
		if found != nil {
			return s.created(ctx, cfg, row, *found)
		}
	}

	if ok, err := s.outbox.markSending(ctx, row, marker); err != nil || !ok {
		return err
	}
	row.Attempts++

	issue := NewIssue{Title: Title(nugget), Body: Body(nugget, marker), Labels: Labels}
	reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
	defer cancel()
	created, err := client.CreateIssue(reqCtx, row.Repo, issue)
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusUnprocessableEntity {
		// Most likely the label: the repository has no "enhancement" label
		// and the token can't create one. Once, without labels.
		issue.Labels = nil
		created, err = client.CreateIssue(reqCtx, row.Repo, issue)
	}
	if err != nil {
		return s.failed(ctx, cfg, row, err)
	}
	return s.created(ctx, cfg, row, created)
}

func (s *Sender) created(ctx context.Context, cfg Config, row Issue, issue CreatedIssue) error {
	if err := s.outbox.markCreated(ctx, row.ID, issue.Number, webURL(issue.HTMLURL)); err != nil {
		return err
	}
	s.mu.Lock()
	s.failures = 0
	s.mu.Unlock()
	log.Printf("github: opened %s#%d for nugget %d", row.Repo, issue.Number, row.IdeaID)
	s.recordStatus(ctx, cfg, "")
	s.events.Publish(events.GitHubChanged)
	return nil
}

// failed records a failed attempt on row and says whether the pass goes on
// (nil) or stops (the error the loop acts on).
func (s *Sender) failed(ctx context.Context, cfg Config, row Issue, err error) error {
	var apiErr *APIError
	isAPI := errors.As(err, &apiErr)
	now := s.now().UTC()

	switch {
	case isAPI && apiErr.StatusCode == http.StatusUnauthorized:
		s.mu.Lock()
		s.rejectedToken = cfg.token
		s.mu.Unlock()
		if err := s.outbox.markPending(ctx, row.ID, waitingForToken, nil); err != nil {
			return err
		}
		s.recordStatus(ctx, cfg, RejectedMessage)
		s.events.Publish(events.GitHubChanged)
		return errRejected

	case isAPI && apiErr.RateLimited:
		until := now.Add(apiErr.RetryAfter)
		s.mu.Lock()
		s.pauseUntil = until
		s.mu.Unlock()
		message := "GitHub's rate limit was reached; sending resumes at " + until.Local().Format("15:04") + "."
		if err := s.outbox.markPending(ctx, row.ID, message, &until); err != nil {
			return err
		}
		s.recordStatus(ctx, cfg, message)
		s.events.Publish(events.GitHubChanged)
		return &pausedError{until: until}

	case isAPI && permanent(apiErr.StatusCode):
		message := describe(err)
		if err := s.outbox.markFailed(ctx, row.ID, message); err != nil {
			return err
		}
		log.Printf("github: feature request for nugget %d on %s failed: %s", row.IdeaID, row.Repo, message)
		s.events.Publish(events.GitHubChanged)
		return nil

	default:
		message := describe(err)
		s.mu.Lock()
		s.failures++
		until := now.Add(s.backoff(s.failures))
		s.pauseUntil = until
		s.mu.Unlock()
		next := now.Add(s.backoff(row.Attempts))
		if err := s.outbox.markPending(ctx, row.ID, message, &next); err != nil {
			return err
		}
		s.recordStatus(ctx, cfg, message)
		s.events.Publish(events.GitHubChanged)
		return &pausedError{until: until}
	}
}

// permanent reports whether a status means retrying the same request can't
// help: the repository is missing or unreachable with this token, issues are
// off, or GitHub refused the content. 401, 408 and 429 are handled apart.
func permanent(status int) bool {
	return status >= 400 && status < 500 &&
		status != http.StatusUnauthorized && status != http.StatusRequestTimeout && status != http.StatusTooManyRequests
}

// backoff is baseBackoff doubled per earlier failure, capped at maxBackoff.
func (s *Sender) backoff(n int) time.Duration {
	d := s.baseBackoff
	for i := 1; i < n && d < s.maxBackoff; i++ {
		d *= 2
	}
	if d > s.maxBackoff {
		d = s.maxBackoff
	}
	return d
}

// recordStatus stores message as the GitHub status error ("" clears it),
// logging it only when it changes. It stores nothing if the token changed
// since cfg was read, so a failure racing a new token can't leave a stale
// error behind.
func (s *Sender) recordStatus(ctx context.Context, cfg Config, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := LoadConfig(ctx, s.settings)
	if err != nil || current.token != cfg.token || current.LastError == message {
		return
	}
	if message == "" {
		err = s.settings.Delete(ctx, KeyLastError)
	} else {
		log.Printf("github: %s", message)
		err = s.settings.Set(ctx, KeyLastError, message)
	}
	if err != nil {
		log.Printf("github: recording last error: %v", err)
		return
	}
	s.events.Publish(events.GitHubChanged)
}

// describe turns a failure into a line for the nugget page and the GitHub
// status. The request URL may appear (it holds no secret); the token never
// does, since it only travels in a header.
func describe(err error) string {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		msg := fmt.Sprintf("GitHub answered %d", apiErr.StatusCode)
		if apiErr.Message != "" {
			msg += ": " + apiErr.Message
		}
		switch apiErr.StatusCode {
		case http.StatusNotFound:
			msg += ". Check the repository name, and that the token has been given that repository."
		case http.StatusForbidden:
			msg += ". Check the token has Issues: Read and write on that repository."
		default:
			msg += "."
		}
		return msg
	}
	var urlErr *url.Error
	var netErr net.Error
	if errors.As(err, &urlErr) || errors.As(err, &netErr) || errors.Is(err, context.DeadlineExceeded) {
		return "Couldn't reach GitHub: " + err.Error()
	}
	return "Sending to GitHub failed: " + err.Error()
}

// webURL keeps an issue's html_url only if it is an http(s) address, since
// the nugget page renders it as a link.
func webURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return ""
	}
	return raw
}

// Loop runs passes until ctx is cancelled: at once, whenever woken (a row
// queued or retried, a settings change), and when the next backed-off row
// or pause falls due. With no token or a rejected one it parks — no calls
// to GitHub at all — until woken.
func (s *Sender) Loop(ctx context.Context) {
	backoff := s.baseBackoff
	for {
		err := s.Pass(ctx)
		if ctx.Err() != nil {
			return
		}
		var paused *pausedError
		switch {
		case errors.Is(err, errNotConfigured), errors.Is(err, errRejected):
			if !s.park(ctx) {
				return
			}
		case errors.As(err, &paused):
			if !s.sleep(ctx, time.Until(paused.until)) {
				return
			}
		case err != nil:
			// A local failure (the database), never a GitHub answer.
			log.Printf("github: %v", err)
			if !s.sleep(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, s.maxBackoff)
		default:
			backoff = s.baseBackoff
			wait := maxIdle
			if due, err := s.outbox.earliestDue(ctx); err == nil && due != nil {
				wait = min(wait, time.Until(*due))
			}
			if !s.sleep(ctx, wait) {
				return
			}
		}
	}
}

// park waits, without calling GitHub, until woken or cancelled, reporting
// whether it was woken.
func (s *Sender) park(ctx context.Context) bool {
	select {
	case <-s.outbox.wake:
		return true
	case <-ctx.Done():
		return false
	}
}

// sleep waits for d, a wake, or cancellation, reporting whether to go on.
func (s *Sender) sleep(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-s.outbox.wake:
		return true
	case <-ctx.Done():
		return false
	}
}
