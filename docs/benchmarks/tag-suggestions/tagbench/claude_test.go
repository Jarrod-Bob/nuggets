package tagbench

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
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

func TestClaudeSchemaStaysTheSameSizeWhateverTheVocabulary(t *testing.T) {
	// One property per tag compiles to a grammar the API rejects at 50+ tags
	// ("The compiled grammar is too large"), so the schema is a list whose
	// size doesn't grow with the vocabulary; parseAnswer checks coverage.
	fake, srv := newFakeAnthropic(t)
	c := newTestClaude(t, srv.URL, "claude:claude-haiku-5-5:low")
	if _, err := c.Check(context.Background(), sampleInput()); err != nil {
		t.Fatal(err)
	}
	format := fake.bodies[0]["output_config"].(map[string]any)["format"].(map[string]any)
	if format["type"] != "json_schema" {
		t.Errorf("format type = %v", format["type"])
	}
	small := format["schema"]
	big := sampleInput()
	for i := 0; i < 200; i++ {
		big.Candidates = append(big.Candidates, jev.Candidate{Tag: fmt.Sprintf("tag-%d", i)})
	}
	if !reflect.DeepEqual(toJSONValue(t, schema(big)), small) {
		t.Errorf("schema grows with the candidates: %v", small)
	}
	items := small.(map[string]any)["properties"].(map[string]any)["answers"].(map[string]any)["items"].(map[string]any)
	if !reflect.DeepEqual(items["required"], []any{"tag", "applies", "confidence"}) || items["additionalProperties"] != false {
		t.Errorf("each answer must be exactly tag, applies, confidence: %v", items)
	}
}

func toJSONValue(t *testing.T, v any) any {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatal(err)
	}
	return out
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
		return `{"answers":[{"tag":"hardware","applies":true,"confidence":0.8},{"tag":"weekend","applies":false,"confidence":0.9}]}`, "end_turn"
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
		"a tag missing":        {`{"answers":[{"tag":"hardware","applies":true,"confidence":0.8}]}`, "end_turn", OutcomeMalformed},
		"an extra tag":         {`{"answers":[{"tag":"hardware","applies":true,"confidence":0.8},{"tag":"weekend","applies":false,"confidence":0.9},{"tag":"cars","applies":true,"confidence":1}]}`, "end_turn", OutcomeMalformed},
		"confidence above one": {`{"answers":[{"tag":"hardware","applies":true,"confidence":1.8},{"tag":"weekend","applies":false,"confidence":0.9}]}`, "end_turn", OutcomeMalformed},
		"a tag twice":          {`{"answers":[{"tag":"hardware","applies":true,"confidence":0.8},{"tag":"hardware","applies":false,"confidence":0.9}]}`, "end_turn", OutcomeMalformed},
		"no applies":           {`{"answers":[{"tag":"hardware","confidence":0.8},{"tag":"weekend","applies":false,"confidence":0.9}]}`, "end_turn", OutcomeMalformed},
		"cut off":              {`{"answers":[{"tag":"hardware","applies":tr`, "max_tokens", OutcomeMalformed},
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
