import { PILE_SIZE, type PileNugget } from '../../models/useBucket';

/** A nugget drawn in the bucket, in the heap position (`slot`) it keeps until it leaves. */
export interface Drawn extends PileNugget {
  slot: number;
  /** True for one that dropped in just now; the pile that was there on load is not fresh. */
  fresh: boolean;
}

/** What the bucket shows (`drawn`, oldest first) and the arrivals still to drop in (`waiting`, oldest first). */
export interface PileState {
  drawn: Drawn[];
  waiting: PileNugget[];
}

/** The pile as it is on load: already there, in the first slots. */
export function initialPile(pile: PileNugget[]): PileState {
  return { drawn: pile.map((n, slot) => ({ ...n, slot, fresh: false })), waiting: [] };
}

const lowestFreeSlot = (drawn: Drawn[]) => {
  const used = new Set(drawn.map((d) => d.slot));
  let slot = 0;
  while (used.has(slot)) slot += 1;
  return slot;
};

/**
 * Reconciles what's drawn with the newest nuggets after a refetch. A drawn
 * nugget that no longer exists (purged) leaves at once; ones not seen
 * before are queued to drop in, or drawn straight away when `instant`
 * (reduced motion).
 */
export function syncPile(state: PileState, pile: PileNugget[], existing: ReadonlySet<number>, instant: boolean): PileState {
  const current = new Map(pile.map((n) => [n.id, n]));
  // A drawn nugget that slid out of the newest 30 stays until the arrival that
  // pushed it out drops in; only a purged one goes now. Titles and statuses can
  // change in place; the drawing keeps its slot.
  let drawn = state.drawn.filter((d) => existing.has(d.id)).map((d) => ({ ...d, ...current.get(d.id) }));
  const known = new Set([...drawn, ...state.waiting].map((n) => n.id));
  const waiting = [...state.waiting.filter((n) => current.has(n.id)), ...pile.filter((n) => !known.has(n.id))];
  if (!instant) return { drawn, waiting };
  for (const n of waiting) drawn = place(drawn, n, false);
  return { drawn, waiting: [] };
}

/** Drops the next waiting nugget in. Past PILE_SIZE the oldest drawn one quietly leaves and its place is taken. */
export function dropNext(state: PileState): PileState {
  const [next, ...waiting] = state.waiting;
  if (!next) return state;
  return { drawn: place(state.drawn, next, true), waiting };
}

function place(drawn: Drawn[], n: PileNugget, fresh: boolean): Drawn[] {
  const kept = drawn.length >= PILE_SIZE ? drawn.slice(1) : drawn;
  return [...kept, { ...n, slot: drawn.length >= PILE_SIZE ? drawn[0].slot : lowestFreeSlot(drawn), fresh }];
}
