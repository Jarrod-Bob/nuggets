package tagbench

import (
	"context"
	"errors"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

func sampleInput() Input {
	return Input{
		Title: "A pocket synth", Notes: "Plays chords", Tags: []string{"music"},
		Candidates: []jev.Candidate{
			{Tag: "hardware", Examples: []string{"A soldering timer"}},
			{Tag: "weekend", Examples: []string{}},
		},
	}
}

func newTestClaude(t *testing.T, url, spec string) Contender {
	t.Helper()
	c, err := ParseContender(spec, Endpoints{AnthropicBaseURL: url, AnthropicKey: "test-key"})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestClaudeSchemaCoversExactlyTheCandidateTags(t *testing.T) {
	fake, srv := newFakeAnthropic(t)
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
	if _, err := c.Check(context.Background(), sampleInput()); err != nil {
		t.Fatal(err)
	}
	body := fake.bodies[0]
	format := body["output_config"].(map[string]any)["format"].(map[string]any)
	schema := format["schema"].(map[string]any)
	props := schema["properties"].(map[string]any)
	var keys []string
	for k, v := range props {
		keys = append(keys, k)
		tag := v.(map[string]any)
		inner := tag["properties"].(map[string]any)
		if inner["applies"].(map[string]any)["type"] != "boolean" || inner["confidence"].(map[string]any)["type"] != "number" {
			t.Errorf("tag %q schema = %v", k, tag)
		}
		if tag["additionalProperties"] != false || !reflect.DeepEqual(tag["required"], []any{"applies", "confidence"}) {
			t.Errorf("tag %q must require exactly applies and confidence: %v", k, tag)
		}
	}
	slices.Sort(keys)
	if !reflect.DeepEqual(keys, []string{"hardware", "weekend"}) {
		t.Errorf("schema properties = %v, want exactly the candidates", keys)
	}
	if !reflect.DeepEqual(schema["required"], []any{"hardware", "weekend"}) || schema["additionalProperties"] != false {
		t.Errorf("schema must require every candidate and nothing else: %v", schema)
	}
	if format["type"] != "json_schema" {
		t.Errorf("format type = %v", format["type"])
	}
}

func TestClaudeSendsTheSameStateAndExamplesAsJev(t *testing.T) {
	fake, srv := newFakeAnthropic(t)
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
	if _, err := c.Check(context.Background(), sampleInput()); err != nil {
		t.Fatal(err)
	}
	body := fake.bodies[0]
	if body["model"] != "claude-haiku-5-5" {
		t.Errorf("model = %v", body["model"])
	}
	if body["thinking"].(map[string]any)["type"] != "adaptive" || body["output_config"].(map[string]any)["effort"] != "low" {
		t.Errorf("low config: thinking %v, output_config %v", body["thinking"], body["output_config"])
	}
	system, _ := body["system"].([]any)
	if len(system) != 1 || !strings.Contains(system[0].(map[string]any)["text"].(string), jev.CriteriaFalse) {
		t.Errorf("system = %v, want Jev's criteria", body["system"])
	}
	user := body["messages"].([]any)[0].(map[string]any)["content"].([]any)[0].(map[string]any)["text"].(string)
	for _, want := range []string{`"title":"A pocket synth"`, `"notes":"Plays chords"`, `"tags":["music"]`, `"tag":"hardware","examples":["A soldering timer"]`, `"tag":"weekend","examples":[]`, jev.QuestionText} {
		if !strings.Contains(user, want) {
			t.Errorf("user message lacks %s:\n%s", want, user)
		}
	}
}

func TestClaudeNothinkDisablesThinking(t *testing.T) {
	fake, srv := newFakeAnthropic(t)
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:nothink")
	if _, err := c.Check(context.Background(), sampleInput()); err != nil {
		t.Fatal(err)
	}
	if got := fake.bodies[0]["thinking"].(map[string]any)["type"]; got != "disabled" {
		t.Errorf("thinking = %v, want disabled", got)
	}
}

func TestClaudeScoreIsConfidenceWhenItAppliesElseItsComplement(t *testing.T) {
	fake, srv := newFakeAnthropic(t)
	fake.reply = func(map[string]any) (string, string) {
		return `{"hardware":{"applies":true,"confidence":0.8},"weekend":{"applies":false,"confidence":0.9}}`, "end_turn"
	}
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
	res, err := c.Check(context.Background(), sampleInput())
	if err != nil {
		t.Fatal(err)
	}
	if res.Outcome != OutcomeOK || !near(res.Scores["hardware"], 0.8) || !near(res.Scores["weekend"], 0.1) {
		t.Errorf("result = %+v, want hardware 0.8 and weekend 0.1", res)
	}
	if res.InputTokens != 120 || res.OutputTokens != 40 {
		t.Errorf("tokens = %d in, %d out, want 120 and 40", res.InputTokens, res.OutputTokens)
	}
}

func TestClaudeMalformedAnswers(t *testing.T) {
	for name, tc := range map[string]struct{ text, stop, outcome string }{
		"not JSON":             {`hardware: yes`, "end_turn", OutcomeMalformed},
		"a tag missing":        {`{"hardware":{"applies":true,"confidence":0.8}}`, "end_turn", OutcomeMalformed},
		"an extra tag":         {`{"hardware":{"applies":true,"confidence":0.8},"weekend":{"applies":false,"confidence":0.9},"cars":{"applies":true,"confidence":1}}`, "end_turn", OutcomeMalformed},
		"confidence above one": {`{"hardware":{"applies":true,"confidence":1.8},"weekend":{"applies":false,"confidence":0.9}}`, "end_turn", OutcomeMalformed},
		"no applies":           {`{"hardware":{"confidence":0.8},"weekend":{"applies":false,"confidence":0.9}}`, "end_turn", OutcomeMalformed},
		"cut off":              {`{"hardware":{"applies":tr`, "max_tokens", OutcomeMalformed},
		"refused":              {``, "refusal", OutcomeRefused},
	} {
		t.Run(name, func(t *testing.T) {
			fake, srv := newFakeAnthropic(t)
			fake.reply = func(map[string]any) (string, string) { return tc.text, tc.stop }
			c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
			res, err := c.Check(context.Background(), sampleInput())
			if err != nil {
				t.Fatal(err)
			}
			if res.Outcome != tc.outcome || res.Scores != nil || res.Error == "" {
				t.Errorf("result = %+v, want %s with no scores and a reason", res, tc.outcome)
			}
			if res.InputTokens != 120 {
				t.Errorf("a %s answer still costs its tokens; got %d in", tc.outcome, res.InputTokens)
			}
		})
	}
}

func TestClaudeRateLimitIsRetryable(t *testing.T) {
	fake, srv := newFakeAnthropic(t)
	fake.script = []http.HandlerFunc{anthropicError(529, "7")}
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
	_, err := c.Check(context.Background(), sampleInput())
	var rl *RateLimitedError
	if !errors.As(err, &rl) || rl.After != 7*time.Second {
		t.Fatalf("err = %v, want a rate limit asking for 7s", err)
	}
	if len(fake.bodies) != 1 {
		t.Errorf("the SDK retried on its own (%d calls); the runner owns retries", len(fake.bodies))
	}
}

func TestParseContender(t *testing.T) {
	for spec, ok := range map[string]bool{
		"jev":                              true,
		"claude:claude-haiku-5-5:low":      true,
		"claude:claude-haiku-5-5:nothink":  true,
		"claude:claude-sonnet-5-5:medium":  true,
		"claude:claude-opus-5-5:high":      true,
		"claude:claude-opus-5-5:nothink":   false, // thinking can't be disabled on Opus 5.5
		"claude:claude-sonnet-5-5:nothink": false,
		"claude:claude-haiku-5-5:xhigh":    true,
		"claude:claude-haiku-4-5:low":      false, // no price in the table
		"claude:claude-haiku-5-5:fast":     false,
		"gpt":                              false,
	} {
		_, err := ParseContender(spec, Endpoints{})
		if (err == nil) != ok {
			t.Errorf("ParseContender(%q) err = %v, want ok %v", spec, err, ok)
		}
	}
}
