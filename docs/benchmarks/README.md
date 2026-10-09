# Benchmarks

Performance and behaviour measurements taken while building a feature, kept so later work has a baseline to compare against. Each folder holds one write-up (`README.md`: what was measured, how, the results and their limits) and any script needed to rerun it.

Benchmark scripts are run by hand against a throwaway copy of the app. They are not part of `npm test` or `go test`, and they never touch a real database or external service.

| Folder | What it measures |
|---|---|
| [`sauce-corner/`](sauce-corner/) | The curry-sauce corner (#37), the first Motion animation: download size, frame timing and main-thread cost. |
