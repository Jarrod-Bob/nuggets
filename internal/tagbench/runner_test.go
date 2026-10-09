package tagbench

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

// scripted is a contender whose every call costs the same and answers from
// a script of errors (nil: answer ok).
type scripted struct {
	name   string
	mu     sync.Mutex
	calls  int
	script []error
}

func (s *scripted) Name() string { return s.name }

// Price makes one input token cost $0.001.
func (s *scripted) Price() Price { return Price{InputPerM: 1000, OutputPerM: 0} }

func (s *scripted) Estimate(Input) Estimate {
	return Estimate{InputTokens: 10, WorstInputTokens: 20}
}

func (s *scripted) Check(_ context.Context, in Input) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	if len(s.script) > 0 {
		err := s.script[0]
		s.script = s.script[1:]
		if err != nil {
			return Result{}, err
		}
	}
	scores := map[string]float64{}
	for _, c := range in.Candidates {
		scores[c.Tag] = 0.9
	}
	return Result{Scores: scores, Outcome: OutcomeOK, Latency: time.Millisecond, InputTokens: 10}, nil
}

func someCases(n int) []Case {
	var cs []Case
	for i := range n {
		cs = append(cs, Case{Key: "k" + string(rune('a'+i)), Dataset: DatasetGitHub, Task: TaskOpen,
			Item:  Item{ID: string(rune('a' + i))},
			Input: Input{Title: "t", Candidates: []jev.Candidate{{Tag: "x", Examples: []string{}}}}})
	}
	return cs
}

func noSleep(context.Context, time.Duration) error { return nil }

func TestSpendCapStopsTheRunBeforeItIsExceeded(t *testing.T) {
	a, b := &scripted{name: "a"}, &scripted{name: "b"}
	// Each check costs $0.01 and reserves its worst case, $0.02, so a case
	// reserves $0.04. $0.085 leaves room for 3 cases: after them ($0.06
	// spent) a 4th could take spend past the cap.
	res := Run(context.Background(), someCases(10), []Contender{a, b}, RunOptions{MaxUSD: 0.085, Concurrency: 1, Sleep: noSleep})
	if len(res.Records) != 6 {
		t.Errorf("%d checks ran, want 6", len(res.Records))
	}
	if res.Stopped == "" {
		t.Error("the run doesn't say it stopped at the cap")
	}
	if res.SpentUSD > 0.085 || !near(res.SpentUSD, 0.06) {
		t.Errorf("spent $%v, want $0.06 and never more than $0.085", res.SpentUSD)
	}
	if a.calls != 3 || b.calls != 3 {
		t.Errorf("calls a=%d b=%d; contenders take turns per case so a stop leaves them comparable", a.calls, b.calls)
	}
}

func TestRunRetriesRateLimitsWithBackoff(t *testing.T) {
	c := &scripted{name: "a", script: []error{&RateLimitedError{Status: 429}, &RateLimitedError{Status: 529, After: 9 * time.Second}}}
	var waits []time.Duration
	sleep := func(_ context.Context, d time.Duration) error { waits = append(waits, d); return nil }
	res := Run(context.Background(), someCases(1), []Contender{c}, RunOptions{MaxUSD: 1, Sleep: sleep, Backoff: time.Second})
	r := res.Records[0]
	if r.Outcome != OutcomeOK || r.Attempts != 3 {
		t.Errorf("record = %+v, want ok on the third attempt", r)
	}
	if len(waits) != 2 || waits[0] != time.Second || waits[1] != 9*time.Second {
		t.Errorf("waits = %v, want 1s then the 9s Retry-After", waits)
	}
}

func TestRunRecordsFailuresWithoutStopping(t *testing.T) {
	rl := &RateLimitedError{Status: 429}
	c := &scripted{name: "a", script: []error{rl, rl, errors.New("connection reset")}}
	res := Run(context.Background(), someCases(2), []Contender{c}, RunOptions{MaxUSD: 1, Sleep: noSleep, MaxAttempts: 2})
	if len(res.Records) != 2 || res.Records[0].Outcome != OutcomeError || res.Records[1].Outcome != OutcomeError || res.Records[1].Error != "connection reset" {
		t.Errorf("records = %+v", res.Records)
	}
	if res.Records[0].CostUSD != 0 {
		t.Error("a call with no answer cost something")
	}
}

func TestRunStopsWhenInterrupted(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	res := Run(ctx, someCases(3), []Contender{&scripted{name: "a"}}, RunOptions{MaxUSD: 1, Sleep: noSleep})
	if len(res.Records) != 0 || res.Stopped == "" {
		t.Errorf("records %d, stopped %q", len(res.Records), res.Stopped)
	}
}

// partial spends tokens on a call that then fails, as a split Jev check
// does when its second request is rate limited.
type partial struct{ scripted }

func (p *partial) Check(ctx context.Context, in Input) (Result, error) {
	p.mu.Lock()
	p.calls++
	n := p.calls
	p.mu.Unlock()
	if n == 1 {
		return Result{InputTokens: 10}, &RateLimitedError{Status: 429}
	}
	return p.scripted.Check(ctx, in)
}

func TestRunChargesTokensSpentBeforeARetry(t *testing.T) {
	c := &partial{scripted{name: "a"}}
	res := Run(context.Background(), someCases(1), []Contender{c}, RunOptions{MaxUSD: 1, Sleep: noSleep})
	r := res.Records[0]
	if r.InputTokens != 20 || !near(r.CostUSD, 0.02) || !near(res.SpentUSD, 0.02) {
		t.Errorf("record tokens %d cost %v, run spent %v; want both attempts' 20 tokens, $0.02", r.InputTokens, r.CostUSD, res.SpentUSD)
	}
}

// interrupting cancels the run from inside its first check.
type interrupting struct {
	scripted
	cancel context.CancelFunc
}

func (c *interrupting) Check(ctx context.Context, _ Input) (Result, error) {
	c.cancel()
	<-ctx.Done()
	return Result{InputTokens: 10}, ctx.Err()
}

func TestRunLeavesOutChecksCutShortByAnInterrupt(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	c := &interrupting{scripted{name: "a"}, cancel}
	res := Run(ctx, someCases(3), []Contender{c}, RunOptions{MaxUSD: 1, Sleep: noSleep})
	if len(res.Records) != 0 || res.Stopped != "interrupted" {
		t.Errorf("records %+v, stopped %q; an interrupted check is not the model's error", res.Records, res.Stopped)
	}
	if !near(res.SpentUSD, 0.01) {
		t.Errorf("spent %v, want the interrupted check's $0.01 still counted", res.SpentUSD)
	}
}

// pricey is scripted at three times the price.
type pricey struct{ scripted }

func (p *pricey) Price() Price { return Price{InputPerM: 3000} }

func TestSpendCapReservesAWholeCaseSoContendersStayInStep(t *testing.T) {
	a, b := &scripted{name: "a"}, &pricey{scripted{name: "b"}}
	// A case costs $0.01 + $0.03 and reserves $0.02 + $0.06. After two
	// cases ($0.08 spent) a third needs $0.16 > $0.14: a must not run it
	// alone, even though its own $0.02 would fit.
	res := Run(context.Background(), someCases(5), []Contender{a, b}, RunOptions{MaxUSD: 0.14, Sleep: noSleep})
	if a.calls != 2 || b.calls != 2 || res.Stopped == "" {
		t.Errorf("calls a=%d b=%d, stopped %q; want 2 each and a stop", a.calls, b.calls, res.Stopped)
	}
}
