import './bucket.css';
import React from 'react';
import { AnimatePresence, m, useReducedMotion, type TargetAndTransition, type Transition, type Variants } from 'motion/react';
import { TopBar } from '../../components/navigation/TopBar';
import { dur, ease, transitions } from '../../lib/motion';
import type { Status } from '../../lib/status';
import type { Bucket } from '../../models/useBucket';
import { BucketBack, BucketFront, BucketShadow } from './BucketArt';
import { HEAP, NUGGET_H, NUGGET_W, TIP_DEG, drawRank, floorFrom, flight, pctX, pctY, spillSpots, type Place } from './bucketGeometry';
import { dropNext, initialPile, syncPile, type Drawn, type PileState } from './bucketPile';
import { Button, CardArt, EmptyState } from './ui';

/** The stats under the count, in the order they read, then the bin. */
const STAT_LINES: ReadonlyArray<{ status: Status; text: string }> = [
  { status: 'done', text: 'fried crispy golden' },
  { status: 'killed', text: 'left to rot' },
  { status: 'building', text: 'sizzling in the fryer' },
  { status: 'exploring', text: 'getting breaded' },
  { status: 'raw', text: 'still raw' },
  { status: 'parked', text: 'in the freezer' },
];

// Timings, in seconds unless named _MS, built from the house tokens (lib/motion).
/** Between one arrival dropping in and the next. */
const DROP_GAP_MS = (dur.slow + dur.instant) * 1000;
/** The bucket falling over, a little rebound included. */
const TIP_S = dur.lazy + dur.instant;
/** When the first nugget leaves the mouth: just after the bucket hits the liner. */
const POUR_AT = dur.slow + dur.instant;
/** Between one nugget pouring out and the next. */
const POUR_GAP = dur.instant / 2;
/** One nugget's flight from the mouth to the liner. */
const FLIGHT_S = dur.lazy + dur.slow;
/** How long the spill rests on the liner before the bank. */
const REST_MS = 1500;
/** The lean on hover: the prototype's 3°. */
const LEAN_DEG = -3;

/** A spilled nugget: its place in the pour, and where it lands. */
interface Spill {
  order: Map<number, number>;
  spots: Map<number, Place>;
}

/**
 * The bucket in the Comic look (issue #57): a live nugget counter, the
 * prototype's striped bucket standing on the bank's tray. The count and the
 * stats are written on its label; the newest 30 nuggets are heaped in its
 * mouth, unnamed (the title shows on hover). Arrivals drop in one at a time;
 * clicking the bucket tips it over, spills the heap onto the liner and, once
 * it has rested there a moment, opens the bank. Everything it draws comes
 * from the `bucket` model (ADR 0002). Under reduced motion nothing moves:
 * the count and the pile just update, and a click opens the bank.
 */
