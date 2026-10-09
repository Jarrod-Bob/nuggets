# Motion is the web app's animation library

We adopted Motion (`motion`, formerly Framer Motion) with #37's curry-sauce corner, as the one animation library for future work too: #29's nugget bucket, bank list and layout animations, card-to-page morphs. #37 itself could have been plain CSS, and we added the library anyway on purpose, so later animation work builds on one shared foundation rather than each feature picking its own.

## Considered Options

- **Plain CSS / Web Animations API only.** Free, but no React-level exit animations, layout (FLIP) animations or springs, which the bank and #29 will want.
- **GSAP.** Stronger timelines and SVG morphing, but imperative inside React and not under an open-source licence.
- **anime.js, React Spring.** Lighter or physics-first, but each covers less of what the bank needs than Motion, and React Spring's releases have slowed.

## Consequences

- Load it through `<LazyMotion features={domAnimation} strict>` in `App.tsx` and use `m.*` components only; `strict` throws on `motion.*`, which would pull in the full bundle.
- Take durations and easings from `web/src/lib/motion.ts`, which mirrors `styles/tokens/motion.css`; keep the two in step.
- `<MotionConfig reducedMotion="user">` only switches off transform and layout animations. Anything else that moves (`clip-path`, colour, size) must check `useReducedMotion()` itself.
- Motion is not a physics engine: #29's bucket, where nuggets collide and pile up, still needs one (matter-js is the likely pick) alongside it.
