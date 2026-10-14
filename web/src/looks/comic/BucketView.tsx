import './bucket.css';
import React from 'react';
import { m, useReducedMotion } from 'motion/react';
import { TopBar } from '../../components/navigation/TopBar';
import { ease, transitions } from '../../lib/motion';
import type { Status } from '../../lib/status';
import type { Bucket } from '../../models/useBucket';
import { dropNext, initialPile, syncPile, type Drawn } from './bucketPile';
import { SettingsButton } from './settings/SettingsButton';
import { Button, CardArt, EmptyState } from './ui';

/** How long between one arrival dropping in and the next. */
export const DROP_MS = 400;
/** The spill, from the tap to the bank: the bucket tips, the nuggets land on the mat and rest there a moment. */
const SPILL_MS = 3300;

/** The stats strip, in the order they read. Raw is last of the work states, the bin last of all. */
const STAT_LINES: ReadonlyArray<{ status: Status; text: string }> = [
  { status: 'done', text: 'fried crispy golden' },
  { status: 'killed', text: 'left to rot' },
  { status: 'building', text: 'sizzling in the fryer' },
  { status: 'exploring', text: 'getting breaded' },
  { status: 'raw', text: 'still raw' },
  { status: 'parked', text: 'in the freezer' },
];

// The bucket is drawn in the prototype's 560 by 640 box, its mouth an ellipse
// centred at (280, 200). Everything is placed in it as percentages so the
// whole thing scales with the bucket.
const BOX_W = 560;
const BOX_H = 640;
const NUGGET_W = 96;
const NUGGET_H = (NUGGET_W * 272) / 372;

/** The heap's rows, bottom up: each row's centre line, how many it holds and how wide it spreads. 30 slots in all, narrowing to a mound. */
const ROWS: ReadonlyArray<{ y: number; n: number; spread: number }> = [
  { y: 222, n: 7, spread: 205 },
  { y: 196, n: 6, spread: 185 },
  { y: 172, n: 6, spread: 160 },
  { y: 150, n: 5, spread: 130 },
  { y: 130, n: 4, spread: 95 },
  { y: 114, n: 2, spread: 45 },
];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Where a slot sits in the heap, in the mouth, filling from the bottom row up, with a little deterministic mess. */
function slotPlace(slot: number) {
  let row = 0;
  let k = slot;
  while (row < ROWS.length - 1 && k >= ROWS[row].n) k -= ROWS[row++].n;
  const { y, n, spread } = ROWS[row];
  const cx = 280 + (n === 1 ? 0 : -spread + (2 * spread * Math.min(k, n - 1)) / (n - 1)) + ((slot * 37) % 13) - 6;
  const cy = y + ((slot * 17) % 9) - 4;
  return { left: pct(cx - NUGGET_W / 2, BOX_W), top: pct(cy - NUGGET_H / 2, BOX_H), tilt: ((slot * 53) % 25) - 12 };
}

// Tipped, the bucket turns TIP_DEG about TIP_ORIGIN and slides TIP_SHIFT
// right, which lays it on its left side with its mouth near (-65, 348). The
// heap rides in the same moving layer, so the spill's landing spots on the
// mat are mapped back into that layer's own (tipped) coordinates.
const TIP_DEG = -78;
const TIP_ORIGIN = { x: 0.18 * BOX_W, y: 0.95 * BOX_H };
const TIP_SHIFT = 0.35 * BOX_W;
const TIP_POSE = { rotate: TIP_DEG, x: `${(TIP_SHIFT / BOX_W) * 100}%`, y: '0%' };

