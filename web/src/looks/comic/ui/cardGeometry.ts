import type { Status } from '../../../lib/status';
import { CARD_SHAPES } from './cardShapes';

/** The viewBox every card drawing shares (the lumpy outlines are drawn in it). */
export const CARD_BOX = '-8 -4 372 272';

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
