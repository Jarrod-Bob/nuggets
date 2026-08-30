import React from 'react';
import { Wordmark } from '../brand/Wordmark.jsx';

export function TopBar({ center, right, style }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 20, height: 'var(--topbar-h)',
      padding: '0 var(--gutter-web)', background: 'var(--nug-cream-50)',
      borderBottom: 'var(--border-hairline) solid var(--nug-ink-200)', ...style,
    }}>
      <Wordmark size={22} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>{center}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
    </header>
  );
}
