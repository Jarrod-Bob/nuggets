import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, describeError, type FeatureRequest, type Idea, type Tag, type TagSuggestion } from '../api';
import { appendToNotes } from '../lib/planPrompt';
import { parseNuggetId } from '../routing/nuggetPath';
import { paramsFromFilter } from '../routing/listFilter';
import { useTags } from '../tags/TagsProvider';
import { useLiveRefresh } from '../live/LiveUpdates';
import type { IdeaDraft } from './useIdeaDraft';

/** Where the page is with loading its nugget. */
export type NuggetLoad = { status: 'loading' } | { status: 'notfound'; message: string } | { status: 'ready'; idea: Idea };

/**
 * One nugget's page, shared by every look (ADR 0002): the nugget, its feature
 * requests and tag suggestions, the edit dialog (which holds back live
 * refreshes while it has unsaved edits), Plan with Claude, and archive,
 * restore and purge.
 */
export interface NuggetPageModel {
  load: NuggetLoad;
  /** The nugget once it has loaded. */
  idea: Idea | null;
  /** Whether it's in the trash. */
  archived: boolean;
  tags: Tag[];
  /** The bank filtered to one tag: where each of the nugget's tags links. */
  tagHref: (tag: string) => string;
  actionError: string | undefined;
  dismissActionError: () => void;

  requests: FeatureRequest[];
  /** The feature request being retried, if any. */
  retrying: number | null;
  retryRequest: (requestId: number) => void;

  suggestions: TagSuggestion[];
  /** Whether to show the suggestions: hidden while editing (the form owns the tags) and in the trash. */
  showSuggestions: boolean;
  /** The suggestion whose add or dismiss is in flight, if any. */
  suggestionBusy: string | null;
  addSuggestedTag: (tag: string) => Promise<void>;
  dismissSuggestedTag: (tag: string) => void;

  editing: boolean;
  startEditing: () => void;
  stopEditing: () => void;
  submitEdit: (draft: IdeaDraft) => void;
  formError: string | undefined;
  /** The edit form says whether it holds unsaved edits. */
  setFormDirty: (dirty: boolean) => void;
  /** Background imports changed things while the form held unsaved edits; the page catches up once it closes. */
  changedWhileEditing: boolean;

  planning: boolean;
  openPlan: () => void;
  closePlan: () => void;
  /** Appends Claude's answer to the notes as they are on the server now. */
  savePlan: (answer: string) => Promise<void>;

  archive: () => void;
  restore: () => void;
  /** Whether the purge confirmation is showing. */
  purging: boolean;
  askPurge: () => void;
  cancelPurge: () => void;
  confirmPurge: () => void;
  backToBank: () => void;
}

/** The URL that filters the bank to one tag — where each tag on the page links. */
const tagFilterHref = (tag: string): string => `/?${paramsFromFilter({ tag }).toString()}`;

