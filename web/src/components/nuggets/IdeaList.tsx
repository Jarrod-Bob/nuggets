import React from 'react';
import { IdeaCard } from './IdeaCard';
import { TagFilter } from './TagFilter';
import { SearchField } from '../forms/SearchField';
import { EmptyState } from '../feedback/EmptyState';

export interface IdeaListItem { id: number | string; title: string; notes?: string; tags?: string[]; date?: string }

/**
 * The app's main view: the search box and tag filter above a newest-first list
 * of ideas. `q` and `tag` combine with AND, and `q` is case-insensitive
 * (`LIKE '%q%'` over title and notes server-side). Archived ideas never appear
 * here — the trash is a separate place.
 */
export interface IdeaListProps {
  ideas?: IdeaListItem[];
  /** Tags for the filter row, from `GET /api/tags`. */
  tags?: Array<string | { name: string; count?: number }>;
  query?: string;
  activeTag?: string | null;
  onQueryChange?: (e: { target: { value: string } }) => void;
  onTagChange?: (tag: string | null) => void;
  onOpen?: (idea: IdeaListItem) => void;
  /** Per-row trailing controls, e.g. edit and archive. */
  rowActions?: (idea: IdeaListItem) => React.ReactNode;
  /** Button shown in the empty state. */
  emptyAction?: React.ReactNode;
  style?: React.CSSProperties;
  /** Whether to render this component's own search box. Default true; pass false when the caller already renders one (e.g. in a TopBar). */
  showSearch?: boolean;
}

export function IdeaList({ ideas = [], tags = [], query = '', activeTag = null, onQueryChange, onTagChange, onOpen, rowActions, emptyAction, style, showSearch = true }: IdeaListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      {showSearch && <SearchField value={query} onChange={onQueryChange} onClear={() => onQueryChange?.({ target: { value: '' } })} />}
      {tags.length > 0 && <TagFilter tags={tags} value={activeTag} onChange={onTagChange} />}
      {ideas.length === 0 ? (
        <EmptyState
          headline={query || activeTag ? 'No nuggets match' : 'Nothing in the bank yet'}
          body={query || activeTag ? 'Try a different word, or clear the tag filter.' : 'Drop your first nugget in. Half-formed is fine.'}
          action={emptyAction} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {ideas.map(i => (
            <IdeaCard key={i.id} title={i.title} notes={i.notes} tags={i.tags} date={i.date}
              onClick={onOpen ? () => onOpen(i) : undefined}
              actions={rowActions ? rowActions(i) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
