import React from 'react';
import { Button } from '../core/Button';
import { Tag } from '../core/Tag';
import type { TagSuggestion } from '../../api';

export interface TagSuggestionsProps {
  suggestions: TagSuggestion[];
  onAdd: (tag: string) => void;
  onDismiss: (tag: string) => void;
  /** The tag whose Add or Dismiss is in flight, if any. */
  busy?: string | null;
}

const label: React.CSSProperties = {
  fontSize: 'var(--text-micro)',
  fontWeight: 'var(--weight-bold)',
  letterSpacing: 'var(--tracking-label)',
  textTransform: 'uppercase',
  color: 'var(--nug-ink-500)',
};

/**
 * A nugget's tag suggestions (Jev tag-suggestions design §7): tags already in
 * use that the nugget seems to be missing, each with Add and Dismiss. Never
 * applied on its own. The probability isn't shown. Renders nothing for a
 * nugget with none.
 */
export function TagSuggestions({ suggestions, onAdd, onDismiss, busy = null }: TagSuggestionsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span id="tag-suggestions-label" style={label}>
        Suggested tags
      </span>
      <ul
        aria-labelledby="tag-suggestions-label"
        style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 10 }}
      >
        {suggestions.map(({ tag }) => (
          <li key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Tag name={tag} style={{ borderStyle: 'dashed' }} />
            <Button variant="secondary" size="sm" onClick={() => onAdd(tag)} disabled={busy === tag} aria-label={`Add the tag ${tag}`}>
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDismiss(tag)} disabled={busy === tag} aria-label={`Dismiss the tag ${tag}`}>
              Dismiss
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
