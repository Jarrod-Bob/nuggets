package tagbench

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

// claudeMaxTokens bounds one answer, thinking included. It is also the
// output the spend cap reserves for a call.
const claudeMaxTokens = 16000

// claudeSystem is short and neutral, and reuses Jev's criteria word for word
// so both models are asked the same thing.
var claudeSystem = "You decide which of a person's existing tags belong on one of their project ideas. " +
	"For every candidate tag, set applies to true when: " + jev.CriteriaTrue +
	" Set it to false when: " + jev.CriteriaFalse +
	" Set confidence to how likely your answer is to be right, from 0 to 1."

// thinkingAllowance is the output tokens a dry run assumes thinking adds at
// each config: a labelled guess, replaced by real usage once a run is made.
var thinkingAllowance = map[string]int64{"nothink": 0, "low": 400, "medium": 1000, "high": 2000, "xhigh": 4000, "max": 8000}

// claude asks one Claude model about all of a nugget's candidates in one
// Messages call, with structured outputs.
type claude struct {
	model, config string
	client        anthropic.Client
}

func newClaude(model, config string, ep Endpoints) *claude {
	// The runner owns retries, so the SDK makes exactly one attempt and
	// latency is one call's.
	opts := []option.RequestOption{option.WithMaxRetries(0), option.WithRequestTimeout(5 * time.Minute)}
	if ep.AnthropicBaseURL != "" {
		opts = append(opts, option.WithBaseURL(ep.AnthropicBaseURL))
	}
	if ep.AnthropicKey != "" {
		opts = append(opts, option.WithAPIKey(ep.AnthropicKey))
	}
	if ep.HTTPClient != nil {
		opts = append(opts, option.WithHTTPClient(ep.HTTPClient))
	}
	return &claude{model: model, config: config, client: anthropic.NewClient(opts...)}
}

func (c *claude) Name() string { return "claude:" + c.model + ":" + c.config }
func (c *claude) Price() Price { return Prices[c.model] }

// schema asks for a list of {tag, applies, confidence}. Its size doesn't
// depend on the candidates: one property per tag compiles to a grammar the
// API rejects at around 50 tags ("The compiled grammar is too large").
// parseAnswer checks the list covers exactly the candidates.
func schema(Input) map[string]any {
	answer := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"tag":        map[string]any{"type": "string"},
			"applies":    map[string]any{"type": "boolean"},
			"confidence": map[string]any{"type": "number"},
		},
		"required":             []string{"tag", "applies", "confidence"},
		"additionalProperties": false,
	}
	return map[string]any{
		"type":                 "object",
		"properties":           map[string]any{"answers": map[string]any{"type": "array", "items": answer}},
		"required":             []string{"answers"},
		"additionalProperties": false,
	}
}

type candidateJSON struct {
	Tag      string   `json:"tag"`
	Examples []string `json:"examples"`
}

// userText gives Claude the state Jev gets ({"nugget": …}) and every
// candidate with the examples Jev's question for it carries.
func userText(in Input) string {
	cands := make([]candidateJSON, len(in.Candidates))
	for i, c := range in.Candidates {
		cands[i] = candidateJSON{c.Tag, c.Examples}
	}
	data, _ := json.Marshal(map[string]any{
		"nugget":         map[string]any{"title": in.Title, "notes": in.Notes, "tags": in.Tags},
		"candidate_tags": cands,
	})
	return "For each tag in `candidate_tags`: " + jev.QuestionText + "\n\n" + string(data)
}

func (c *claude) thinking() anthropic.ThinkingConfigParamUnion {
	if c.config == "nothink" {
		return anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}}
	}
	return anthropic.ThinkingConfigParamUnion{OfAdaptive: &anthropic.ThinkingConfigAdaptiveParam{}}
}

func (c *claude) outputConfig(in Input) anthropic.OutputConfigParam {
	oc := anthropic.OutputConfigParam{Format: anthropic.JSONOutputFormatParam{Schema: schema(in)}}
	if c.config != "nothink" {
		oc.Effort = anthropic.OutputConfigEffort(c.config)
	}
	return oc
}

func (c *claude) messages(in Input) []anthropic.MessageParam {
	return []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(userText(in)))}
}

