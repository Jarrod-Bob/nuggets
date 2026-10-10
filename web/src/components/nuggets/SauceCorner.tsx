import React from 'react';
import { m, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { dur, ease } from '../../lib/motion';
import { nugHash } from './fluidRadius';
import { oozeParams, oozePath } from './oozePath';
import { useSauce } from '../../models/useSauce';

/**
 * A curry-sauce drip on a named nugget's top-left corner (issue #37). The
 * sauce is its own button: hovering it with a mouse previews the curry
 * spreading out of the corner and down over the card to show the project name; a click, tap or Enter pins it,
 * and a second press or Escape drains it. A click anywhere else on the card,
 * the flood included, still opens the nugget: the flood sits inside the card,
 * so its clicks bubble to the card's own handler.
 *
 * The button's label carries the name, so screen readers get it whether or not
 * the flood is showing; the flood's text is aria-hidden to avoid reading it
 * twice. Motion's reducedMotion setting doesn't cover the ooze (a clip-path),
 * so the flood checks it itself and fades in instead.
 */

// Three drips for the corner, picked by the card's shape seed so a nugget
// always wears the same one. Each covers the top-left corner of a 64×56 box.
const DRIPS: string[] = [
  'M0 0H58C55 5 49 6 46 10C43 14 45 22 41 24C37 26 35 18 31 18C26 18 27 34 22 38C18 41 14 36 15 30C16 25 11 22 7 25C4 27 4 33 0 35Z',
  'M0 0H52C50 6 44 8 42 13C40 19 43 30 38 31C33 32 34 21 28 21C23 21 21 26 17 26C13 26 14 40 9 42C5 44 3 38 0 38Z',
  'M0 0H60C57 4 52 5 50 9C48 14 51 18 47 20C42 22 40 14 35 15C30 16 31 26 27 28C23 30 20 24 16 24C11 24 12 32 7 33C3 34 2 30 0 30Z',
];

// The ooze is one number, --ooze (0 dry → 1 covered), animated on the root.
// It drives the flood's clip-path (oozePath: a wavy front spreading from the
// corner sauce) and, as a CSS variable, the drips that hang over the card's
// bottom once it is covered. Slow, like something thick: the house durations
// are all too quick for sauce.
const OOZE = { duration: 2, ease: ease.inOut };
const DRAIN = { duration: 0.8, ease: ease.inOut };

const CURRY = 'var(--nug-dip-curry)';
const CURRY_LIGHT = 'color-mix(in srgb, var(--nug-dip-curry), white 16%)';
const CURRY_DARK = 'color-mix(in srgb, var(--nug-dip-curry), black 18%)';
// The flood's colour at its far edge, where the creeping drips leave it.
const CURRY_DEEP = 'color-mix(in srgb, var(--nug-dip-curry), black 7%)';
const SPECK = 'color-mix(in srgb, var(--nug-dip-curry), black 42%)';
// Fine warm grain, so the sauce reads as sauce rather than a flat fill.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.2 0 0 0 0 0.02 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
// Long soft highlights along the flow, for a glossy, viscous sheen.
const SHEEN = [
  { left: 6, top: 8, width: 38, height: 7, rotate: 24 },
  { left: 38, top: 44, width: 30, height: 5, rotate: 30 },
  { left: 12, top: 68, width: 20, height: 4, rotate: 20 },
];

type Creep = { left: number; length: number; delay: number };
type Speck = { left: number; top: number; size: number };

// Once the card is covered, curry creeps over its bottom edge: thick drips
// that slowly lengthen, fatten at the tips and hang, and never fall. They are
// blobs under an SVG "goo" filter (blur, then a hard alpha edge), so the
// stem, the tip and the curry along the edge merge like one liquid; a low
// light on the same shape gives them gloss.
const CREEP_DEPTH = 64; // px below the card's edge the drips may reach, tips included
const EDGE = 12; // px of the drip layer that sits inside the card, behind the covered flood
const CREEP = { duration: 6.5, ease: [0.12, 0.6, 0.3, 1] as const }; // fast at first, then a long slow tail
const RETRACT = { duration: 0.5, ease: ease.inOut };

/** Four creeping drips and a scatter of spice specks, varied by the card's shape seed. */
function garnishFor(seed: string): { creeps: Creep[]; specks: Speck[] } {
  let h = nugHash(seed + ':drips');
  const next = () => (h = Math.imul(h ^ 0x51ed, 0x01000193) >>> 0);
  const creeps = [0, 1, 2, 3].map(i => {
    next();
    // Kept between 18% and 82% so none sits over the card's rounded bottom corners.
    return { left: 18 + i * 20 + ((h >>> 3) % 7) - 3, length: 14 + ((h >>> 9) % 27), delay: ((h >>> 17) % 12) / 10 };
  });
  const specks = Array.from({ length: 18 }, () => {
    next();
    return { left: (h >>> 3) % 96 + 2, top: (h >>> 11) % 92 + 4, size: 1.5 + ((h >>> 21) % 3) / 2 };
  });
  return { creeps, specks };
}

export function SauceCorner({ projectName, seed, radius }: { projectName: string; seed: string; radius: string }) {
  const sauce = useSauce();
  const reduce = useReducedMotion();
  const open = sauce.open;
  const drip = DRIPS[nugHash(seed) % DRIPS.length];
  const { creeps, specks } = React.useMemo(() => garnishFor(seed), [seed]);
  const params = React.useMemo(() => oozeParams(seed), [seed]);
  const gooId = 'goo' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // The front is drawn in px, so it needs the card's size, and redraws when that changes.
  const root = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ooze = useMotionValue(0);
  const clip = useMotionValue(`path('M0 0Z')`);
  const redraw = React.useCallback(() => clip.set(`path('${oozePath(ooze.get(), size.w, size.h, params)}')`), [clip, ooze, size, params]);
  useMotionValueEvent(ooze, 'change', redraw);
  React.useEffect(redraw, [redraw]);

  // The creeping drips start once the ooze has nearly covered the card, and pull back first when it drains.
  const creepAfter = (delay: number) => (reduce ? { duration: 0 } : open ? { ...CREEP, delay: OOZE.duration * 0.85 + delay } : RETRACT);

  // Reduced motion: no ooze, just a quick fade; the coverage snaps in under it.
  const target = { '--ooze': open ? 1 : 0, '--fade': reduce ? (open ? 1 : 0) : 1 };
  const transition = reduce
    ? { '--fade': { duration: dur.fast }, '--ooze': { duration: 0, delay: open ? 0 : dur.fast } }
    : { '--ooze': open ? OOZE : DRAIN, '--fade': { duration: 0 } };

  return (
    <m.div ref={root} initial={false} animate={target} transition={transition}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, '--ooze': ooze, '--fade': 1 } as React.ComponentProps<typeof m.div>['style']}>
      {/* Once the card is covered, curry creeps over its bottom edge and hangs there. Drawn first, so the
          flood hides the part inside the card and only what comes over the edge shows. */}
      <svg aria-hidden="true" width={size.w} height={EDGE + CREEP_DEPTH}
        style={{ position: 'absolute', left: 0, top: `calc(100% - ${EDGE}px)`, overflow: 'hidden', opacity: 'var(--fade)' }}>
        <defs>
          <filter id={gooId} x="-20%" y="-20%" width="140%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="goo" />
            {/* A low light, so flat sauce keeps its colour and only curves facing up-left catch a highlight. */}
            <feGaussianBlur in="goo" stdDeviation="2.2" result="height" />
            <feSpecularLighting in="height" surfaceScale="4" specularConstant="0.85" specularExponent="20" lightingColor="#FFF4E0" result="spec">
              <feDistantLight azimuth="225" elevation="25" />
            </feSpecularLighting>
            <feComposite in="spec" in2="goo" operator="in" result="specIn" />
            <feComposite in="goo" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0" />
          </filter>
        </defs>
        <g filter={`url(#${gooId})`}>
          {/* The curry along the edge, reaching just over the card's border; its top is hidden inside the card. */}
          <m.rect x={18} y={-40} width={Math.max(0, size.w - 36)} height={40 + EDGE + 2} rx={9} fill={CURRY_DEEP}
            initial={false} animate={{ opacity: open ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : open ? { duration: 0.3, delay: OOZE.duration * 0.85 } : { duration: 0.2 }} />
          {creeps.map((c, i) => {
            const x = (c.left / 100) * size.w;
            const len = open ? c.length : 0;
            return (
              <React.Fragment key={i}>
                <m.rect x={x - 4} y={0} width={8} fill={CURRY_DEEP}
                  initial={false} animate={{ height: EDGE + len }} transition={creepAfter(c.delay)} />
                {/* The tip fattens as the drip lengthens. */}
                <m.ellipse cx={x} fill={CURRY_DEEP}
                  initial={false} animate={{ cy: EDGE + len, rx: open ? 3 + c.length / 9 : 0, ry: open ? (3 + c.length / 9) * 1.08 : 0 }}
                  transition={creepAfter(c.delay)} />
              </React.Fragment>
            );
          })}
        </g>
      </svg>
      {/* Clipped to the card's own fluid corners, so the sauce and the flood follow its shape. */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden' }}>
        {/* A darker copy just below and right of the front: the lip that makes it look thick. */}
        <m.div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: CURRY_DARK, clipPath: clip, x: 1.5, y: 2.5, opacity: 'var(--fade)' }} />
        <m.div aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '20px 22px', textAlign: 'center',
            background: `radial-gradient(120% 120% at 0 0, ${CURRY_LIGHT} 0%, ${CURRY} 42%, ${CURRY_DEEP} 100%)`,
            clipPath: clip, opacity: 'var(--fade)',
            // Only an open flood takes clicks; they bubble to the card and open the nugget.
            pointerEvents: open ? 'auto' : 'none',
          }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, opacity: 0.4, mixBlendMode: 'multiply' }} />
          {SHEEN.map((g, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${g.left}%`, top: `${g.top}%`, width: `${g.width}%`, height: `${g.height}%`,
              borderRadius: '50%', background: 'var(--nug-white)', opacity: 0.2, filter: 'blur(3px)', transform: `rotate(${g.rotate}deg)`,
            }} />
          ))}
          {specks.map((s, i) => (
            <div key={i} style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, borderRadius: '50%', background: SPECK, opacity: 0.55 }} />
          ))}
          {/* Small text on curry needs dark ink to pass contrast; the white name passes as large text. */}
          <span style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-900)' }}>✨ project name</span>
          <span style={{
            position: 'relative', maxWidth: '100%', fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', fontSize: 22, lineHeight: 1.15,
            color: 'var(--nug-white)', overflowWrap: 'anywhere', textShadow: `0 1px 0 ${CURRY_DARK}`,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{projectName}</span>
        </m.div>
        <m.button type="button" aria-label={`Project name: ${projectName}`} aria-expanded={open}
          onHoverStart={sauce.hoverStart}
          onHoverEnd={sauce.hoverEnd}
          onClick={e => {
            e.stopPropagation();
            sauce.press();
          }}
          onKeyDown={e => {
            if (e.key === 'Escape' && sauce.escape()) e.stopPropagation();
          }}
          whileHover={{ scaleY: 1.1 }}
          style={{
            position: 'absolute', top: 0, left: 0, width: 64, height: 56, padding: 0, border: 'none', background: 'none',
            cursor: 'pointer', pointerEvents: 'auto', transformOrigin: '0 0', outlineOffset: -3,
          }}>
          <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
            <path d={drip} fill={CURRY_DARK} transform="translate(1.2 2)" />
            <path d={drip} fill={CURRY} />
            <ellipse cx="15" cy="8" rx="8" ry="2.6" fill="var(--nug-white)" opacity="0.35" transform="rotate(14 15 8)" />
            <circle cx="30" cy="9" r="1" fill={SPECK} opacity="0.6" />
            <circle cx="9" cy="17" r="0.9" fill={SPECK} opacity="0.6" />
          </svg>
        </m.button>
      </div>
    </m.div>
  );
}
