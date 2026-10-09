# Curry-sauce corner: performance and behaviour checks

**Date:** 2026-10-09
**Issue:** [#37](https://github.com/Jarrod-Bob/nuggets/issues/37), branch `feat/37-motion-sauce-corner`
**Measured on:** Apple M5, Google Chrome 154 (headless, driven by Playwright), `motion@13.4.3`

The sauce corner is the first animation built on Motion (see [ADR 0001](../../adr/0001-motion-for-animation.md)). A named nugget's card has a curry drip on its top-left corner. Opening it makes the curry spread out from the corner over the card (`oozePath.ts`, about 2s), then thick drips creep over the card's bottom edge and hang there (about 6.5s). These are the numbers taken before shipping it, so later animation work has a baseline to compare against.

## Summary

- **At rest it costs nothing.** An idle bank uses 1–2% of the main thread, and six cards left open use 0.1% once their animations finish.
- **While it plays, it stays at 60fps** with one card or six, even with the CPU slowed 4×. The slow frames are the moment of opening several cards in a row, not the animation itself.
- **On a slow CPU it keeps the main thread about half busy for the ~9s it plays.** That leaves less room for scrolling or typing at the same moment.
- **The download grows by 29 KB gzipped** (96 → 125 KB), all loaded up front.

## Download size

`vite build` of the web app, gzipped. The CSS is unchanged at 2.91 KB.

| Build | JS | JS gzipped |
|---|---|---|
| `main` at `1f51d71` (before Motion) | 315.1 KB | 95.8 KB |
| `feat/37-motion-sauce-corner` | 398.7 KB | 125.0 KB |
| **Difference** | **+83.6 KB** | **+29.2 KB** |

That is Motion (`LazyMotion` + `domAnimation`, `MotionConfig`, `useMotionValue`, `useReducedMotion`) plus the sauce code.

## Runtime

A bank of 24 named nuggets in a 1280×900 window. Each scenario samples frames with `requestAnimationFrame` and reads Chrome's own counters (`Performance.getMetrics`) before and after, while the sauce buttons are clicked to pin their floods open. "4× slower" uses Chrome's CPU throttling to stand in for a mid-range phone.

| CPU | Scenario | fps | p95 frame | Worst frame | Frames > 33ms | Long tasks | Main thread busy | Style + layout | Script |
|---|---|---|---|---|---|---|---|---|---|
| full speed | idle bank | 60 | 16.7ms | 17ms | 0 | 0 | 0.9% | 0 ms/s | 1 ms/s |
| full speed | 1 card open | 60 | 16.8ms | 17ms | 0 | 0 | 9.0% | 13 ms/s | 10 ms/s |
| full speed | 6 cards open at once | 59 | 16.7ms | 117ms | 2 | 2 | 17.9% | 42 ms/s | 32 ms/s |
| 4× slower | idle bank | 60 | 16.7ms | 17ms | 0 | 0 | 2.2% | 0 ms/s | 4 ms/s |
| 4× slower | 1 card open | 60 | 16.7ms | 67ms | 1 | 0 | 46.0% | 56 ms/s | 52 ms/s |
| 4× slower | 6 cards open at once | 60 | 16.8ms | 50ms | 1 | 0 | 52.8% | 108 ms/s | 96 ms/s |
| 4× slower | 6 cards open, settled | – | – | – | – | – | 0.1% | 0 ms/s | 0 ms/s |

An earlier run gave the same picture. Its worst frame when opening six cards at full speed was 200ms instead of 117ms, so treat the worst-frame column as noisy.

**Where the time goes**

- The ooze recalculates the wavy edge (96 points) in JavaScript every frame and sets it as the `clip-path` of two layers, the flood and its darker rim. That is the style and script time in the table.
- The creep animates about nine SVG attributes per card under a blur-and-threshold ("goo") filter with a lighting pass. The filter is drawn on the graphics side.
- The grain, sheen and spice specks are static, so they are drawn once.

**Limits of these numbers**

- They come from headless desktop Chrome. CPU throttling slows JavaScript, style and layout, but not drawing, and the goo filter is mostly drawing, so the creep's cost is probably understated.
- Nothing here was measured on a real phone or in Safari, which handles SVG filters differently. Check both before relying on these numbers for mobile.

## Behaviour checks

Run against the built app, in Chrome, with `playwright-core`, alongside the unit tests (`IdeaCard.test.tsx` for the button and accessibility behaviour, `oozePath.test.ts` for the ooze shape):

- Hovering the sauce previews the flood and moving away drains it. A click pins it, and a second click drains it even while the pointer is still on the sauce.
- Clicking the open flood opens the nugget page.
- A very long project name wraps to two lines and ends with an ellipsis.
- The bite corner stays visible on top of the flood.
- With `prefers-reduced-motion: reduce`, the flood only fades in and out. Its shape doesn't move, and the drips appear at full length without creeping.
- No console errors in any of the above.

## Possible improvements

Not done; this was judged good enough for now.

1. **Load Motion's animation features on first use** (`LazyMotion features={() => import(...)}`), to keep most of the 29 KB out of the first load.
2. **Cheaper ooze frames:** fewer points on the edge, and one clip update shared by the flood and its rim.

## Rerunning

1. Build the branch and start a throwaway copy on a spare port. Don't use your real database or the default port 7777.
   ```sh
   (cd web && npm run build) && go build -o /tmp/nuggets-bench ./cmd/nuggets
   /tmp/nuggets-bench -addr 127.0.0.1:7789 -db /tmp/nuggets-bench.db -open=false
   ```
2. Seed 24 named nuggets:
   ```sh
   for i in $(seq 1 24); do curl -s -XPOST http://127.0.0.1:7789/api/ideas -H 'content-type: application/json' \
     -d "{\"title\":\"Benchmark nugget number $i with a title\",\"notes\":\"Some notes for nugget $i so the card has body text.\",\"tags\":[\"bench\",\"web\"],\"status\":\"exploring\",\"project_name\":\"Project $i\"}" >/dev/null; done
   ```
3. Run the benchmark from this folder. It drives your installed Google Chrome, so it doesn't download a browser. It takes about 90 seconds.
   ```sh
   cd docs/benchmarks/sauce-corner
   npm install --no-save --no-package-lock playwright-core@1.55.0
   node bench.mjs http://127.0.0.1:7789
   ```
4. For the download size, run `npx vite build` in `web/` on both `main` and the branch, and compare the gzipped JS.
