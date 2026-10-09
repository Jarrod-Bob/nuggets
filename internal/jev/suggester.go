package jev

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// DefaultRequestTimeout bounds every call to TypeSafe, so a request that
// never answers can't wedge the queue.
const DefaultRequestTimeout = 30 * time.Second

const (
	// maxIdle is the longest the loop sleeps with nothing due. A pass that
	// finds nothing only reads the database.
	maxIdle = 5 * time.Minute
	// rateLimitWait is the least time nothing is sent after a 429 or 529;
	// it doubles for each one in a row, up to maxRateLimitWait.
	rateLimitWait    = time.Minute
	maxRateLimitWait = 30 * time.Minute
)

// RejectedMessage is the last error after TypeSafe answers 401.
const RejectedMessage = "TypeSafe rejected the API key. Check it and save it again."

// refusedPrefix starts the last error recorded for a 422: a bug in the
// request, not the connection. A later success doesn't clear it, so the bug
// stays visible until the key is saved again or disconnected.
const refusedPrefix = "TypeSafe refused a tag check: "

// The question every candidate tag is asked, and what yes and no mean
// (design §6). Question keys aren't sent to the model, so these carry the
// whole meaning.
const (
	questionText  = "Does this tag belong on the nugget in `nugget`? Tags group a person's project ideas."
	criteriaTrue  = "The idea is about what the tag covers, judged by the tag's name and the example titles of other ideas carrying it."
	criteriaFalse = "The idea is unrelated to what the tag covers, or only shares a word with the tag."
)

var (
	// errNotConfigured means no key is stored: nothing is sent.
	errNotConfigured = errors.New("jev: not connected")
	// errRejected means TypeSafe answered 401 for the stored key. Nothing is
	// sent until the key changes.
	errRejected = errors.New("jev: key rejected")
)

// pausedError stops a pass until a time: a rate limit, or backing off after
// TypeSafe was unreachable or failing.
type pausedError struct{ until time.Time }

func (e *pausedError) Error() string { return "jev: paused until " + e.until.Format(time.RFC3339) }

// Suggester is the only thing in nuggets that calls TypeSafe (design §6).
// Loop runs passes; each pass works through the due tag checks one at a
// time, oldest request first.
type Suggester struct {
	queue    *Queue
	ideas    *idea.Store
	settings *settings.Store
	events   events.Publisher

	httpClient     *http.Client
	baseURL        string
	baseBackoff    time.Duration
	maxBackoff     time.Duration
	requestTimeout time.Duration

	// running is held for the whole of each check, and by Reset, so a
	// settings change lands between checks, never in the middle of one.
	running sync.Mutex

	// mu guards the fields below. Never held across a network call.
	mu sync.Mutex
	// rejectedKey is the key TypeSafe last answered 401 for. While it is
	// still the stored key, passes send nothing.
	rejectedKey string
	// pauseUntil holds every check back after a rate limit or a transient
	// failure.
	pauseUntil time.Time
	// failures counts consecutive transient failures, and rateLimits
	// consecutive 429s and 529s, for pauseUntil's backoff.
	failures   int
	rateLimits int
}

// Option configures a Suggester away from its production defaults. Only
// tests need these, apart from WithEvents.
type Option func(*Suggester)

// WithEvents publishes changes to p (by default they go nowhere).
func WithEvents(p events.Publisher) Option { return func(s *Suggester) { s.events = p } }

func WithHTTPClient(c *http.Client) Option { return func(s *Suggester) { s.httpClient = c } }

// WithBaseURL points the Suggester at a fake TypeSafe. Production always
// uses DefaultBaseURL.
func WithBaseURL(u string) Option { return func(s *Suggester) { s.baseURL = u } }

func WithBackoff(base, max time.Duration) Option {
	return func(s *Suggester) { s.baseBackoff = base; s.maxBackoff = max }
}

func WithRequestTimeout(d time.Duration) Option {
	return func(s *Suggester) { s.requestTimeout = d }
}

