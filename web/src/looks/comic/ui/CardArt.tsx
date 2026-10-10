import type { Status } from '../../../lib/status';
import { CARD_BOX, cardShape, outlineDash } from './cardGeometry';

const STATUS_FILL: Record<Status, string> = {
  raw: 'var(--comic-raw)',
  exploring: 'var(--comic-nugget)',
  building: 'var(--comic-nugget)',
  parked: 'var(--comic-mayo)',
  killed: 'var(--comic-burnt)',
  done: 'var(--comic-pickle)',
};

/**
 * A card's drawing: the outline repeated in ink as its solid shadow, the status
 * fill, the shine and the crumbs. Decorative (aria-hidden); give it a card
 * body in front. `shape` picks one of the eight outlines (derive it from the
 * nugget's id with `shapeSeed`). Reused by anything drawn as a nugget (the
 * tray, the bin, a drawn nugget).
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
