package tagbench

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/jev"
)

func TestJevSendsProductionRequestsAndSumsUsage(t *testing.T) {
	fake, srv := newFakeTypeSafe(t)
	fake.answers["hardware"] = 0.85
	c, err := ParseContender("jev", Endpoints{JevBaseURL: srv.URL, JevKey: "ts_test"})
	if err != nil {
		t.Fatal(err)
	}
	in := sampleInput()
	for i := range 60 { // 62 candidates: two requests, as production splits them
		in.Candidates = append(in.Candidates, jev.Candidate{Tag: "pad" + string(rune('a'+i/26)) + string(rune('a'+i%26)), Examples: []string{}})
	}
	res, err := c.Check(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	want := jev.BuildRequests(in.Title, in.Notes, in.Tags, in.Candidates)
	if len(fake.requests) != len(want) {
		t.Fatalf("%d requests, want %d", len(fake.requests), len(want))
	}
	for i, req := range want {
		raw, _ := req.JSON()
		var w map[string]any
		_ = json.Unmarshal(raw, &w)
		if !reflect.DeepEqual(fake.requests[i], w) {
			t.Errorf("request %d differs from production's", i)
		}
	}
	if res.Outcome != OutcomeOK || res.Scores["hardware"] != 0.85 || res.Scores["weekend"] != 0.1 || len(res.Scores) != 62 {
		t.Errorf("result = %+v", res)
	}
	if res.InputTokens != 300*62 || res.OutputTokens != 40 {
		t.Errorf("tokens = %d in, %d out; want the two requests' usage summed", res.InputTokens, res.OutputTokens)
	}
}

func TestJevRateLimitIsRetryable(t *testing.T) {
	fake, srv := newFakeTypeSafe(t)
	fake.script = []http.HandlerFunc{anthropicError(429, "3")}
	c, _ := ParseContender("jev", Endpoints{JevBaseURL: srv.URL, JevKey: "ts_test"})
	_, err := c.Check(context.Background(), sampleInput())
	var rl *RateLimitedError
	if !errors.As(err, &rl) || rl.After != 3*time.Second {
		t.Fatalf("err = %v, want a rate limit asking for 3s", err)
	}
}
