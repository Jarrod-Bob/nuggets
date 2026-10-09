package tagbench

import (
	"math"
	"testing"
)

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

// Three hidden-tag checks on GitHub data (labels are ground truth) and one
// errored call. Every expected number below was worked out by hand.
func hiddenFixture() []Record {
	return []Record{
		{Contender: "a", Dataset: DatasetGitHub, Task: TaskHidden, CaseKey: "c1", ItemID: "r#1", ItemTags: []string{"x", "y"}, Hidden: "x",
			Scores: map[string]float64{"x": 0.9, "a": 0.8, "b": 0.75, "c": 0.72}, Outcome: OutcomeOK, LatencyMS: 100, CostUSD: 0.001},
		{Contender: "a", Dataset: DatasetGitHub, Task: TaskHidden, CaseKey: "c2", ItemID: "r#2", ItemTags: []string{"x", "y"}, Hidden: "y",
			Scores: map[string]float64{"y": 0.6, "a": 0.95}, Outcome: OutcomeOK, LatencyMS: 200, CostUSD: 0.002},
		{Contender: "a", Dataset: DatasetGitHub, Task: TaskHidden, CaseKey: "c3", ItemID: "r#3", ItemTags: []string{"z", "y"}, Hidden: "z",
			Scores: map[string]float64{"z": 0.2, "a": 0.1}, Outcome: OutcomeOK, LatencyMS: 300, CostUSD: 0.003},
		{Contender: "a", Dataset: DatasetGitHub, Task: TaskHidden, CaseKey: "c4", ItemID: "r#4", ItemTags: []string{"z", "y"}, Hidden: "z",
			Outcome: OutcomeError, Error: "boom"},
	}
}

func TestSummaryQualityAtTheThreshold(t *testing.T) {
	s := Summarize(hiddenFixture(), nil).Datasets[DatasetGitHub]["a"]
	if !near(s.Hidden.RecallAt3, 1.0/3) || !near(s.Hidden.PrecisionAt3, 0.25) || !near(s.Hidden.F1, 2*0.25*(1.0/3)/(0.25+1.0/3)) {
		t.Errorf("recall %v precision %v f1 %v, want 1/3, 0.25, 0.285714", s.Hidden.RecallAt3, s.Hidden.PrecisionAt3, s.Hidden.F1)
	}
	if !near(s.Hidden.HitAt1, 2.0/3) || !near(s.Hidden.HitAt3, 1) || !near(s.Hidden.MeanRank, 4.0/3) {
		t.Errorf("by rank: hit@1 %v hit@3 %v mean rank %v, want 2/3, 1, 4/3", s.Hidden.HitAt1, s.Hidden.HitAt3, s.Hidden.MeanRank)
	}
}

func TestSummaryCalibration(t *testing.T) {
	s := Summarize(hiddenFixture(), nil).Datasets[DatasetGitHub]["a"]
	if !near(s.Brier, 3.4434/8) || s.CalibrationN != 8 {
		t.Errorf("brier %v over %d, want 0.430425 over 8", s.Brier, s.CalibrationN)
	}
	top := s.Reliability[9]
	if top.N != 2 || !near(top.MeanPredicted, 0.925) || !near(top.Observed, 0.5) {
		t.Errorf("bin 0.9–1.0 = %+v, want n 2, predicted 0.925, observed 0.5", top)
	}
	if b := s.Reliability[7]; b.N != 2 || !near(b.Observed, 0) {
		t.Errorf("bin 0.7–0.8 = %+v, want n 2, observed 0", b)
	}
	if b := s.Reliability[6]; b.N != 1 || !near(b.Observed, 1) {
		t.Errorf("bin 0.6–0.7 = %+v, want n 1, observed 1", b)
	}
}

