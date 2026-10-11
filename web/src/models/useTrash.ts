import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api, describeError, type Idea } from '../api';
import { formatRelative } from '../lib/formatRelative';
import { useTags } from '../tags/TagsProvider';
import { useLiveRefresh } from '../live/LiveUpdates';

/** A binned nugget as the trash lists it. */
export interface BinnedNugget {
  id: number;
  title: string;
  notes: string;
  tags: string[];
  /** When it was binned, relative to now. */
  archivedAt: string | undefined;
}

/**
 * The trash, shared by every look (ADR 0002): the archived nuggets, newest
 * binned first, each restorable (`POST /api/ideas/{id}/restore`), or purged
 * for good (`DELETE /api/ideas/{id}`) after a confirmation.
 * A nugget a spices tombstone archives in the background lands here too.
 */
export interface Trash {
  nuggets: BinnedNugget[];
  actionError: string | undefined;
  dismissActionError: () => void;
  restore: (id: number) => void;
  /** The nugget whose purge is waiting for a confirmation, if any. */
  purgeTarget: Idea | null;
  askPurge: (id: number) => void;
  cancelPurge: () => void;
  confirmPurge: () => void;
  backToBank: () => void;
}

export function useTrash(): Trash {
  const navigate = useNavigate();
  const { refresh: refreshTags } = useTags();
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);
  const [purgeTarget, setPurgeTarget] = React.useState<Idea | null>(null);

  const refreshList = React.useCallback(() => {
    api
      .list({ archived: true })
      .then(setIdeas)
      .catch((err) => setActionError(describeError(err)));
  }, []);
  React.useEffect(() => {
    refreshList();
  }, [refreshList]);
  // A spices tombstone archives a nugget in the background: it lands here.
  useLiveRefresh('ideas-changed', refreshList);

  const restore = (id: number) => {
    api
      .restore(id)
      .then(() => {
        setActionError(undefined);
        refreshList();
        refreshTags();
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const confirmPurge = () => {
    if (!purgeTarget) return;
    api
      .purge(purgeTarget.id)
      .then(() => {
        setPurgeTarget(null);
        setActionError(undefined);
        refreshList();
        refreshTags();
      })
      .catch((err) => setActionError(describeError(err)));
  };

  return {
    nuggets: ideas.map((i) => ({
      id: i.id,
      title: i.title,
      notes: i.notes,
      tags: i.tags,
      archivedAt: i.archived_at ? formatRelative(i.archived_at) : undefined,
    })),
    actionError,
    dismissActionError: () => setActionError(undefined),
    restore,
    purgeTarget,
    askPurge: (id) => {
      const target = ideas.find((i) => i.id === id);
      if (target) setPurgeTarget(target);
    },
    cancelPurge: () => setPurgeTarget(null),
    confirmPurge,
    backToBank: () => navigate('/'),
  };
}
