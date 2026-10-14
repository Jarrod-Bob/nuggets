import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api, describeError, type Idea } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';
import { STATUSES, type Status } from '../lib/status';

/** How many nuggets the pile shows. */
export const PILE_SIZE = 30;

/** A nugget in the pile: drawn unnamed, its title shown only on hover. */
export interface PileNugget {
  id: number;
  title: string;
  status: Status;
}

/**
 * The bucket (issue #57), a live counter: how many nuggets exist (the bin
 * included, purged ones are gone), how they split by status, and the newest
 * 30 as a pile. It's computed from the regular lists, `GET /api/ideas` plus
 * the bin's, and refetched on every `ideas-changed` event. `ready` stays
 * false until the first answer, so a view can draw the pile that's already
 * there without pouring it in. If that first answer fails, `loadError` says
 * why and `retry` asks again.
 */
export interface Bucket {
  ready: boolean;
  /** Every nugget that still exists, bin included. */
  count: number;
  /** Per status among the nuggets in the bank (not the bin). */
  byStatus: Record<Status, number>;
  binned: number;
  /** The newest nuggets, up to PILE_SIZE, oldest first, so the newest is last. */
  pile: PileNugget[];
  /** Every id that still exists, so a view can tell a nugget that left the newest 30 from one that was purged. */
  existing: ReadonlySet<number>;
  /** Why the first fetch failed, until one succeeds. Later failures keep the last count. */
  loadError: string | undefined;
  retry: () => void;
  backToBank: () => void;
}

const emptyByStatus = (): Record<Status, number> => Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;

const byAge = (a: Idea, b: Idea) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id);

export function useBucket(): Bucket {
  const navigate = useNavigate();
  const [lists, setLists] = React.useState<{ bank: Idea[]; bin: Idea[] } | null>(null);
  const [loadError, setLoadError] = React.useState<string | undefined>(undefined);

  const refresh = React.useCallback(() => {
    Promise.all([api.list({}), api.list({ archived: true })])
      .then(([bank, bin]) => {
        setLists({ bank, bin });
        setLoadError(undefined);
      })
      // A failed refetch leaves the last count showing; the next event retries.
      // Only a bucket that never loaded has nothing to show but the error.
      .catch((err) => setLoadError(describeError(err)));
  }, []);
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  useLiveRefresh('ideas-changed', refresh);

  const backToBank = React.useCallback(() => navigate('/'), [navigate]);

  const byStatus = emptyByStatus();
  for (const idea of lists?.bank ?? []) byStatus[idea.status] += 1;
  const everything = [...(lists?.bank ?? []), ...(lists?.bin ?? [])];
  const pile = everything
    .sort(byAge)
    .slice(-PILE_SIZE)
    .map(({ id, title, status }) => ({ id, title, status }));

  return {
    ready: lists !== null,
    count: everything.length,
    byStatus,
    binned: lists?.bin.length ?? 0,
    pile,
    existing: new Set(everything.map((n) => n.id)),
    loadError: lists === null ? loadError : undefined,
    retry: refresh,
    backToBank,
  };
}
