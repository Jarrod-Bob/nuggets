import * as React from 'react';

export interface TagFilterItem { name: string; count?: number }

/**
 * Narrows the list to one tag. Single-select: `q` and `tag` combine with AND,
 * but only one tag applies at a time. `null` means All.
 * Sources from `GET /api/tags`, which returns only tags with at least one
 * non-archived idea.
 */
export interface TagFilterProps {
  tags?: Array<string | TagFilterItem>;
  /** Active tag name, or `null` for All. */
  value?: string | null;
  onChange?: (tag: string | null) => void;
  style?: React.CSSProperties;
}
export declare function TagFilter(props: TagFilterProps): JSX.Element;
