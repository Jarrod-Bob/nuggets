import React from 'react';
import { Tag } from '../core/Tag.jsx';

export function TagFilter({ tags = [], value = null, onChange, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, ...style }}>
      <button type="button" onClick={() => onChange && onChange(null)}
        style={{
          height: 26, padding: '0 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
          background: value === null ? 'var(--nug-ink-900)' : 'transparent',
          border: `var(--border-hairline) solid ${value === null ? 'var(--nug-ink-900)' : 'var(--nug-ink-200)'}`,
          color: value === null ? 'var(--nug-cream-50)' : 'var(--nug-ink-500)',
          font: 'inherit', fontSize: 'var(--text-body-sm)', fontWeight: 'var(--weight-semibold)',
          transition: 'all var(--dur-fast) var(--ease-out)',
        }}>All</button>
      {tags.map(t => {
        const name = typeof t === 'string' ? t : t.name;
        const count = typeof t === 'string' ? undefined : t.count;
        return <Tag key={name} name={name} count={count} active={value === name} onClick={() => onChange && onChange(value === name ? null : name)} />;
      })}
    </div>
  );
}