func TestSummarySweepFindsTheBestThreshold(t *testing.T) {
	s := Summarize(hiddenFixture(), nil).Datasets[DatasetGitHub]["a"]
	want := map[float64]float64{0.05: 0.6, 0.2: 2.0 / 3, 0.5: 0.5, 0.7: 2 * 0.25 * (1.0 / 3) / (0.25 + 1.0/3), 0.8: 1.0 / 3, 0.9: 0.4, 0.95: 0}
	for _, p := range s.Sweep {
		if w, ok := want[p.Threshold]; ok && !near(p.F1, w) {
			t.Errorf("F1 at %.2f = %v, want %v", p.Threshold, p.F1, w)
		}
	}
	if len(s.Sweep) != 19 {
		t.Errorf("sweep has %d points, want 19 (0.05 to 0.95)", len(s.Sweep))
	}
	if !near(s.BestThreshold.Threshold, 0.2) || !near(s.BestThreshold.F1, 2.0/3) {
		t.Errorf("best = %+v, want 0.20 at F1 2/3 (the higher of two tied thresholds)", s.BestThreshold)
	}
}

func TestSummaryLatencyCostAndFailures(t *testing.T) {
	s := Summarize(hiddenFixture(), nil).Datasets[DatasetGitHub]["a"]
	if s.LatencyP50MS != 200 || s.LatencyP95MS != 300 {
		t.Errorf("latency p50 %v p95 %v, want 200 and 300", s.LatencyP50MS, s.LatencyP95MS)
	}
	if !near(s.CostPerCheck, 0.0015) || !near(s.CostPer1000, 1.5) || !near(s.CostPerCorrect, 0.006) {
		t.Errorf("cost per check %v, per 1000 %v, per correct %v; want 0.0015, 1.5, 0.006", s.CostPerCheck, s.CostPer1000, s.CostPerCorrect)
	}
	if s.Checks != 4 || !near(s.ErroredPer100, 25) || s.MalformedPer100 != 0 || s.RefusedPer100 != 0 {
		t.Errorf("checks %d errored/100 %v malformed/100 %v refused/100 %v", s.Checks, s.ErroredPer100, s.MalformedPer100, s.RefusedPer100)
	}
}

func TestSummaryStabilityAcrossRepeats(t *testing.T) {
	rec := func(key string, repeat int, scores map[string]float64) Record {
		return Record{Contender: "a", Dataset: DatasetGitHub, Task: TaskOpen, CaseKey: key, ItemID: key, Repeat: repeat, Scores: scores, Outcome: OutcomeOK}
	}
	same := map[string]float64{"a": 0.9, "b": 0.8}
	records := []Record{
		rec("c1", 0, same), rec("c1", 1, same), rec("c1", 2, map[string]float64{"b": 0.85, "a": 0.95, "c": 0.1}),
		rec("c2", 0, same), rec("c2", 1, map[string]float64{"a": 0.9, "b": 0.6}),
		rec("c3", 0, same), // one repeat: nothing to compare
	}
	s := Summarize(records, nil).Datasets[DatasetGitHub]["a"]
	if s.StabilityCases != 2 || !near(s.TopSetChangeRate, 0.5) {
		t.Errorf("stability over %d cases = %v, want 0.5 over 2", s.StabilityCases, s.TopSetChangeRate)
	}
}

// On the real bank, a suggestion is right or wrong only once it is judged.
func TestSummaryBankPrecisionComesFromJudgments(t *testing.T) {
	records := []Record{{
		Contender: "a", Dataset: DatasetBank, Task: TaskOpen, CaseKey: "n1", ItemID: "1", ItemTags: []string{"p"},
		Scores: map[string]float64{"q": 0.9, "r": 0.8, "s": 0.75}, Outcome: OutcomeOK,
	}}
	j := Judgments{}
	j.Set("1", "q", VerdictYes)
	j.Set("1", "r", VerdictNo)
	j.Set("1", "s", VerdictSkip)
	s := Summarize(records, j).Datasets[DatasetBank]["a"]
	if !near(s.Open.PrecisionAt3, 0.5) || s.Open.Judged != 2 || s.Open.Suggestions != 3 {
		t.Errorf("open precision %v over %d judged of %d, want 0.5 over 2 of 3", s.Open.PrecisionAt3, s.Open.Judged, s.Open.Suggestions)
	}
}