func NewSuggester(queue *Queue, ideas *idea.Store, settingsStore *settings.Store, opts ...Option) *Suggester {
	s := &Suggester{
		queue:          queue,
		ideas:          ideas,
		settings:       settingsStore,
		events:         events.Nop{},
		httpClient:     http.DefaultClient,
		baseURL:        DefaultBaseURL,
		baseBackoff:    5 * time.Second,
		maxBackoff:     30 * time.Minute,
		requestTimeout: DefaultRequestTimeout,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Wake asks for a pass now. It never calls TypeSafe itself and never blocks.
func (s *Suggester) Wake() { s.queue.Wake() }

// Suggestions returns a nugget's open tag suggestions, highest first.
func (s *Suggester) Suggestions(ctx context.Context, ideaID int64) ([]Suggestion, error) {
	return s.queue.Suggestions(ctx, ideaID)
}

// Dismiss records that the captain turned a tag suggestion down for good.
func (s *Suggester) Dismiss(ctx context.Context, ideaID int64, tag string) error {
	return s.queue.Dismiss(ctx, ideaID, tag)
}

// Pending counts the nuggets waiting for a tag check.
func (s *Suggester) Pending(ctx context.Context) (int, error) { return s.queue.Pending(ctx) }

// ClearQueue empties the queue. Call it inside Reset's change.
func (s *Suggester) ClearQueue(ctx context.Context) error { return s.queue.Clear(ctx) }

// Reset runs change, which edits the stored settings (and may empty the
// queue), between checks, then wakes the loop. A saved key — new, or the
// same one saved again after fixing it on TypeSafe's side — lifts a 401
// park and any pause: it deserves a fresh try, and the settings screen has
// just cleared the error that explained the park.
func (s *Suggester) Reset(ctx context.Context, change func() error) error {
	s.running.Lock()
	err := change()
	if err == nil {
		s.mu.Lock()
		s.rejectedKey = ""
		s.pauseUntil = time.Time{}
		s.failures = 0
		s.rateLimits = 0
		s.mu.Unlock()
	}
	s.running.Unlock()
	if err == nil {
		s.events.Publish(events.TagSuggestionsChanged)
	}
	s.Wake()
	return err
}

// Pass runs every due check, one at a time, until none is due or something
// stops the pass: no key, a rejected key, a rate limit, or a transient
// failure.
func (s *Suggester) Pass(ctx context.Context) error {
	for ctx.Err() == nil {
		done, err := s.next(ctx)
		if err != nil || done {
			return err
		}
	}
	return ctx.Err()
}

// next runs the next due check, reporting done when none is due.
func (s *Suggester) next(ctx context.Context) (done bool, err error) {
	s.running.Lock()
	defer s.running.Unlock()

	key, _, err := s.settings.Get(ctx, KeyAPIKey)
	if err != nil {
		return false, err
	}
	if key == "" {
		return false, errNotConfigured
	}
	s.mu.Lock()
	rejected := s.rejectedKey != "" && s.rejectedKey == key
	pause := s.pauseUntil
	s.mu.Unlock()
	if rejected {
		return false, errRejected
	}
	if time.Now().Before(pause) {
		return false, &pausedError{until: pause}
	}

	c, ok, err := s.queue.nextDue(ctx, time.Now().UTC())
	if err != nil || !ok {
		return !ok, err
	}
	return false, s.check(ctx, key, c)
}

// check runs one tag check: read the nugget, ask Jev about each candidate
// tag, and store the confident ones.
func (s *Suggester) check(ctx context.Context, key string, c check) error {
	nugget, err := s.ideas.Get(ctx, c.ideaID)
	if errors.Is(err, idea.ErrNotFound) || (err == nil && nugget.ArchivedAt != nil) {
		return s.queue.deleteCheck(ctx, c.ideaID, c.requestedAt)
	}
	if err != nil {
		return err
	}
	candidates, err := s.queue.candidates(ctx, nugget)
	if err != nil {
		return err
	}

	result := []Suggestion{}
	if len(candidates) > 0 {
		answers, err := s.ask(ctx, key, nugget, candidates)
		if err != nil {
			return s.failed(ctx, key, c, err)
		}
		result = confident(answers)
	}

	stored, changed, err := s.queue.storeResult(ctx, c.ideaID, c.requestedAt, result)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.failures, s.rateLimits = 0, 0
	s.mu.Unlock()
	if len(candidates) > 0 {
		s.recordStatus(ctx, key, "")
	}
	if stored && changed {
		s.events.Publish(events.TagSuggestionsChanged)
	}
	return nil
}

// ask sends the candidates' questions, at most maxQuestionsPerRequest per
// request, one request after another, and returns each tag's
// yes-probability.
func (s *Suggester) ask(ctx context.Context, key string, nugget *idea.Idea, candidates []candidate) (map[string]float64, error) {
	cl := &client{baseURL: s.baseURL, key: key, httpClient: s.httpClient}
	state := map[string]any{"nugget": map[string]any{"title": nugget.Title, "notes": nugget.Notes, "tags": nugget.Tags}}
	out := make(map[string]float64, len(candidates))
	for start := 0; start < len(candidates); start += maxQuestionsPerRequest {
		batch := candidates[start:min(start+maxQuestionsPerRequest, len(candidates))]
		req := systemOneRequest{State: state, Model: Model, Questions: make(map[string]question, len(batch))}
		tagFor := make(map[string]string, len(batch))
		for i, cand := range batch {
			id := "t" + strconv.Itoa(i)
			tagFor[id] = cand.tag
			req.Questions[id] = question{
				Type:         "noul",
				Instructions: instructions{Question: questionText, Tag: cand.tag, Examples: cand.examples},
				Criteria:     criteria{True: criteriaTrue, False: criteriaFalse},
			}
		}
		reqCtx, cancel := context.WithTimeout(ctx, s.requestTimeout)
		answers, err := cl.ask(reqCtx, req)
		cancel()
		if err != nil {
			return nil, err
		}
		for id, p := range answers {
			if tag, ok := tagFor[id]; ok {
				out[tag] = p
			}
		}
	}
	return out, nil
}

// confident keeps the tags at or above Threshold, highest first, at most
// MaxSuggestions.
func confident(answers map[string]float64) []Suggestion {
	var out []Suggestion
	for tag, p := range answers {
		if p >= Threshold {
			out = append(out, Suggestion{Tag: tag, Probability: p})
		}
	}
	slices.SortFunc(out, func(a, b Suggestion) int {
		if c := cmp.Compare(b.Probability, a.Probability); c != 0 {
			return c
		}
		return cmp.Compare(a.Tag, b.Tag)
	})
	if len(out) > MaxSuggestions {
		out = out[:MaxSuggestions]
	}
	if out == nil {
		out = []Suggestion{}
	}
	return out
}

// failed records a failed check and says whether the pass goes on (nil) or
// stops (the error the loop acts on). The check stays queued except after
// a 422, which a retry would only repeat.
func (s *Suggester) failed(ctx context.Context, key string, c check, err error) error {
	var apiErr *APIError
	isAPI := errors.As(err, &apiErr)
	now := time.Now().UTC()

	switch {
	case isAPI && apiErr.StatusCode == http.StatusUnauthorized:
		s.mu.Lock()
		s.rejectedKey = key
		s.mu.Unlock()
		if err := s.queue.holdCheck(ctx, c.ideaID, RejectedMessage, nil); err != nil {
			return err
		}
		s.recordStatus(ctx, key, RejectedMessage)
		return errRejected

	case isAPI && (apiErr.StatusCode == http.StatusTooManyRequests || apiErr.StatusCode == 529):
		s.mu.Lock()
		s.rateLimits++
		wait := doubled(rateLimitWait, s.rateLimits, maxRateLimitWait)
		if apiErr.RetryAfter > wait {
			wait = min(apiErr.RetryAfter, time.Hour)
		}
		until := now.Add(wait)
		s.pauseUntil = until
		s.mu.Unlock()
		message := "TypeSafe is busy (" + strconv.Itoa(apiErr.StatusCode) + "); checking resumes at " + until.Local().Format("15:04") + "."
		if err := s.queue.holdCheck(ctx, c.ideaID, message, &until); err != nil {
			return err
		}
		s.recordStatus(ctx, key, message)
		return &pausedError{until: until}

	case isAPI && apiErr.StatusCode == http.StatusUnprocessableEntity:
		message := refusedPrefix + apiErr.Message
		log.Printf("jev: TypeSafe refused the tag check for nugget %d: %s", c.ideaID, message)
		if err := s.queue.deleteCheck(ctx, c.ideaID, c.requestedAt); err != nil {
			return err
		}
		s.recordStatus(ctx, key, message)
		return nil

	default:
		message := describe(err)
		s.mu.Lock()
		s.failures++
		until := now.Add(s.backoff(s.failures))
		s.pauseUntil = until
		s.mu.Unlock()
		next := now.Add(s.backoff(c.attempts + 1))
		if err := s.queue.retryCheck(ctx, c.ideaID, message, next); err != nil {
			return err
		}
		s.recordStatus(ctx, key, message)
		return &pausedError{until: until}
	}
}

// backoff is baseBackoff doubled per earlier failure, capped at maxBackoff.
func (s *Suggester) backoff(n int) time.Duration {
	return doubled(s.baseBackoff, n, s.maxBackoff)
}

// doubled is base doubled for each of the n-1 earlier failures, capped at
// max.
func doubled(base time.Duration, n int, max time.Duration) time.Duration {
	d := base
	for i := 1; i < n && d < max; i++ {
		d *= 2
	}
	return min(d, max)
}

// recordStatus stores message as the last error ("" clears it, except a
// 422 report), logging it only when it changes. It stores nothing if the key changed since key was
// read, so a failure racing a new key can't leave a stale error behind.
func (s *Suggester) recordStatus(ctx context.Context, key, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, _, err := s.settings.Get(ctx, KeyAPIKey)
	if err != nil || current != key {
		return
	}
	last, _, err := s.settings.Get(ctx, KeyLastError)
	if err != nil || last == message || (message == "" && strings.HasPrefix(last, refusedPrefix)) {
		return
	}
	if message == "" {
		err = s.settings.Delete(ctx, KeyLastError)
	} else {
		log.Printf("jev: %s", message)
		err = s.settings.Set(ctx, KeyLastError, message)
	}
	if err != nil {
		log.Printf("jev: recording last error: %v", err)
		return
	}
	s.events.Publish(events.TagSuggestionsChanged)
}

// describe turns a failure into a line for the settings screen. The key
// never appears: it only travels in a header.
func describe(err error) string {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		msg := fmt.Sprintf("TypeSafe answered %d", apiErr.StatusCode)
		if apiErr.Message != "" {
			msg += ": " + apiErr.Message
		}
		return msg + "."
	}
	var urlErr *url.Error
	var netErr net.Error
	if errors.As(err, &urlErr) || errors.As(err, &netErr) || errors.Is(err, context.DeadlineExceeded) {
		return "Couldn't reach TypeSafe: " + err.Error()
	}
	return "Checking tags failed: " + err.Error()
}

// Loop runs passes until ctx is cancelled: at once, whenever woken (a check
// queued, a settings change), and when the next backed-off check or pause
// falls due. With no key or a rejected one it parks — no calls to TypeSafe
// at all — until woken.
func (s *Suggester) Loop(ctx context.Context) {
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
			// A local failure (the database), never a TypeSafe answer.
			log.Printf("jev: %v", err)
			if !s.sleep(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, s.maxBackoff)
		default:
			backoff = s.baseBackoff
			wait := maxIdle
			if due, err := s.queue.earliestDue(ctx); err == nil && due != nil {
				wait = min(wait, time.Until(*due))
			}
			if !s.sleep(ctx, wait) {
				return
			}
		}
	}
}

// park waits, without calling TypeSafe, until woken or cancelled, reporting
// whether it was woken.
func (s *Suggester) park(ctx context.Context) bool {
	select {
	case <-s.queue.wake:
		return true
	case <-ctx.Done():
		return false
	}
}

// sleep waits for d, a wake, or cancellation, reporting whether to go on.
func (s *Suggester) sleep(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-s.queue.wake:
		return true
	case <-ctx.Done():
		return false
	}
}
