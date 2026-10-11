import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, describeError, type Idea, type Status, type Tag } from '../api';
import { formatRelative } from '../lib/formatRelative';
import { filterFromParams } from '../routing/listFilter';
import { nuggetPath } from '../routing/nuggetPath';
import { useTags } from '../tags/TagsProvider';
import { useLiveRefresh } from '../live/LiveUpdates';
import type { IdeaDraft } from './useIdeaDraft';
import type { RandomIdea } from './useRandomDraw';

/** A nugget as the bank lists it. */
export interface ListedNugget {
  id: number;
  title: string;
  projectName: string;
  notes: string;
  tags: string[];
  status: Status;
  linkCount: number;
  /** When it was captured, relative to now. */
  date: string;
}

/**
 * The bank, shared by every look (ADR 0002): the active nuggets under the
 * URL's search, tag and status filters, the one-ahead random draw, and the
 * create and edit dialogs that keep capture and quick edits over the list.
 */
export interface Bank {
  nuggets: ListedNugget[];
  tags: Tag[];
  /** The search box's text, ahead of the URL while typing. */
  query: string;
  setQuery: (value: string) => void;
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  activeStatus: Status | null;
  setActiveStatus: (status: Status | null) => void;
  /** Hands out the prefetched draw for Draw a nugget, and fetches the next. */
  draw: (tag: string | null) => RandomIdea | null;
  /** Whether the next draw is still being fetched. */
  drawLoading: boolean;
  actionError: string | undefined;
  dismissActionError: () => void;
  creating: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  submitCreate: (draft: IdeaDraft) => void;
  /** The nugget being edited, as it was when the dialog opened. */
  editing: Idea | null;
  openEdit: (id: number) => void;
  closeEdit: () => void;
  submitEdit: (draft: IdeaDraft) => void;
  /** The server's complaint about the open dialog's last save. */
  formError: string | undefined;
  archive: (id: number) => void;
  openNugget: (id: number) => void;
  openTrash: () => void;
}

// How long to wait after the last keystroke before writing the search text to the
// URL. Short enough to feel immediate, long enough that a fast typist does not
// push a history entry per character.
const SEARCH_DEBOUNCE_MS = 250;

