package tagbench

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

// Input is what every contender is given for one check: the nugget as
// production's state shows it, and its candidate tags with their examples
// (jev.BuildCandidates).
type Input struct {
	Title      string
	Notes      string
	Tags       []string
	Candidates []jev.Candidate
}

// Result is one contender's answer: a score from 0 to 1 per candidate tag
// (nil unless Outcome is ok), how long it took and the tokens it used.
// Malformed and refused answers still used, and cost, their tokens.
type Result struct {
	Scores       map[string]float64
	Outcome      string
	Error        string
	Latency      time.Duration
	InputTokens  int64
	OutputTokens int64
}

// Estimate is a check's token use worked out before it is made. Worst is
// the most it can cost, which the spend cap reserves.
type Estimate struct {
	InputTokens       int64
	OutputTokens      int64
	WorstInputTokens  int64
	WorstOutputTokens int64
	// Method says how InputTokens was counted ("chars/4 heuristic" or
	// "count_tokens").
	Method string
}

// Contender is one model configuration under test. Check returns an error
// only when the call got no answer at all; a *RateLimitedError (429 or 529)
// is retried by the runner.
type Contender interface {
	Name() string
	Price() Price
	Check(ctx context.Context, in Input) (Result, error)
	Estimate(in Input) Estimate
}

// TokenCounter is a contender that can count input tokens exactly. Only
// used when asked (-count-tokens): it calls the provider.
type TokenCounter interface {
	CountInputTokens(ctx context.Context, in Input) (int64, error)
}

// RateLimitedError is a 429 or 529: try again after After (0: unsaid).
type RateLimitedError struct {
	Status int
	After  time.Duration
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("rate limited (%d), retry after %s", e.Status, e.After)
}

// Price is dollars per million tokens. Thinking tokens are output tokens.
type Price struct {
	InputPerM  float64 `json:"input_per_m"`
	OutputPerM float64 `json:"output_per_m"`
}

// Cost of a number of input and output tokens.
func (p Price) Cost(in, out int64) float64 {
	return (float64(in)*p.InputPerM + float64(out)*p.OutputPerM) / 1e6
}

// Prices per model (issue #40). Haiku 5.5's rate is for prompts up to 100K
// tokens, far above any check here.
var Prices = map[string]Price{
	jev.Model:           {InputPerM: 0.042, OutputPerM: 0},
	"claude-haiku-5-5":  {InputPerM: 0.10, OutputPerM: 0.50},
	"claude-sonnet-5-5": {InputPerM: 2, OutputPerM: 10},
	"claude-opus-5-5":   {InputPerM: 4, OutputPerM: 20},
}

// PhaseOne is the default line-up: Jev, Haiku 5.5 at low effort with
// adaptive thinking, and Haiku 5.5 with thinking off.
var PhaseOne = []string{"jev", "claude:claude-haiku-5-5:low", "claude:claude-haiku-5-5:nothink"}

// Endpoints are where contenders send requests and with what key. Tests
// point them at fakes; a run leaves the Anthropic fields empty so the SDK
// resolves credentials the standard way.
type Endpoints struct {
	JevBaseURL       string
	JevKey           string
	AnthropicBaseURL string
	AnthropicKey     string
	HTTPClient       *http.Client
}

// ParseContender reads "jev" or "claude:<model>:<config>", where config is
// an effort level (adaptive thinking at that effort) or "nothink".
func ParseContender(spec string, ep Endpoints) (Contender, error) {
	if spec == "jev" {
		return newJev(ep), nil
	}
	parts := strings.Split(spec, ":")
	if len(parts) != 3 || parts[0] != "claude" {
		return nil, fmt.Errorf("contender %q: want jev or claude:<model>:<config>", spec)
	}
	model, config := parts[1], parts[2]
	if _, ok := Prices[model]; !ok || !strings.HasPrefix(model, "claude-") {
		return nil, fmt.Errorf("contender %q: no price for model %q (known: claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5)", spec, model)
	}
	switch config {
	case "low", "medium", "high", "xhigh", "max":
	case "nothink":
		// Opus 5.5 rejects disabled thinking at every effort; Sonnet 5.5
		// rejects it too (its thinking-off mode is between_tools).
		if model != "claude-haiku-5-5" {
			return nil, fmt.Errorf("contender %q: %s can't turn thinking off; use an effort level", spec, model)
		}
	default:
		return nil, fmt.Errorf("contender %q: config must be low, medium, high, xhigh, max or nothink", spec)
	}
	return newClaude(model, config, ep), nil
}
