package tagbench

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestReportTablesEachDatasetAndTheScaling(t *testing.T) {
	records := append(hiddenFixture(), Record{Contender: "a", Task: TaskScale, VocabSize: 50, Hidden: "x",
		Scores: map[string]float64{"x": 0.9}, Outcome: OutcomeOK, LatencyMS: 900, InputTokens: 5000, CostUSD: 0.0002})
	var buf bytes.Buffer
	WriteReport(&buf, Summarize(records, nil))
	md := buf.String()
	for _, want := range []string{"## GitHub stand-in", "| a | 4 | 0.333 | 0.250 | 0.286 |", "## Scaling", "| a | 50 | 1 |", "0.20 (F1 0.667)"} {
		if !strings.Contains(md, want) {
			t.Errorf("report lacks %q:\n%s", want, md)
		}
	}
}

func TestEstimateRunAddsUpEveryCheck(t *testing.T) {
	a := &scripted{name: "a"} // 10 input tokens at $1000 per million: $0.01 a check
	est, err := EstimateRun(context.Background(), someCases(4), []Contender{a}, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(est.Contenders) != 1 || est.Contenders[0].Checks != 4 || est.Contenders[0].InputTokens != 40 || !near(est.TotalUSD, 0.04) {
		t.Errorf("estimate = %+v", est)
	}
	if a.calls != 0 {
		t.Error("a dry run called a contender")
	}
}
