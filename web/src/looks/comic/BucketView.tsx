import './bucket.css';
import React from 'react';
import { AnimatePresence, m, useReducedMotion, type Variants } from 'motion/react';
import { TopBar } from '../../components/navigation/TopBar';
import { dur, ease, transitions } from '../../lib/motion';
import type { Status } from '../../lib/status';
import type { Bucket } from '../../models/useBucket';
import { BucketBack, BucketFront, BucketShadow } from './BucketArt';
import { HEAP, NUGGET_H, NUGGET_W, drawRank, pctX, pctY } from './bucketGeometry';
import { dropNext, initialPile, syncPile, type Drawn, type PileState } from './bucketPile';
import { CardArt } from './ui';

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
/** The lean on hover: the prototype's 3°. */
const LEAN_DEG = -3;

/**
 * The bucket in the Comic look (issue #57): a live nugget counter, the
 * prototype's striped bucket standing on the bank's tray. The count and the
 * stats are written on its label; the newest 30 nuggets are heaped in its
 * mouth, unnamed (the title shows on hover). Arrivals drop in one at a time.
 * Everything it draws comes from the `bucket` model (ADR 0002). Under reduced
 * motion nothing moves: the count and the pile just update.
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
  const [pile, setPile] = React.useState<PileState>(() => initialPile(bucket.pile));
  const [purged, setPurged] = React.useState<ReadonlySet<number>>(() => new Set());
  const [hovered, setHovered] = React.useState(false);

  // Follow each refetch.
  const seen = bucket.pile.map((n) => `${n.id}:${n.status}:${n.title}`).join('\n') + `#${bucket.count}`;
  const [seenKey, setSeenKey] = React.useState(seen);
  if (seen !== seenKey) {
    setSeenKey(seen);
    setPurged(new Set(pile.drawn.filter((d) => !bucket.existing.has(d.id)).map((d) => d.id)));
    setPile(syncPile(pile, bucket.pile, bucket.existing, reduced));
  }

  // Arrivals drop in one at a time.
  const lastDrop = React.useRef(0);
  React.useEffect(() => {
    if (pile.waiting.length === 0) return;
    const timer = setTimeout(
      () => {
        lastDrop.current = Date.now();
        setPile((p) => dropNext(p));
      },
      Math.max(0, lastDrop.current + DROP_GAP_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pile.waiting]);

  const drawn = [...pile.drawn].sort((a, b) => drawRank(a.slot) - drawRank(b.slot));
  const lines = [...STAT_LINES.map(({ status, text }) => ({ key: status, n: bucket.byStatus[status], text })), { key: 'bin', n: bucket.binned, text: 'in the bin' }].filter((l) => l.n > 0);
  // The count pops when it changes, not when the page opens.
  const [firstCount] = React.useState(bucket.count);

  return (
    <div className="comic-bucket-stage">
      <figure className="comic-bucket-box" aria-label="The bucket">
        <BucketShadow />
        {/* The whole bucket moves as one: the mouth, the heap in it and the
            front all ride in the same two frames, the tip's and the lean's. */}
        <div className="comic-bucket-tip">
          <m.div
            className="comic-bucket-lean"
            initial={false}
            animate={{ rotate: hovered && !reduced ? LEAN_DEG : 0 }}
            transition={{ duration: dur.slow + dur.instant, ease: ease.bounce }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          >
            <BucketBack />
            <ul className="comic-bucket-pile" aria-label="The pile">
              <AnimatePresence initial={false} custom={purged}>
                {drawn.map((n) => (
                  <PileNugget key={n.id} nugget={n} purged={purged} reduced={reduced} />
                ))}
              </AnimatePresence>
            </ul>
            <button type="button" className="comic-bucket-tipper" aria-label="Tip the bucket and spill the nuggets">
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
        </div>
      </figure>
    </div>
  );
}

/**
 * One nugget in the heap, at its place in the bucket's mouth. A fresh arrival
 * falls in from above the liner.
 */
function PileNugget({ nugget, purged, reduced }: { nugget: Drawn; purged: ReadonlySet<number>; reduced: boolean }) {
  const home = HEAP[nugget.slot];
  const at = { left: pctX(home.x - NUGGET_W / 2), top: pctY(home.y - NUGGET_H / 2), rotate: home.tilt };
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
      initial={nugget.fresh && !reduced ? { ...at, top: pctY(home.y - NUGGET_H / 2 - 560), rotate: home.tilt - 30, opacity: 0 } : false}
      animate={{ ...at, opacity: 1 }}
      transition={{ duration: dur.lazy + dur.base, ease: ease.bounce, opacity: { duration: dur.fast } }}
      variants={variants}
      custom={purged}
      exit="gone"
    >
      <CardArt shape={nugget.id} status={nugget.status} />
    </m.li>
  );
}

export default BucketView;
