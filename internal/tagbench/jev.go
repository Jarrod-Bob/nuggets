package tagbench

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

// jevContender asks Jev exactly as production does: jev.BuildRequests, one
// request per 50 candidates, sent one after another.
type jevContender struct {
	client *jev.Client
}

func newJev(ep Endpoints) *jevContender {
	base := ep.JevBaseURL
	if base == "" {
		base = jev.DefaultBaseURL
	}
	hc := ep.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: jev.DefaultRequestTimeout}
	}
	return &jevContender{client: &jev.Client{BaseURL: base, Key: ep.JevKey, HTTPClient: hc}}
}

func (j *jevContender) Name() string { return "jev" }
func (j *jevContender) Price() Price { return Prices[jev.Model] }

func (j *jevContender) Check(ctx context.Context, in Input) (Result, error) {
	res := Result{Scores: make(map[string]float64, len(in.Candidates))}
	start := time.Now()
	for _, req := range jev.BuildRequests(in.Title, in.Notes, in.Tags, in.Candidates) {
		answers, usage, err := j.client.Ask(ctx, req)
		if err != nil {
			var apiErr *jev.APIError
			if errors.As(err, &apiErr) && (apiErr.StatusCode == 429 || apiErr.StatusCode == 529) {
				return Result{}, &RateLimitedError{Status: apiErr.StatusCode, After: apiErr.RetryAfter}
			}
			return Result{}, err
		}
		res.InputTokens += usage.InputTokens
		res.OutputTokens += usage.OutputTokens
		for tag, p := range answers {
			res.Scores[tag] = p
		}
	}
	res.Latency = time.Since(start)
	if len(res.Scores) != len(in.Candidates) {
		res.Outcome, res.Error, res.Scores = OutcomeMalformed, "Jev left some questions unanswered", nil
		return res, nil
	}
	res.Outcome = OutcomeOK
	return res, nil
}

func (j *jevContender) Estimate(in Input) Estimate {
	var inTokens int64
	reqs := jev.BuildRequests(in.Title, in.Notes, in.Tags, in.Candidates)
	for _, req := range reqs {
		body, _ := req.JSON()
		inTokens += int64(len(body)) / 4
	}
	return Estimate{
		InputTokens:       inTokens,
		OutputTokens:      20 * int64(len(reqs)),
		WorstInputTokens:  2 * inTokens,
		WorstOutputTokens: 100 * int64(len(reqs)),
		Method:            "chars/4 heuristic",
	}
}
