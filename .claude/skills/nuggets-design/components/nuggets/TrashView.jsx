import React from 'react';
import { IdeaCard } from './IdeaCard.jsx';
import { Button } from '../core/Button.jsx';
import { EmptyState } from '../feedback/EmptyState.jsx';

export function TrashView({ ideas = [], onRestore, onPurge, style }) {
  if (ideas.length === 0) {
    return <EmptyState variant="bucket" headline="Trash is empty" body="Archived nuggets land here. Nothing has been binned yet." style={style} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-500)' }}>
        Archived nuggets, newest binned first. Restoring puts one back in the bank; purging is permanent.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {ideas.map(i => (
          <IdeaCard key={i.id} archived title={i.title} notes={i.notes} tags={i.tags} date={i.archivedAt}
            actions={<>
              <Button size="sm" variant="secondary" onClick={() => onRestore && onRestore(i.id)}>Restore</Button>
              <Button size="sm" variant="danger" onClick={() => onPurge && onPurge(i.id)}>Purge</Button>
            </>} />
        ))}
      </div>
    </div>
  );
}