/** The point in the tipped layer that lands on `world` (box units). */
function intoTipped(world: { x: number; y: number }) {
  const a = (-TIP_DEG * Math.PI) / 180;
  const dx = world.x - TIP_ORIGIN.x - TIP_SHIFT;
  const dy = world.y - TIP_ORIGIN.y;
  return { x: TIP_ORIGIN.x + dx * Math.cos(a) - dy * Math.sin(a), y: TIP_ORIGIN.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Where a slot's nugget lands: on the mat, fanned out to the left of the mouth, in the tipped layer's coordinates. */
function spillPlace(slot: number) {
  const u = ((slot * 61) % 100) / 100;
  const v = ((slot * 29) % 100) / 100;
  const p = intoTipped({ x: -110 - u * 310, y: 300 + v * 320 });
  // Lying flat on the mat means undoing the layer's turn, plus a careless spin.
  return { left: pct(p.x - NUGGET_W / 2, BOX_W), top: pct(p.y - NUGGET_H / 2, BOX_H), tilt: ((slot * 71) % 90) - 45 - TIP_DEG };
}

/** Just above the mouth, in the layer's own coordinates, where a spilling nugget clears the rim. */
const MOUTH = { x: 280, y: 120 };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The bucket in the Comic look: a live counter. The headline counts every
 * nugget that exists, a strip says how they split, and the newest 30 are
 * heaped in a bucket as unnamed nuggets (the title shows on hover). New ones
 * drop in one after another; tipping the bucket spills the pile and goes to
 * the bank. Everything it draws comes from the `bucket` model (ADR 0002).
 * Reduced motion: no drops, no spill, the number and the pile just update.
 */
export function BucketView({ bucket }: { bucket: Bucket }) {
  const topBar = (
    <TopBar
      right={
        <>
          <SettingsButton />
          <Button size="sm" icon="arrow-left" onClick={bucket.backToBank}>
            Back to the bank
          </Button>
        </>
      }
    />
  );
  // Before the first answer there's nothing to count, only why. The full page
  // mounts once it loads, so the pile that's already there doesn't pour in.
  if (!bucket.ready) {
    return (
      <>
        {topBar}
        <main className="comic-bucket">
          <div className="comic-bucket-liner">
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
          </div>
        </main>
      </>
    );
  }
  return <BucketPage bucket={bucket} topBar={topBar} />;
}

function BucketPage({ bucket, topBar }: { bucket: Bucket; topBar: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const [pile, setPile] = React.useState(() => initialPile(bucket.pile));
  const [tipping, setTipping] = React.useState(false);

  // Follow the model during render (a refetch brought a new set of nuggets).
  const pileKey = bucket.pile.map((n) => `${n.id}:${n.status}:${n.title}`).join('\n') + `|${bucket.count}`;
  const [seenKey, setSeenKey] = React.useState(pileKey);
  if (pileKey !== seenKey) {
    setSeenKey(pileKey);
    setPile((p) => syncPile(p, bucket.pile, bucket.existing, reduced));
  }

  // Waiting arrivals drop in one at a time.
  const lastDrop = React.useRef(0);
  React.useEffect(() => {
    if (pile.waiting.length === 0) return;
    const wait = Math.max(0, lastDrop.current + DROP_MS - Date.now());
    const timer = setTimeout(() => {
      lastDrop.current = Date.now();
      setPile(dropNext);
    }, wait);
    return () => clearTimeout(timer);
  }, [pile.waiting]);

  // The spill plays out, then the bank.
  const { backToBank } = bucket;
  React.useEffect(() => {
    if (!tipping) return;
    const timer = setTimeout(backToBank, SPILL_MS);
    return () => clearTimeout(timer);
  }, [tipping, backToBank]);

  const tip = () => {
    if (tipping) return;
    if (reduced) backToBank();
    else setTipping(true);
  };

  // Front of the heap last, so a nugget in a lower row overlaps the one behind it.
  const drawn = [...pile.drawn].sort((a, b) => b.slot - a.slot);
  const lines = [
    ...STAT_LINES.map(({ status, text }) => ({ key: status, n: bucket.byStatus[status], text })),
    { key: 'bin', n: bucket.binned, text: 'in the bin' },
  ].filter((l) => l.n > 0);

  // The back (the open mouth), the heap and the front (the body, lip and label) move as one.
  const [hovered, setHovered] = React.useState(false);
  const pose = tipping ? TIP_POSE : { rotate: hovered && !reduced ? -3 : 0, x: '0%', y: '0%' };
  const poseTransition = { duration: 0.42, ease: ease.bounce };

  return (
    <>
      {topBar}

      <main className="comic-bucket" data-tipping={tipping}>
        <div className="comic-bucket-liner">
          {tipping && (
            <m.span
              className="comic-bucket-sfx"
              aria-hidden="true"
              initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              transition={{ duration: 0.32, ease: ease.bounce }}
            >
              TIP!
            </m.span>
          )}

          <figure className="comic-bucket-box" aria-label="The bucket">
            <m.div className="comic-bucket-layer" animate={pose} transition={poseTransition}>
              <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} aria-hidden="true">
                <ellipse cx="290" cy="612" rx="230" ry="26" fill="var(--comic-toast)" />
                <ellipse cx="280" cy="200" rx="230" ry="46" fill="var(--comic-ink)" stroke="var(--comic-ink)" strokeWidth={5} />
              </svg>
            </m.div>

            <m.div className="comic-bucket-layer comic-bucket-layer--pile" animate={pose} transition={poseTransition}>
              <ul className="comic-bucket-pile" aria-label="The pile">
                {drawn.map((n, i) => (
                  <PileItem key={n.id} nugget={n} tipping={tipping} rank={i} />
                ))}
              </ul>
            </m.div>

            <m.div className="comic-bucket-layer comic-bucket-layer--front" animate={pose} transition={poseTransition}>
              <button
                type="button"
                className="comic-bucket-front"
                aria-label="Tip the bucket and spill the nuggets"
                onClick={tip}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} aria-hidden="true">
                  {/* The body's top edge is the rim's front half, so the mouth stays open above it. */}
                  <path d="M50 200L110 590A170 34 0 0 0 450 590L510 200A230 46 0 0 1 50 200Z" fill="var(--comic-paper)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
                  <path d="M86 270L116 470" stroke="var(--comic-paper)" strokeWidth={9} strokeLinecap="round" opacity=".9" />
                  <path d="M48 200A232 48 0 0 0 512 200L512 214A232 50 0 0 1 48 214Z" fill="var(--comic-paper)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
                  <path d="M140 300L420 292L428 552L146 560Z" fill="var(--comic-mayo)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
                </svg>
              </button>
              <div className="comic-bucket-label">
                <h1 className="comic-bucket-headline">
                  <span>Till date, </span>
                  <span className="comic-bucket-n">{bucket.count}</span> <span>{plural(bucket.count, 'nugget has', 'nuggets have')} gone in the bucket:</span>
                </h1>
                <ul className="comic-bucket-stats" aria-label="Nugget counts">
                  {lines.map((l) => (
                    <li key={l.key}>
                      <b>{l.n}</b> {l.text}
                    </li>
                  ))}
                </ul>
              </div>
            </m.div>
          </figure>
        </div>
      </main>
    </>
  );
}

/** One nugget in the heap. A fresh arrival drops in from above; a tipped bucket sends it out of the mouth to rest on the mat. */
function PileItem({ nugget, tipping, rank }: { nugget: Drawn; tipping: boolean; rank: number }) {
  const home = slotPlace(nugget.slot);
  const landed = spillPlace(nugget.slot);
  const size = { width: pct(NUGGET_W, BOX_W), aspectRatio: `${NUGGET_W} / ${NUGGET_H}` };
  return (
    <m.li
      className="comic-bucket-nugget"
      title={nugget.title}
      style={{ ...size, left: home.left, top: home.top, rotate: home.tilt }}
      initial={nugget.fresh ? { y: -360, opacity: 0 } : false}
      animate={
        tipping
          ? {
              left: [home.left, pct(MOUTH.x - NUGGET_W / 2, BOX_W), landed.left],
              top: [home.top, pct(MOUTH.y - NUGGET_H / 2, BOX_H), landed.top],
              rotate: [home.tilt, home.tilt + 40, landed.tilt],
              y: 0,
              opacity: 1,
            }
          : { y: 0, opacity: 1 }
      }
      transition={tipping ? { duration: 0.8, delay: 0.25 + rank * 0.025, ease: ease.out, times: [0, 0.35, 1] } : transitions.appear}
    >
      <CardArt shape={nugget.id} status={nugget.status} />
    </m.li>
  );
}
export default BucketView;
