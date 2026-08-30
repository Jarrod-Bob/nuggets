import * as React from 'react';

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
}
export declare function IdeaList(props: IdeaListProps): JSX.Element;
