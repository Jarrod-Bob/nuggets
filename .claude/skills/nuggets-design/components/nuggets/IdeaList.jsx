import React from 'react';
import { IdeaCard } from './IdeaCard.jsx';
import { TagFilter } from './TagFilter.jsx';
import { SearchField } from '../forms/SearchField.jsx';
import { EmptyState } from '../feedback/EmptyState.jsx';

export function IdeaList({ ideas = [], tags = [], query = '', activeTag = null, onQueryChange, onTagChange, onOpen, rowActions, emptyAction, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      <SearchField value={query} onChange={onQueryChange} onClear={() => onQueryChange && onQueryChange({ target: { value: '' } })} />
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
