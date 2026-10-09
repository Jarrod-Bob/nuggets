package jev

import (
	"context"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/events"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// DefaultRequestTimeout bounds every call to TypeSafe, so a request that
// never answers can't wedge the queue.
const DefaultRequestTimeout = 30 * time.Second

// Suggester is the only thing in nuggets that calls TypeSafe (design §6).
// Loop runs passes; each pass works through the due tag checks one at a time.
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

// Pass works through every due tag check.
func (s *Suggester) Pass(ctx context.Context) error {
	return nil
}