export function useBank(): Bank {
  const navigate = useNavigate();
  const { tags, refresh: refreshTags } = useTags();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the source of truth for the filter; q, tag and status all come
  // from it.
  const filter = filterFromParams(searchParams);
  const activeTag = filter.tag ?? null;
  const activeStatus = filter.status ?? null;
  const urlQuery = filter.q ?? '';

  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);

  // The search input keeps its own local state so typing stays responsive, then
  // writes to the URL on a debounce. When the URL's q changes from anything other
  // than typing here (back/forward, a tag link that clears the search), the input
  // resyncs — once the debounce has settled urlQuery already equals query, so
  // this is a no-op mid-type and only bites on real external changes.
  const [query, setQuery] = React.useState(urlQuery);
  React.useEffect(() => {
    // Adopt the URL's q only when it genuinely differs from what's typed (a
    // back/forward, or a tag link that clears the search) — the URL is the
    // system of record. Guarding on the trimmed value means our own debounced
    // write (which trims) never yanks a trailing space back out mid-type.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((prev) => (prev.trim() === urlQuery ? prev : urlQuery));
  }, [urlQuery]);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // replace, not push, so the back button does not walk keystroke by keystroke.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const trimmed = value.trim();
          if (trimmed) next.set('q', trimmed);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
  };
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const setActiveTag = (tag: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tag) next.set('tag', tag);
      else next.delete('tag');
      return next;
    });
  };

  const setActiveStatus = (status: Status | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status) next.set('status', status);
      else next.delete('status');
      return next;
    });
  };

  const refreshList = React.useCallback(() => {
    api
      .list({ q: filter.q, tag: filter.tag ?? null, status: filter.status ?? null, archived: false })
      .then(setIdeas)
      .catch((err) => setActionError(describeError(err)));
    // filter is derived from searchParams; keying on its fields keeps the list
    // in step with the URL.
  }, [filter.q, filter.tag, filter.status]);
  React.useEffect(() => {
    refreshList();
  }, [refreshList]);

  // RandomNugget's onDraw is synchronous, but api.random is async, so we keep a
  // one-ahead prefetched draw: the button always returns whatever was fetched
  // last, then immediately kicks off the next fetch (used on open and reroll).
  // `nextRandom` is `undefined` while a fetch for the current tag is pending;
  // RandomNugget's `loading` prop reflects that, and its own trigger/reroll
  // buttons are disabled while loading, so a click can never surface a false
  // "nothing to draw" for a fetch that just hasn't resolved yet. A monotonic
  // request id guards against a stale response from a superseded tag landing
  // after a newer request has already started. Each fetch excludes the nugget
  // last handed out, so a reroll doesn't repeat it unless it's the only one.
  const [nextRandom, setNextRandom] = React.useState<Idea | null | undefined>(undefined);
  const randomReqIdRef = React.useRef(0);
  const shownRandomIdRef = React.useRef<number | null>(null);
  const fetchNextRandom = React.useCallback((tag: string | null) => {
    const reqId = ++randomReqIdRef.current;
    setNextRandom(undefined);
    api
      .random(tag, shownRandomIdRef.current)
      .then((result) => {
        if (randomReqIdRef.current === reqId) setNextRandom(result);
      })
      .catch(() => {
        if (randomReqIdRef.current === reqId) setNextRandom(null);
      });
  }, []);
  React.useEffect(() => {
    // Prefetching the next random draw is inherently a side effect (an async
    // fetch keyed off the active tag), not state derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNextRandom(activeTag);
  }, [activeTag, fetchNextRandom]);
  // Nuggets imported in the background show up without a reload, under the
  // same URL filters. Neither dialog reads from `ideas` while open (the edit
  // dialog holds a snapshot), so refetching the list behind them never resets
  // what's being typed.
  useLiveRefresh('ideas-changed', () => {
    refreshList();
    fetchNextRandom(activeTag);
  });

  const randomLoading = nextRandom === undefined;
  const handleDraw = (tag: string | null): RandomIdea | null => {
    const result = nextRandom ?? null;
    shownRandomIdRef.current = result?.id ?? null;
    fetchNextRandom(tag);
    return result;
  };

  // The create and edit dialogs live here — capture and quick edits stay in a
  // dialog over the bank, so saving never leaves the list. The nugget's own page
  // has its own edit dialog for edits made there.
  const [creating, setCreating] = React.useState(false);
  // A snapshot taken when the dialog opens, not a lookup in `ideas`: the form
  // resets whenever its idea changes, so a list refetch behind it must not hand
  // it a fresh object mid-edit.
  const [editing, setEditing] = React.useState<Idea | null>(null);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);
  const openCreate = () => {
    setFormError(undefined);
    setCreating(true);
  };
  const closeCreate = () => {
    setCreating(false);
    setFormError(undefined);
  };
  const openEdit = (id: number) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    setFormError(undefined);
    setEditing(idea);
  };
  const closeEdit = () => {
    setEditing(null);
    setFormError(undefined);
  };
  // The save may resolve after the dialog was cancelled and another nugget
  // opened; only touch the dialog if it is still the one that sent the save.
  const editingRef = React.useRef<Idea | null>(null);
  React.useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  const submitEdit = (draft: IdeaDraft) => {
    const target = editing;
    if (!target) return;
    api
      .update(target.id, draft)
      .then(() => {
        if (editingRef.current === target) closeEdit();
        setActionError(undefined);
        refreshList();
        refreshTags();
        fetchNextRandom(activeTag);
      })
      .catch((err) => {
        if (editingRef.current === target) setFormError(describeError(err));
      });
  };

  const submitCreate = (draft: IdeaDraft) => {
    api
      .create(draft)
      .then(() => {
        closeCreate();
        setActionError(undefined);
        refreshList();
        refreshTags();
        fetchNextRandom(activeTag);
      })
      .catch((err) => setFormError(describeError(err)));
  };

  const archiveIdea = (id: number) => {
    api
      .archive(id)
      .then(() => {
        setActionError(undefined);
        refreshList();
        refreshTags();
        fetchNextRandom(activeTag);
      })
      .catch((err) => setActionError(describeError(err)));
  };

  const nuggets: ListedNugget[] = ideas.map((i) => ({
    id: i.id,
    title: i.title,
    projectName: i.project_name,
    notes: i.notes,
    tags: i.tags,
    status: i.status,
    linkCount: i.links.length,
    date: formatRelative(i.created_at),
  }));

  return {
    nuggets,
    tags,
    query,
    setQuery: onQueryChange,
    activeTag,
    setActiveTag,
    activeStatus,
    setActiveStatus,
    draw: handleDraw,
    drawLoading: randomLoading,
    actionError,
    dismissActionError: () => setActionError(undefined),
    creating,
    openCreate,
    closeCreate,
    submitCreate,
    editing,
    openEdit,
    closeEdit,
    submitEdit,
    formError,
    archive: archiveIdea,
    openNugget: (id) => navigate(nuggetPath(id)),
    openTrash: () => navigate('/trash'),
  };
}