func (c *claude) Check(ctx context.Context, in Input) (Result, error) {
	start := time.Now()
	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:        anthropic.Model(c.model),
		MaxTokens:    claudeMaxTokens,
		System:       []anthropic.TextBlockParam{{Text: claudeSystem}},
		Messages:     c.messages(in),
		Thinking:     c.thinking(),
		OutputConfig: c.outputConfig(in),
	})
	latency := time.Since(start)
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) && (apiErr.StatusCode == 429 || apiErr.StatusCode == 529) {
			rl := &RateLimitedError{Status: apiErr.StatusCode}
			if apiErr.Response != nil {
				if secs, perr := strconv.Atoi(strings.TrimSpace(apiErr.Response.Header.Get("Retry-After"))); perr == nil {
					rl.After = time.Duration(secs) * time.Second
				}
			}
			return Result{}, rl
		}
		return Result{}, err
	}
	res := Result{Latency: latency, InputTokens: msg.Usage.InputTokens, OutputTokens: msg.Usage.OutputTokens}
	var text strings.Builder
	for _, block := range msg.Content {
		if b, ok := block.AsAny().(anthropic.TextBlock); ok {
			text.WriteString(b.Text)
		}
	}
	switch msg.StopReason {
	case anthropic.StopReasonRefusal:
		res.Outcome, res.Error = OutcomeRefused, "refusal"
		if msg.StopDetails.Category != "" {
			res.Error += ": " + string(msg.StopDetails.Category)
		}
		return res, nil
	case anthropic.StopReasonMaxTokens:
		res.Outcome, res.Error = OutcomeMalformed, "cut off at max_tokens"
		return res, nil
	}
	scores, err := parseAnswer(text.String(), in)
	if err != nil {
		res.Outcome, res.Error = OutcomeMalformed, err.Error()
		return res, nil
	}
	res.Outcome, res.Scores = OutcomeOK, scores
	return res, nil
}

// Score maps Claude's answer onto a yes-probability like Jev's noul: the
// confidence when it says the tag applies, 1 − confidence when it says it
// doesn't.
func Score(applies bool, confidence float64) float64 {
	if applies {
		return confidence
	}
	return 1 - confidence
}

// parseAnswer checks the answer covers exactly the candidates, each once
// with applies and a confidence in [0, 1], and scores it.
func parseAnswer(text string, in Input) (map[string]float64, error) {
	var answer struct {
		Answers []struct {
			Tag        string   `json:"tag"`
			Applies    *bool    `json:"applies"`
			Confidence *float64 `json:"confidence"`
		} `json:"answers"`
	}
	if err := json.Unmarshal([]byte(text), &answer); err != nil {
		return nil, fmt.Errorf("answer is not the JSON object asked for: %w", err)
	}
	want := make(map[string]bool, len(in.Candidates))
	for _, c := range in.Candidates {
		want[c.Tag] = true
	}
	scores := make(map[string]float64, len(answer.Answers))
	for _, a := range answer.Answers {
		if !want[a.Tag] {
			return nil, fmt.Errorf("answer has tag %q, which isn't a candidate", a.Tag)
		}
		if _, seen := scores[a.Tag]; seen {
			return nil, fmt.Errorf("answer has tag %q twice", a.Tag)
		}
		if a.Applies == nil || a.Confidence == nil {
			return nil, fmt.Errorf("answer for %q lacks applies or confidence", a.Tag)
		}
		if *a.Confidence < 0 || *a.Confidence > 1 {
			return nil, fmt.Errorf("answer for %q has confidence %v, outside 0 to 1", a.Tag, *a.Confidence)
		}
		scores[a.Tag] = Score(*a.Applies, *a.Confidence)
	}
	if len(scores) != len(want) {
		return nil, fmt.Errorf("answer covers %d of %d candidates", len(scores), len(want))
	}
	return scores, nil
}

func (c *claude) Estimate(in Input) Estimate {
	schemaJSON, _ := json.Marshal(schema(in))
	inTokens := int64(len(claudeSystem)+len(userText(in))+len(schemaJSON))/4 + 20
	// The answer is about {"tag":"…","applies":false,"confidence":0.95}, per tag.
	var answerChars int
	for _, cand := range in.Candidates {
		answerChars += len(cand.Tag) + 50
	}
	return Estimate{
		InputTokens:       inTokens,
		OutputTokens:      int64(answerChars)/4 + thinkingAllowance[c.config],
		WorstInputTokens:  2 * inTokens,
		WorstOutputTokens: claudeMaxTokens,
		Method:            "chars/4 heuristic",
	}
}

// CountInputTokens asks Anthropic's count_tokens endpoint (free, but a call).
func (c *claude) CountInputTokens(ctx context.Context, in Input) (int64, error) {
	n, err := c.client.Messages.CountTokens(ctx, anthropic.MessageCountTokensParams{
		Model:        anthropic.Model(c.model),
		System:       anthropic.MessageCountTokensParamsSystemUnion{OfTextBlockArray: []anthropic.TextBlockParam{{Text: claudeSystem}}},
		Messages:     c.messages(in),
		Thinking:     c.thinking(),
		OutputConfig: c.outputConfig(in),
	})
	if err != nil {
		return 0, err
	}
	return n.InputTokens, nil
}
