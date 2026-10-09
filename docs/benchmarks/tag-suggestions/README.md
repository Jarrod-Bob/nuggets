# Tag suggestions: Jev vs Claude

**Date:** 2026-10-09
**Issue:** [#40](https://github.com/Jarrod-Bob/nuggets/issues/40), branch `feat/tagbench`. The feature it measures is [#25](https://github.com/Jarrod-Bob/nuggets/issues/25).
**Design:** [`2026-10-09-tagbench-design.md`](../../superpowers/specs/2026-10-09-tagbench-design.md)
**Measured:** 2026-10-09, all runs on the same day.
- `jev-latest`, which is `jev-1.13.0`;
- `claude-haiku-5-5` at `effort: low` with adaptive thinking;
- `claude-haiku-5-5` with thinking off.

Jev was asked exactly what production asks: one noul per candidate tag, with up to 3 example titles. Each Claude model got one call per check, with the same state and examples, and a structured-output answer of `{tag, applies, confidence}` per candidate. Phase 1 compared Jev with Haiku only, to keep the spend small. Sonnet 5.5 and Opus 5.5 are supported but not yet run.

| Run | Contenders | Checks | Spend |
|---|---|---|---|
| Smoke tests | all three | 24 | $0.02 |
| Phase 1: quality, speed, cost, scaling to 200 tags | all three | 2,682 | $1.15 |
| Scaling to 500 and 1,000 tags | Jev only | 90 | $0.36 |
| **Total** | | **2,796** | **$1.53** |

## Verdict

**Jev is the right model for this job.** For suggesting tags a nugget is missing, it matches or beats Claude Haiku 5.5 on quality while being about 10× faster, 3–4× cheaper and far steadier. Its probabilities line up with the 0.70 threshold the feature ships with. It has two weaknesses: it's quiet on a small, sparsely tagged bank, and past about 500 tags its suggestions get noisy. Both are known and have a fix.

## Key insights

### 1. It is as accurate as Haiku, in a different way

- **Jev finds more of the missing tags.** On 720 GitHub checks, it put the hidden tag in its top 3 47.5% of the time, against 37–39% for Haiku.
- **Haiku at low effort is slightly more precise:** 0.69 against Jev's 0.61. At each model's own best threshold the two tie on F1 (0.534 against 0.531). Haiku with thinking off is worse than both.
- **On the captain's real bank, Jev was never wrong.** Blind judging found all 3 of its open suggestions right. Haiku at low effort got 14 of 18 right, and with thinking off 20 of 41.
- **Every model misses at least half of the hidden tags at 0.70.** That ceiling belongs to the task (sparse, inconsistent labels), not to Jev. Opus might raise it, at roughly 40× Haiku's cost per check.

### 2. Its scores mean what they say

- **Jev's best threshold on the GitHub stand-in is exactly 0.70**, the value #25 chose before any measurement. Haiku's best is 0.45–0.55, and on the bank Haiku's thinking-off best jumps to 0.80. A Claude version would need tuning per model, and probably per bank.
- **Jev's probability is a trained output.** Claude's confidence is self-reported, since the API has no logprobs. Brier scores are similar (GitHub: Jev 0.044, Haiku 0.038–0.047), but Jev's ranking is the one that lines up with a fixed threshold.

### 3. One question per tag is its biggest strength, and its scaling limit

- **The right tag's score never depends on how many other tags there are**, because each tag is its own question. Jev's recall stayed at 0.50 from 10 tags to 1,000. Haiku has to weigh every tag in one answer. By 200 tags its recall fell (thinking off: 0.57 → 0.29), it took 15–20 s, and 7–13% of its answers left tags out.
- **The same independence means wrong tags pile up.** More tags means more of them clear 0.70 by chance: 1.1 per check at 200 tags, 2.8 at 500, 6.6 at 1,000. At 1,000 tags, 2.4 of the 3 tags shown are wrong. Raising the threshold doesn't rescue it: 0.85 still shows 1.4 wrong tags and drops recall to 0.30.

### 4. Speed, cost and reliability are not close

| | Jev | Haiku 5.5 |
|---|---|---|
| Latency, p50 (typical vocabulary) | **~250 ms** | 2.0–2.7 s |
| Latency at 200 tags | **1.3 s** | 15–20 s |
| Cost per 1,000 checks (GitHub) | **$0.13** | $0.43–0.44 |
| Cost per correct suggestion (GitHub) | **$0.00054** | $0.0022–0.0025 |
| Top 3 changed when asked again | **0–6%** | 16–29% |
| Malformed answers per 100 | **0** | 0–6 (up to 13 at 200 tags) |

- **Cost and latency grow in a straight line with the vocabulary:** about 165 input tokens and 6 ms per tag per check.
- **Jev reads about twice as many input tokens as Haiku**, because each question repeats the nugget. It's still cheaper: its input is about 2.4× cheaper per token ($0.042 against $0.10 per million) and its output is free.
- **A worst case of 1,000 nuggets in a spices Re-sync at 200 tags** costs about $1.30 and 20 minutes with Jev, against about $4.40 and 5½ hours with Haiku. Both figures assume the feature's one-check-at-a-time queue.

### 5. What it means for the feature

- **Keep Jev, and keep 0.70 for now.** It's the measured best on realistic data. On the captain's bank the best was 0.60, but that's 28 cases; revisit only if suggestions feel too rare in real use.
- **Expect Jev to get more useful as the bank grows.** Sparse tags mean thin examples, and that's what makes Jev quiet today. As tags gather nuggets, the bank looks more like the GitHub stand-in, where 0.70 was best.
- **Past about 300–500 tags, add a shortlist step before Jev** (TypeSafe's hierarchical classification pattern) rather than raising the threshold. With 10 tags today, that's a long way off.
- **If a check's latency ever matters, run its batches of 50 questions in parallel.** They run one after another today, which is about 6 s at 1,000 tags.
- **Run Phase 2 (Sonnet and Opus) only to test the quality ceiling.** It costs roughly $5–8. Neither can match Jev's speed or cost, so it would only change the decision if they lifted recall a lot.

## Data

- **Real bank.** The captain's nuggets database, read-only: 19 nuggets and 10 tags. Only 6 nuggets have two or more tags, so it gives 28 hidden-tag cases.
- **GitHub stand-in.** 300 feature requests and their topical labels from 4 apps whose requests read like product ideas: Joplin, KOReader, AntennaPod and FlorisBoard. Housekeeping labels (triage, status, priority and the like) were dropped. 158 of the requests carry two or more labels.
- **Scaling padding.** Labels from unrelated repos pad the candidate list. For Phase 1 (up to 200 tags) these were AppFlowy, Zed, Godot and VS Code. The 500- and 1,000-tag run added home-assistant/core, rust-lang/rust, kubernetes/kubernetes, flutter/flutter and elastic/kibana, for 1,052 distinct labels.

Every case was asked 3 times.

## Results

### GitHub stand-in

720 checks per contender. Quality is measured at threshold 0.70, top 3.

| Contender | Recall@3 | Precision@3 | F1 | Best threshold (F1) | Wrong open suggestions per check | p50 / p95 | $ per 1k checks | $ per correct | Top 3 changed | Malformed per 100 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Jev** | **0.475** | 0.609 | **0.534** | 0.70 (0.534) | 0.49 | **254 / 380 ms** | **$0.127** | **$0.00054** | **6%** | **0** |
| Haiku, low effort | 0.372 | **0.690** | 0.483 | 0.45 (0.531) | **0.32** | 2,734 / 3,967 ms | $0.442 | $0.00246 | 16% | 3.2 |
| Haiku, thinking off | 0.393 | 0.567 | 0.464 | 0.55 (0.501) | 0.46 | 2,624 / 3,139 ms | $0.426 | $0.00219 | 29% | 0.8 |

An issue's labels are all on it already, so any suggestion on an unaltered issue is wrong by construction. Read that column as a false-positive rate.

### Real bank

84 checks per contender (28 cases × 3). The open suggestions were judged blind by the captain: 102 pooled suggestions, 16 yes and 86 no.

| Contender | Hidden-tag recall@3 | Open suggestions made | Judged right | Open precision | Precision@3 (hidden + open) | Best threshold (F1) | p50 / p95 | $ per 1k checks | $ per correct | Top 3 changed | Malformed per 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Jev** | 0.667 | 3 | 3 | **1.00** | **1.000** | 0.60 (**0.902**) | **247 / 340 ms** | **$0.061** | **$0.00025** | **0%** | **0** |
| Haiku, low effort | 0.640 | 18 | 14 | 0.78 | 0.800 | 0.60 (0.772) | 2,105 / 3,218 ms | $0.221 | $0.00062 | 19% | 6.0 |
| Haiku, thinking off | **0.778** | 41 | **20** | 0.49 | 0.875 | 0.80 (0.833) | 2,028 / 2,179 ms | $0.207 | $0.00043 | 29% | 0 |

Counts include the 3 repeats of each case.

**Jev never suggested a wrong tag on the bank, but it suggested very little.** It made 3 open suggestions, all right. Haiku with thinking off found the most genuinely missing tags (20), but more than half of its 41 suggestions were wrong. Haiku at low effort sits between them: 14 right out of 18. On a bank this small and sparsely tagged, a 0.70 threshold makes Jev quiet. Its best threshold here was 0.60, so it's worth watching whether real use feels too sparse.

### Scaling

The same 10 GitHub hidden-tag cases, asked against vocabularies of 10, 50 and 200 tags. 30 checks per contender at each size.

| Contender | Vocabulary | Recall@3 | p50 / p95 | Input tokens | $ per check | Malformed per 100 |
|---|---|---|---|---|---|---|
| Jev | 10 | 0.500 | 251 / 413 ms | 1,842 | $0.000077 | 0 |
| Jev | 50 | 0.500 | 291 / 454 ms | 7,729 | $0.000325 | 0 |
| Jev | 200 | 0.500 | 1,254 / 1,541 ms | 31,523 | $0.001324 | 0 |
| Haiku, low effort | 10 | 0.467 | 2,222 / 2,988 ms | 1,324 | $0.000274 | 0 |
| Haiku, low effort | 50 | 0.433 | 6,689 / 8,037 ms | 4,043 | $0.001248 | 0 |
| Haiku, low effort | 200 | 0.423 | 19,900 / 22,903 ms | 14,890 | $0.004403 | 13.3 |
| Haiku, thinking off | 10 | 0.567 | 2,098 / 2,460 ms | 1,323 | $0.000265 | 0 |
| Haiku, thinking off | 50 | 0.367 | 4,809 / 6,709 ms | 4,042 | $0.001074 | 0 |
| Haiku, thinking off | 200 | 0.286 | 15,325 / 15,828 ms | 14,889 | $0.004202 | 6.7 |

Jev reads about twice as many input tokens as Haiku, because each tag's question carries the nugget again. It's still cheaper because its input costs $0.042 per million tokens, about 2.4× less than Haiku's $0.10, and its output is free.

### Scaling to 500 and 1,000 tags (Jev only)

A second run asked Jev the same 10 hidden-tag cases against 200, 500 and 1,000 tags, 30 checks per size. It cost $0.36. Reaching 1,000 tags needed more padding labels: home-assistant/core, rust-lang/rust, kubernetes/kubernetes, flutter/flutter and elastic/kibana were added, for 1,052 distinct labels. The 300 stand-in issues were kept exactly as in Phase 1. The 200-tag size was re-run because the padding mix changed. The harness now refuses to build a size its labels can't fill: earlier it would have quietly trimmed a "1,000-tag" case to the labels available.

| Vocabulary | Recall@3 | Wrong tags shown per check (of up to 3) | p50 / p95 | Input tokens | $ per check | Malformed |
|---|---|---|---|---|---|---|
| 200 | 0.50 | 1.13 | 1,254 / 1,407 ms | 33,188 | $0.0014 | 0 |
| 500 | 0.50 | 1.83 | 3,222 / 3,522 ms | 83,453 | $0.0035 | 0 |
| 1,000 | 0.50 | **2.37** | 6,290 / 6,725 ms | 167,569 | $0.0070 | 0 |

- **Jev finds the right tag just as often at 1,000 tags as at 10.** Every tag is its own question, so the hidden tag's score doesn't change as the vocabulary grows. The same 15 of 30 clear 0.70 at every size.
- **Noise grows, though.** Above 0.70 the number of wrong tags per check rises from 1.1 at 200 tags to 6.6 at 1,000. That's enough to crowd the top 3: at 1,000 tags, 2.4 of the 3 tags shown are wrong.
- **Raising the threshold doesn't fix it.** At 1,000 tags, 0.85 still shows 1.4 wrong tags per check and drops recall to 0.30. 0.90 cuts the wrong tags to 0.5 but keeps recall at only 0.17.
- **Cost and time grow in a straight line.** Each tag adds about 165 input tokens and 6 ms per check, which comes to $0.007 and 6.3 s at 1,000 tags. The check's 20 requests of 50 questions run one after another.
- **The fix at a few hundred tags is to shortlist candidates before asking Jev**, not to raise the threshold. TypeSafe's hierarchical classification cookbook covers that.

A limit on this run: the padding labels come from unrelated projects, and some (`ui`, `performance`, `accessibility`) may genuinely fit the issue. So "wrong" overstates the noise a little. The trend is still clear.

## Found while building it

- **Claude's answer schema can't name every tag.** One required property per tag made a structured-output grammar that the API rejects from about 50 tags: "The compiled grammar is too large". The benchmark therefore asks for a list of `{tag, applies, confidence}` and checks coverage in code. A missing tag counts as malformed.
- **Claude's confidence is self-reported.** The API exposes no logprobs. Score is the stated confidence when a tag applies, and 1 − confidence when it doesn't. Jev's noul is a trained probability. Brier scores came out similar (GitHub: Jev 0.044, Haiku 0.038–0.047), but the thresholds behave differently (see the summary).

## Limits of these numbers

- **The real bank is tiny.** 28 hidden-tag cases and 62 open suggestions are enough to spot a gross failure or a clear lean, not to rank the models. The GitHub stand-in carries the comparison.
- **GitHub labels are an imperfect stand-in.** They are other projects' labels, applied by other people, and incomplete in the same way the captain's tags are. The stand-in's absolute numbers matter less than the gaps between contenders.
- **Only Haiku has been run.** Sonnet 5.5 and Opus 5.5 may well beat Jev on quality, at roughly 20–40× Haiku's cost per check. That's Phase 2.
- **Latency was measured from one machine,** with up to 8 checks in flight and at most 4 calls per second per contender. It includes network time to both APIs.
- **Prices are list prices** as of 2026-10-09: Jev $0.042 per million input tokens with free output; Haiku 5.5 $0.10 / $0.50.

## Rerun it

From the repo root. It spends real money: start with `-dry-run`. Jev's key is read from the nuggets database, and Claude's comes from `ANTHROPIC_API_KEY` or an `ant auth login` profile.

```sh
go run ./docs/benchmarks/tag-suggestions fetch             # cache the GitHub stand-in (free, uses gh)
go run ./docs/benchmarks/tag-suggestions run -dry-run      # forecast the cost
go run ./docs/benchmarks/tag-suggestions run               # Phase 1 contenders, capped at -max-usd 2
go run ./docs/benchmarks/tag-suggestions judge             # blind y/n on the bank's open suggestions
go run ./docs/benchmarks/tag-suggestions report            # Markdown tables for the latest results
```

Cached data and results go to `docs/benchmarks/tag-suggestions/data/`, which is gitignored. Add Sonnet or Opus with `-contenders jev,claude:claude-sonnet-5-5:low`.
