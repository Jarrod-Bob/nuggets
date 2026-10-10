import type { Status } from '../../../api';
import { CARD_SHAPES } from './cardShapes';

/** The viewBox every card drawing shares (the lumpy outlines are drawn in it). */
export const CARD_BOX = '-8 -4 372 272';

const STATUS_FILL: Record<Status, string> = {
  raw: 'var(--comic-raw)',
  exploring: 'var(--comic-nugget)',
  building: 'var(--comic-nugget)',
  parked: 'var(--comic-mayo)',
  killed: 'var(--comic-burnt)',
  done: 'var(--comic-pickle)',
};

/** One of the eight outlines; any whole number picks one. */
export function cardShape(n: number): string {
  return CARD_SHAPES[Math.abs(n) % CARD_SHAPES.length];
}

/** A nugget's id as a number for picking its shape and tilt, so it looks the same on every visit. */
export function shapeSeed(id: number | string | undefined, fallback = 0): number {
  const n = Math.abs(Number(id));
  return Number.isNaN(n) ? fallback : n;
}

/** The outline's dash: parked nuggets are drawn with a dashed line. */
export const outlineDash = (status: Status) => (status === 'parked' ? '10 8' : undefined);

/**
 * A card's drawing: the outline repeated in ink as its solid shadow, the status
 * fill, the shine and the crumbs. Decorative (aria-hidden); give it a card
 * body in front. Reused by anything drawn as a nugget (the tray, the bin, a
 * drawn nugget).
 */
export function CardArt({ shape, status }: { shape: number; status: Status }) {
  const d = cardShape(shape);
  return (
    <svg className="comic-card-art" viewBox={CARD_BOX} aria-hidden="true">
      <path d={d} fill="var(--comic-ink)" transform="translate(7 8)" />
      <path d={d} fill={STATUS_FILL[status]} stroke="var(--comic-ink)" strokeWidth={3.5} strokeLinejoin="round" strokeDasharray={outlineDash(status)} />
      <path d="M38 96C46 64 74 44 112 36M126 33h8" stroke="var(--comic-paper)" strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M300 110l4 6M292 180l6 2M70 186l-3 6M250 222l5 2M318 140l2 6" stroke="var(--comic-nugget-deep)" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
