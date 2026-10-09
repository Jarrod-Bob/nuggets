# Benchmarks

Performance and behaviour measurements taken while building a feature, kept so later work has a baseline to compare against. Each folder holds one write-up (`README.md`: what was measured, how, the results and their limits) and any script needed to rerun it.

Benchmark scripts are run by hand. They are not part of `npm test` or `go test` (a benchmark's own unit tests may be, using fakes only). By default they run against a throwaway copy of the app and never touch a real database or external service. A benchmark that has to break that rule says so in its write-up, and keeps it safe: [`tag-suggestions/`](tag-suggestions/) reads the real bank read-only and calls paid APIs only when run by hand, under a spend cap.

| Folder | What it measures |
|---|---|
| [`sauce-corner/`](sauce-corner/) | The curry-sauce corner (#37), the first Motion animation: download size, frame timing and main-thread cost. |
| [`tag-suggestions/`](tag-suggestions/) | Tag suggestions (#25, #40): Jev against Claude Haiku 5.5 on quality, speed, tokens and cost, and Jev up to 1,000 tags. Jev matches Haiku on quality and is about 10× faster and 3–4× cheaper; past about 500 tags it needs a shortlist step. |
