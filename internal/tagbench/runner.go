package tagbench

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"
)

// RunOptions control a run's pace and spend.
type RunOptions struct {
	// MaxUSD is the spend cap. A check starts only if the spend so far,
	// plus every check in flight at its worst case, plus this check's worst
	// case, stays within it; so the cap is never crossed.
	MaxUSD float64
	// Concurrency is how many checks run at once (default 1).
	Concurrency int
	// MinInterval spaces the starts of one contender's calls (0: no limit).
	MinInterval time.Duration
	// MaxAttempts bounds tries per check on 429 and 529 (default 5).
	MaxAttempts int
	// Backoff is the first wait after a 429 or 529, doubled per retry; a
	// longer Retry-After wins (default 2s).
	Backoff time.Duration
	// Sleep waits; tests replace it.
	Sleep func(ctx context.Context, d time.Duration) error
	// Progress, if set, hears after each check.
	Progress func(done, total int, spentUSD float64)
}

// RunResult is every check made, and why the run stopped early ("" if it
// didn't).
type RunResult struct {
	Records  []Record
	Stopped  string
	SpentUSD float64
}

type job struct {
	order     int
	c         Case
	contender Contender
	reserved  float64
}

// Run puts every case to every contender, case by case so a run stopped
// early still compares the contenders on the same cases. It never returns
// an error: failures are records, and a stop is RunResult.Stopped.
func Run(ctx context.Context, cases []Case, contenders []Contender, opt RunOptions) RunResult {
	if opt.Concurrency < 1 {
		opt.Concurrency = 1
	}
	if opt.MaxAttempts < 1 {
		opt.MaxAttempts = 5
	}
	if opt.Backoff <= 0 {
		opt.Backoff = 2 * time.Second
	}
	if opt.Sleep == nil {
		opt.Sleep = sleep
	}
	limiters := map[string]*limiter{}
	for _, c := range contenders {
		limiters[c.Name()] = &limiter{interval: opt.MinInterval}
	}

	var (
		mu       sync.Mutex
		spent    float64
		reserved float64
		done     []ordered
		wg       sync.WaitGroup
		stopped  string
	)
	total := len(cases) * len(contenders)
	slots := make(chan struct{}, opt.Concurrency)

dispatch:
	for i, c := range cases {
		for k, contender := range contenders {
			// Wait for a free slot first, so the reservation below sees
			// every finished check's real cost.
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				stopped = "interrupted"
				break dispatch
			}
			if ctx.Err() != nil {
				<-slots
				stopped = "interrupted"
				break dispatch
			}
			est := contender.Estimate(c.Input)
			worst := contender.Price().Cost(est.WorstInputTokens, est.WorstOutputTokens)
			mu.Lock()
			if spent+reserved+worst > opt.MaxUSD {
				stopped = fmt.Sprintf("spend cap: $%.4f spent, $%.4f in flight; the next check could cost up to $%.4f against the $%.2f cap", spent, reserved, worst, opt.MaxUSD)
				mu.Unlock()
				<-slots
				break dispatch
			}
			reserved += worst
			mu.Unlock()

			wg.Add(1)
			go func(j job) {
				defer wg.Done()
				r := check(ctx, j, limiters[j.contender.Name()], opt)
				mu.Lock()
				reserved -= j.reserved
				spent += r.CostUSD
				done = append(done, ordered{j.order, r})
				n, s := len(done), spent
				mu.Unlock()
				<-slots
				if opt.Progress != nil {
					opt.Progress(n, total, s)
				}
			}(job{order: i*len(contenders) + k, c: c, contender: contender, reserved: worst})
		}
	}
	wg.Wait()

	slices.SortFunc(done, func(a, b ordered) int { return cmp.Compare(a.order, b.order) })
	records := make([]Record, len(done))
	for i, d := range done {
		records[i] = d.r
	}
	return RunResult{Records: records, Stopped: stopped, SpentUSD: spent}
}

// ordered is a finished check and its place in case order.
type ordered struct {
	order int
	r     Record
}

// check makes one check, retrying 429s and 529s, and records it.
func check(ctx context.Context, j job, lim *limiter, opt RunOptions) Record {
	c := j.c
	r := Record{
		Contender: j.contender.Name(), CaseID: c.ID(), CaseKey: c.Key, Dataset: c.Dataset, Task: c.Task,
		ItemID: c.Item.ID, ItemTags: c.Item.Tags, Hidden: c.Hidden, VocabSize: c.VocabSize, Repeat: c.Repeat,
	}
	for _, cand := range c.Input.Candidates {
		r.Candidates = append(r.Candidates, cand.Tag)
	}
	for attempt := 1; ; attempt++ {
		r.Attempts = attempt
		if err := lim.wait(ctx, opt.Sleep); err != nil {
			r.Outcome, r.Error = OutcomeError, err.Error()
			return r
		}
		res, err := j.contender.Check(ctx, c.Input)
		var rl *RateLimitedError
		if errors.As(err, &rl) && attempt < opt.MaxAttempts {
			wait := opt.Backoff << (attempt - 1)
			if rl.After > wait {
				wait = rl.After
			}
			if err := opt.Sleep(ctx, wait); err != nil {
				r.Outcome, r.Error = OutcomeError, err.Error()
				return r
			}
			continue
		}
		if err != nil {
			r.Outcome, r.Error = OutcomeError, err.Error()
			return r
		}
		r.Outcome, r.Error, r.Scores = res.Outcome, res.Error, res.Scores
		r.LatencyMS = float64(res.Latency.Microseconds()) / 1000
		r.InputTokens, r.OutputTokens = res.InputTokens, res.OutputTokens
		r.CostUSD = j.contender.Price().Cost(res.InputTokens, res.OutputTokens)
		return r
	}
}

// limiter spaces one contender's call starts by interval.
type limiter struct {
	mu       sync.Mutex
	interval time.Duration
	next     time.Time
}

func (l *limiter) wait(ctx context.Context, sleepFn func(context.Context, time.Duration) error) error {
	if l.interval <= 0 {
		return ctx.Err()
	}
	l.mu.Lock()
	now := time.Now()
	start := l.next
	if start.Before(now) {
		start = now
	}
	l.next = start.Add(l.interval)
	l.mu.Unlock()
	return sleepFn(ctx, time.Until(start))
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