export function BucketView({ bucket }: { bucket: Bucket }) {
  return (
    <>
      <TopBar />
      <main className="comic-bucket">
        <section className="comic-tray comic-bucket-tray" aria-label="The tray">
          <div className="comic-liner comic-bucket-liner">
            {bucket.state === 'ready' ? (
              <BucketScene bucket={bucket} />
            ) : bucket.state === 'failed' ? (
              <EmptyState
                eyebrow="Meanwhile, at the bucket…"
                headline="The bucket wouldn't load"
                body={bucket.loadError}
                action={
                  <Button variant="tomato" size="sm" onClick={bucket.retry}>
                    Try again
                  </Button>
                }
              />
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}

/** Mounted once the bucket has loaded, so the pile that's there on load is simply there. */
function BucketScene({ bucket }: { bucket: Bucket }) {
  const reduced = useReducedMotion() ?? false;
  const boxRef = React.useRef<HTMLElement>(null);
  const [pile, setPile] = React.useState<PileState>(() => initialPile(bucket.pile));
  const [purged, setPurged] = React.useState<ReadonlySet<number>>(() => new Set());
  const [spill, setSpill] = React.useState<Spill | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const tipping = spill !== null;

  // Follow each refetch while the bucket stands (a tipped one has already poured).
  const seen = bucket.pile.map((n) => `${n.id}:${n.status}:${n.title}`).join('\n') + `#${bucket.count}`;
  const [seenKey, setSeenKey] = React.useState(seen);
  if (seen !== seenKey && !tipping) {
    setSeenKey(seen);
    setPurged(new Set(pile.drawn.filter((d) => !bucket.existing.has(d.id)).map((d) => d.id)));
    setPile(syncPile(pile, bucket.pile, bucket.existing, reduced));
  }

  // Arrivals drop in one at a time.
  const lastDrop = React.useRef(0);
  React.useEffect(() => {
    if (pile.waiting.length === 0 || tipping) return;
    const timer = setTimeout(
      () => {
        lastDrop.current = Date.now();
        setPile((p) => dropNext(p));
      },
      Math.max(0, lastDrop.current + DROP_GAP_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pile.waiting, tipping]);

  // The spill lands, rests, and then the bank.
  const { goToBank } = bucket;
  React.useEffect(() => {
    if (!spill) return;
    const n = spill.order.size;
    const landed = n === 0 ? TIP_S : POUR_AT + (n - 1) * POUR_GAP + FLIGHT_S;
    const timer = setTimeout(goToBank, landed * 1000 + REST_MS);
    return () => clearTimeout(timer);
  }, [spill, goToBank]);

  const tip = () => {
    if (tipping) return;
    if (reduced) {
      goToBank();
      return;
    }
    // Where the spill lands is worked out now, from what the liner shows of
    // itself on screen, so every nugget comes to rest in view.
    const box = boxRef.current?.getBoundingClientRect() ?? new DOMRect();
    const liner = boxRef.current?.closest('.comic-liner');
    const inner = liner ? liner.getBoundingClientRect() : box;
    const border = liner ? liner.clientLeft : 0;
    const floor = floorFrom(box, {
      left: Math.max(inner.left + border, 0),
      top: Math.max(inner.top + border, 0),
      right: Math.min(inner.right - border, window.innerWidth || inner.right),
      bottom: Math.min(inner.bottom - border, window.innerHeight || inner.bottom),
    });
    // Top of the heap first: it's nearest the mouth.
    const pouring = [...pile.drawn].sort((a, b) => drawRank(b.slot) - drawRank(a.slot));
    const spots = spillSpots(pouring.length, floor);
    setSpill({ order: new Map(pouring.map((d, i) => [d.id, i])), spots: new Map(pouring.map((d, i) => [d.id, spots[i]])) });
  };

  const drawn = [...pile.drawn].sort((a, b) => drawRank(a.slot) - drawRank(b.slot));
  const lines = [...STAT_LINES.map(({ status, text }) => ({ key: status, n: bucket.byStatus[status], text })), { key: 'bin', n: bucket.binned, text: 'in the bin' }].filter((l) => l.n > 0);
  // The count pops when it changes, not when the page opens.
  const [firstCount] = React.useState(bucket.count);

  return (
    <div className="comic-bucket-stage">
      <figure ref={boxRef} className="comic-bucket-box" aria-label="The bucket">
        <BucketShadow />
        {/* The whole bucket moves as one: the mouth, the heap in it and the
            front all ride in the same two frames, the tip's and the lean's. */}
        <m.div
          className="comic-bucket-tip"
          initial={false}
          animate={tipping ? { rotate: [null, TIP_DEG, TIP_DEG + 6, TIP_DEG] } : { rotate: 0 }}
          transition={{ duration: TIP_S, times: [0, 0.6, 0.8, 1], ease: ['easeIn', 'easeOut', 'easeIn'] }}
        >
          <m.div
            className="comic-bucket-lean"
            initial={false}
            animate={{ rotate: hovered && !tipping && !reduced ? LEAN_DEG : 0 }}
            transition={{ duration: dur.slow + dur.instant, ease: ease.bounce }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          >
            <BucketBack />
            <ul className="comic-bucket-pile" aria-label="The pile">
              <AnimatePresence initial={false} custom={purged}>
                {drawn.map((n) => (
                  <PileNugget key={n.id} nugget={n} purged={purged} reduced={reduced} spill={spill} />
                ))}
              </AnimatePresence>
            </ul>
            <button type="button" className="comic-bucket-tipper" aria-label="Tip the bucket and spill the nuggets" onClick={tip}>
              <BucketFront />
            </button>
            <div className="comic-bucket-label">
              <h1 className="comic-bucket-headline">
                <span className="comic-bucket-lede">Till date, </span>
                <m.span
                  key={bucket.count}
                  className="comic-bucket-count"
                  initial={bucket.count === firstCount ? false : { scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={transitions.appear}
                >
                  {bucket.count}
                </m.span>
                <span className="comic-bucket-lede"> {bucket.count === 1 ? 'nugget has' : 'nuggets have'} gone in the bucket:</span>
              </h1>
              <ul className="comic-bucket-stats" aria-label="How they’re doing">
                {lines.map((l) => (
                  <li key={l.key}>
                    <b>{l.n}</b> {l.text}
                  </li>
                ))}
              </ul>
            </div>
          </m.div>
        </m.div>
        {tipping && (
          <span className="comic-bucket-sfx" aria-hidden="true">
            <m.span
              initial={{ scale: 0.3, rotate: -14, opacity: 0 }}
              animate={{ scale: [0.3, 1.1, 1, 1.05], rotate: [-14, -8, -6, -6], opacity: [0, 1, 1, 0] }}
              transition={{ duration: dur.lazy + dur.slow + dur.instant, times: [0, 0.35, 0.7, 1], ease: 'easeOut', delay: dur.slow }}
            >
              TIP!
            </m.span>
          </span>
        )}
      </figure>
    </div>
  );
}

/**
 * One nugget in the heap, at its place in the bucket's mouth. A fresh arrival
 * falls in from above the liner; when the bucket tips, it pours out of the
 * mouth and lands on the liner.
 */
function PileNugget({ nugget, purged, reduced, spill }: { nugget: Drawn; purged: ReadonlySet<number>; reduced: boolean; spill: Spill | null }) {
  const home = HEAP[nugget.slot];
  const at = { left: pctX(home.x - NUGGET_W / 2), top: pctY(home.y - NUGGET_H / 2), rotate: home.tilt };
  const spot = spill?.spots.get(nugget.id);
  const order = spill?.order.get(nugget.id) ?? 0;

  let animate: TargetAndTransition = { ...at, opacity: 1, zIndex: 1 };
  let transition: Transition = { duration: dur.lazy + dur.base, ease: ease.bounce, opacity: { duration: dur.fast } };
  if (spot) {
    const path = flight(home, spot, (order % 3) - 1);
    // In front of the bucket's front once it's out of the mouth (the second keyframe is above the rim).
    animate = { left: path.left, top: path.top, rotate: path.rotate, zIndex: path.times.map((_, k) => (k < 2 ? 1 : 3)), opacity: 1 };
    transition = { duration: FLIGHT_S, delay: POUR_AT + order * POUR_GAP, times: path.times, ease: 'linear' };
  }
  // How it leaves: a purged one at once, the oldest pushed out by an arrival
  // quietly. AnimatePresence hands a leaving nugget the latest `purged` set.
  const variants: Variants = {
    gone: (gone: ReadonlySet<number>) => (gone.has(nugget.id) || reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6, transition: transitions.leave }),
  };
  return (
    <m.li
      className="comic-bucket-nugget"
      title={nugget.title}
      style={{ width: pctX(NUGGET_W) }}
      initial={nugget.fresh && !reduced ? { ...at, top: pctY(home.y - NUGGET_H / 2 - 560), rotate: home.tilt - 30, opacity: 0, zIndex: 1 } : false}
      animate={animate}
      transition={transition}
      variants={variants}
      custom={purged}
      exit="gone"
    >
      <CardArt shape={nugget.id} status={nugget.status} />
    </m.li>
  );
}

export default BucketView;