export function useNuggetPage(): NuggetPageModel {
  const navigate = useNavigate();
  const { tags, refresh: refreshTags } = useTags();
  const { id: idParam } = useParams();
  // A non-numeric :id never reaches the API — it resolves to the not-found page.
  const id = parseNuggetId(idParam);

  const [load, setLoad] = React.useState<NuggetLoad>(() =>
    id === null ? { status: 'notfound', message: "That nugget isn't in the bank." } : { status: 'loading' },
  );
  const [actionError, setActionError] = React.useState<string | undefined>(undefined);

  const reload = React.useCallback(() => {
    if (id === null) return;
    let live = true;
    api
      .get(id)
      .then((idea) => {
        if (live) setLoad({ status: 'ready', idea });
      })
      .catch((err) => {
        if (!live) return;
        const gone = err instanceof ApiError && err.status === 404;
        setLoad((prev) =>
          !gone && prev.status === 'ready' && prev.idea.id === id ? prev : { status: 'notfound', message: describeError(err) },
        );
      });
    return () => {
      live = false;
    };
  }, [id]);
  React.useEffect(() => reload(), [reload]);

  // The nugget's GitHub feature requests, fetched alongside it. A failed fetch
  // keeps whatever was showing: this line is secondary to the nugget itself.
  const [requests, setRequests] = React.useState<FeatureRequest[]>([]);
  const [retrying, setRetrying] = React.useState<number | null>(null);
  const reloadRequests = React.useCallback(() => {
    if (id === null) return;
    let live = true;
    api.github
      .issues(id)
      .then((list) => {
        if (live && Array.isArray(list)) setRequests(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  React.useEffect(() => reloadRequests(), [reloadRequests]);
  // The sender says when a request was created, failed or is waiting to retry.
  useLiveRefresh('github-changed', () => {
    reloadRequests();
  });

  // The nugget's tag suggestions, fetched alongside it. Like feature requests,
  // a failed fetch keeps whatever was showing.
  const [suggestions, setSuggestions] = React.useState<TagSuggestion[]>([]);
  const [suggestionBusy, setSuggestionBusy] = React.useState<string | null>(null);
  const reloadSuggestions = React.useCallback(() => {
    if (id === null) return;
    let live = true;
    api.tagSuggestions
      .list(id)
      .then((list) => {
        if (live && Array.isArray(list)) setSuggestions(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  React.useEffect(() => reloadSuggestions(), [reloadSuggestions]);
  // A finished tag check says so; the event names no nugget, so every open
  // nugget page refetches its own (one small GET).
  useLiveRefresh('tag-suggestions-changed', () => {
    reloadSuggestions();
  });

  const [editing, setEditing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);
  const [formDirty, setFormDirty] = React.useState(false);

  // A background import may have refreshed this nugget. Reloading it resets the
  // edit form to the new version, so while the form holds unsaved edits the
  // reload waits until it closes, and the form says why.
  const { pending: changedWhileEditing } = useLiveRefresh(
    'ideas-changed',
    () => {
      reload();
      // A spices import that tagged this nugget may have queued a request.
      reloadRequests();
      // ...and a refresh that changed its tags may have cleared a suggestion.
      reloadSuggestions();
    },
    { hold: editing && formDirty },
  );

  const [purging, setPurging] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);

  const idea = load.status === 'ready' ? load.idea : null;

  const submitEdit = (draft: IdeaDraft) => {
    if (!idea) return;
    api
      .update(idea.id, draft)
      .then(() => {
        setEditing(false);
        setFormError(undefined);
        setActionError(undefined);
        refreshTags();
        reload();
        // Adding a mapped tag queues a feature request.
        reloadRequests();
        // Adding a suggested tag by hand clears its suggestion.
        reloadSuggestions();
      })
      .catch((err) => setFormError(describeError(err)));
  };

  // Accepting a suggestion is an ordinary tag save, with everything a tag save
  // does (a mapped tag still queues a feature request). It adds to the tags as
  // they are on the server right now, so a tag added elsewhere isn't lost.
  const addSuggestedTag = async (tag: string) => {
    if (!idea) return;
    setSuggestionBusy(tag);
    try {
      const fresh = await api.get(idea.id);
      await api.update(idea.id, { tags: fresh.tags.includes(tag) ? fresh.tags : [...fresh.tags, tag] });
      setActionError(undefined);
      refreshTags();
      reload();
      reloadRequests();
      reloadSuggestions();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSuggestionBusy(null);
    }
  };

  const dismissSuggestedTag = (tag: string) => {
    if (!idea) return;
    setSuggestionBusy(tag);
    api.tagSuggestions
      .dismiss(idea.id, tag)
      .then(() => {
        setActionError(undefined);
        setSuggestions((prev) => prev.filter((s) => s.tag !== tag));
      })
      .catch((err) => setActionError(describeError(err)))
      .finally(() => setSuggestionBusy(null));
  };

  // Appends to the notes as they are on the server right now, not as this page
  // last saw them, so an edit made since the page loaded isn't overwritten.
  const savePlan = async (answer: string) => {
    if (!idea) return;
    try {
      const current = await api.get(idea.id);
      await api.update(idea.id, { notes: appendToNotes(current.notes, answer) });
    } catch (err) {
      throw new Error(describeError(err), { cause: err });
    }
    setActionError(undefined);
    reload();
  };

  const retryRequest = (requestId: number) => {
    setRetrying(requestId);
    api.github
      .retry(requestId)
      .then(() => {
        setActionError(undefined);
        reloadRequests();
      })
      .catch((err) => setActionError(describeError(err)))
      .finally(() => setRetrying(null));
  };

  const archiveIdea = () => {
    if (!idea) return;
    api
      .archive(idea.id)
      .then(() => {
        refreshTags();
        // Archived from its own page — nothing left to look at, back to the bank.
        navigate('/');
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const restoreIdea = () => {
    if (!idea) return;
    api
      .restore(idea.id)
      .then(() => {
        setActionError(undefined);
        refreshTags();
        reload();
      })
      .catch((err) => setActionError(describeError(err)));
  };
  const confirmPurge = () => {
    if (!idea) return;
    api
      .purge(idea.id)
      .then(() => {
        setPurging(false);
        refreshTags();
        navigate('/');
      })
      .catch((err) => setActionError(describeError(err)));
  };

  const archived = !!idea?.archived_at;
  // Suggestions sit at the end of the tag row, hidden while editing (the form
  // owns the tags then) and in the trash.
  const showSuggestions = suggestions.length > 0 && !editing && !archived;

  return {
    load,
    idea,
    archived,
    tags,
    tagHref: tagFilterHref,
    actionError,
    dismissActionError: () => setActionError(undefined),
    requests,
    retrying,
    retryRequest,
    suggestions,
    showSuggestions,
    suggestionBusy,
    addSuggestedTag,
    dismissSuggestedTag,
    editing,
    startEditing: () => setEditing(true),
    stopEditing: () => {
      setEditing(false);
      setFormError(undefined);
    },
    submitEdit,
    formError,
    setFormDirty,
    changedWhileEditing,
    planning,
    openPlan: () => setPlanning(true),
    closePlan: () => setPlanning(false),
    savePlan,
    archive: archiveIdea,
    restore: restoreIdea,
    purging,
    askPurge: () => setPurging(true),
    cancelPurge: () => setPurging(false),
    confirmPurge,
    backToBank: () => navigate('/'),
  };
}
