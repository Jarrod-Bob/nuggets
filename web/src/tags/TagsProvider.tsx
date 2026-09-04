import React from 'react';
import { api, ApiError, type Tag } from '../api';

/**
 * The tag vocabulary (`GET /api/tags`) is the autocomplete + filter source, and
 * both routes need it — the bank for its filter row and create dialog, the
 * nugget page for its edit form. It lives in one shared provider so a write on
 * either route can refresh the list once and both see it.
 */
interface TagsContextValue {
  tags: Tag[];
  /** Re-fetch after any write that can add or drop a tag. */
  refresh: () => void;
}

const TagsContext = React.createContext<TagsContextValue | null>(null);

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = React.useState<Tag[]>([]);

  const refresh = React.useCallback(() => {
    // Autocomplete degrades quietly if this fails — a missing vocabulary is not
    // worth an error banner over the whole app, and any write path surfaces its
    // own failure inline. So a fetch error just leaves the last-known tags.
    api.tags().then(setTags).catch((err) => {
      if (!(err instanceof ApiError)) throw err;
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const value = React.useMemo(() => ({ tags, refresh }), [tags, refresh]);
  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

export function useTags(): TagsContextValue {
  const ctx = React.useContext(TagsContext);
  if (!ctx) throw new Error('useTags must be used within a TagsProvider');
  return ctx;
}
