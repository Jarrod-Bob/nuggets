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
/** The spill, from the tap to the bank: the bucket tips, then the pile pours out. */
const SPILL_MS = 1200;

/** The stats strip, in the order they read. Raw is last of the work states, the bin last of all. */
const STAT_LINES: ReadonlyArray<{ status: Status; text: string }> = [
  { status: 'done', text: 'fried crispy golden' },
  { status: 'killed', text: 'left to rot' },
  { status: 'building', text: 'sizzling in the fryer' },
  { status: 'exploring', text: 'getting breaded' },
  { status: 'raw', text: 'still raw' },
  { status: 'parked', text: 'in the freezer' },
];

// The bucket is drawn in the prototype's 560 by 640 box; nuggets are placed in
// it as percentages so the whole thing scales with the bucket.
const BOX_W = 560;
const BOX_H = 640;
const NUGGET_W = 112;
const NUGGET_H = (NUGGET_W * 272) / 372;
const PER_ROW = 6;

/** Where a slot sits in the heap: rows climbing from the lip, each shifted half a nugget, with a little deterministic mess. */
function slotPlace(slot: number) {
  const row = Math.floor(slot / PER_ROW);
  const x = 62 + (slot % PER_ROW) * 54 + (row % 2) * 27 + ((slot * 37) % 13) - 6;
  const y = 165 - row * 28 + ((slot * 17) % 9) - 4;
  return { left: `${(x / BOX_W) * 100}%`, top: `${(y / BOX_H) * 100}%`, tilt: ((slot * 53) % 25) - 12 };
}

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

  return (
    <>
      {topBar}

      <main className="comic-bucket">
        <section className="comic-bucket-text">
          <h1 className="comic-bucket-headline">
            Till date, <span className="comic-bucket-n">{bucket.count}</span> {plural(bucket.count, 'nugget has', 'nuggets have')} gone in the bucket:
          </h1>
          <ul className="comic-bucket-stats" aria-label="Nugget counts">
            {lines.map((l) => (
              <li key={l.key}>
                <b>{l.n}</b> {l.text}
              </li>
            ))}
          </ul>
          <Button variant="tomato" size="lg" iconAfter="arrow-right" onClick={tip}>
            Tip the bucket
          </Button>
        </section>

        <div className="comic-bucket-panel" data-tipping={tipping}>
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
          <m.div
            className="comic-bucket-stage"
            animate={tipping ? { rotate: -34, x: '-4%', y: '4%' } : { rotate: 0, x: '0%', y: '0%' }}
            whileHover={tipping || reduced ? undefined : { rotate: -3 }}
            transition={{ duration: 0.42, ease: ease.bounce }}
          >
            <svg className="comic-bucket-back" viewBox={`0 0 ${BOX_W} ${BOX_H}`} aria-hidden="true">
              <ellipse cx="290" cy="612" rx="230" ry="26" fill="var(--comic-toast)" />
              <ellipse cx="280" cy="200" rx="230" ry="46" fill="var(--comic-ink)" />
            </svg>

            <ul className="comic-bucket-pile" aria-label="The pile">
              {drawn.map((n, i) => (
                <PileItem key={n.id} nugget={n} tipping={tipping} rank={i} />
              ))}
            </ul>

            <button type="button" className="comic-bucket-front" aria-label="Tip the bucket and spill the nuggets" onClick={tip}>
              <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} aria-hidden="true">
                <path d="M50 200L110 590A170 34 0 0 0 450 590L510 200A230 46 0 0 0 50 200Z" fill="var(--comic-paper)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
                <path d="M86 260L116 470" stroke="var(--comic-paper)" strokeWidth={9} strokeLinecap="round" opacity=".9" />
                <path d="M48 200A232 48 0 0 0 512 200L512 214A232 50 0 0 1 48 214Z" fill="var(--comic-paper)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
                <path d="M170 360L392 352L400 470L176 480Z" fill="var(--comic-mayo)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
              </svg>
              <span className="comic-bucket-label" aria-hidden="true">
                NUGGETS
              </span>
            </button>
          </m.div>
        </div>
      </main>
    </>
  );
}

/** One nugget in the heap. A fresh arrival drops in from above; a tipped bucket sends it flying out of the mouth. */
function PileItem({ nugget, tipping, rank }: { nugget: Drawn; tipping: boolean; rank: number }) {
  const place = slotPlace(nugget.slot);
  const spin = (rank % 2 ? 1 : -1) * (40 + rank * 12);
  return (
    <m.li
      className="comic-bucket-nugget"
      title={nugget.title}
      style={{ left: place.left, top: place.top, width: `${(NUGGET_W / BOX_W) * 100}%`, aspectRatio: `${NUGGET_W} / ${NUGGET_H}`, rotate: place.tilt }}
      initial={nugget.fresh ? { y: -360, opacity: 0 } : false}
      animate={tipping ? { x: -480, y: 520, rotate: place.tilt + spin, scale: 0.8, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
      transition={tipping ? { duration: 0.76, delay: 0.38 + rank * 0.03, ease: ease.out } : transitions.appear}
    >
      <CardArt shape={nugget.id} status={nugget.status} />
    </m.li>
  );
}
export default BucketView;
