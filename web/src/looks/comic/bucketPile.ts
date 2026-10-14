import { PILE_SIZE, type PileNugget } from '../../models/useBucket';

/** A nugget drawn in the bucket, in the heap place (`slot`) it keeps until it leaves. */
export interface Drawn extends PileNugget {
  slot: number;
  /** Dropped in just now (it falls in); the pile that was there on load is not. */
  fresh: boolean;
}

/**
 * What the bucket draws, oldest first, and the arrivals still to drop in,
 * oldest first. `newest` is the model's latest newest-30, so a drawn nugget
 * that fell out of it can leave once nothing is waiting.
 */
export interface PileState {
  drawn: Drawn[];
  waiting: PileNugget[];
  newest: ReadonlySet<number>;
}

/** The pile as it is on load: already there, oldest at the bottom. */
export function initialPile(pile: PileNugget[]): PileState {
  return { drawn: pile.map((n, slot) => ({ ...n, slot, fresh: false })), waiting: [], newest: new Set(pile.map((n) => n.id)) };
}

/**
 * Follows a refetch by diffing ids. A purged nugget (no longer `existing`)
 * leaves at once; one not seen before waits to drop in, or is drawn straight
 * away when `instant` (reduced motion). A title or status edit is drawn in
 * place.
 */
export function syncPile(state: PileState, pile: PileNugget[], existing: ReadonlySet<number>, instant: boolean): PileState {
  const latest = new Map(pile.map((n) => [n.id, n]));
  const drawn = state.drawn.filter((d) => existing.has(d.id)).map((d) => ({ ...d, ...latest.get(d.id) }));
  const known = new Set([...drawn, ...state.waiting].map((n) => n.id));
  const waiting = [...state.waiting.filter((n) => latest.has(n.id)).map((n) => latest.get(n.id) ?? n), ...pile.filter((n) => !known.has(n.id))];
  let next: PileState = { drawn, waiting, newest: new Set(latest.keys()) };
  if (instant) while (next.waiting.length > 0) next = dropNext(next, false);
  return settle(next);
}

/**
 * Drops the next waiting nugget in, on top of the heap. Past PILE_SIZE the
 * oldest drawn one quietly leaves and the newcomer drops into its place.
 */
export function dropNext(state: PileState, fresh = true): PileState {
  const [next, ...waiting] = state.waiting;
  if (!next) return state;
  let drawn = state.drawn;
  let slot: number;
  if (drawn.length >= PILE_SIZE) {
    slot = drawn[0].slot;
    drawn = drawn.slice(1);
  } else {
    const used = new Set(drawn.map((d) => d.slot));
    slot = 0;
    while (used.has(slot)) slot++;
  }
  return settle({ ...state, drawn: [...drawn, { ...next, slot, fresh }], waiting });
}

/** With nothing left to drop, a drawn nugget that is no longer among the newest leaves. */
function settle(state: PileState): PileState {
  if (state.waiting.length > 0) return state;
  const drawn = state.drawn.filter((d) => state.newest.has(d.id));
  return drawn.length === state.drawn.length ? state : { ...state, drawn };
}
