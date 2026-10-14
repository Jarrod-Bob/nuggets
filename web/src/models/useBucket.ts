import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api, describeError, type Idea } from '../api';
import { useLiveRefresh } from '../live/LiveUpdates';
import { STATUSES, type Status } from '../lib/status';

/** How many of the newest nuggets the bucket draws. */
export const PILE_SIZE = 30;

/** A nugget in the pile: drawn without its name, which shows on hover. */
export interface PileNugget {
  id: number;
  title: string;
  status: Status;
}

/**
 * The bucket (issue #57), a live counter for the Comic look: how many nuggets
 * still exist (the bin included; purged ones are gone), how they split, and
 * the newest few to draw as a pile. It is worked out here from the regular
 * lists, `GET /api/ideas` plus the bin's `?archived=true`, and refetched on
 * every `ideas-changed`. There is no count endpoint.
 */
export interface Bucket {
  /** `loading` until the first answer; `failed` if the first answer was an error (later failures keep the last count). */
  state: 'loading' | 'failed' | 'ready';
  /** Why the first load failed. */
  loadError: string | undefined;
  /** Every nugget that still exists, bin included. */
  count: number;
  /** The bank's nuggets per status (binned ones are counted in `binned` instead). */
  byStatus: Record<Status, number>;
  binned: number;
  /** The newest PILE_SIZE nuggets, oldest first. */
  pile: PileNugget[];
  /** The id of every nugget that still exists, so a view can tell a purged nugget from one that is merely no longer among the newest. */
  existing: ReadonlySet<number>;
  retry: () => void;
  goToBank: () => void;
}

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
      .catch((err) => setLoadError(describeError(err)));
  }, []);
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  useLiveRefresh('ideas-changed', refresh);

  const derived = React.useMemo(() => {
    const bank = lists?.bank ?? [];
    const bin = lists?.bin ?? [];
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const idea of bank) byStatus[idea.status] += 1;
    const all = [...bank, ...bin].sort(byAge);
    return {
      count: all.length,
      byStatus,
      binned: bin.length,
      pile: all.slice(-PILE_SIZE).map(({ id, title, status }) => ({ id, title, status })),
      existing: new Set(all.map((i) => i.id)),
    };
  }, [lists]);

  const goToBank = React.useCallback(() => navigate('/'), [navigate]);

  return {
    state: lists ? 'ready' : loadError ? 'failed' : 'loading',
    loadError: lists ? undefined : loadError,
    ...derived,
    retry: refresh,
    goToBank,
  };
}
