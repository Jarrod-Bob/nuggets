import React from 'react';
import { Wordmark } from '../brand/Wordmark';

/**
 * The app's only piece of chrome: 60px header with the wordmark, the search
 * box, and the actions on the right (draw a nugget, trash toggle, new nugget).
 * There is no sidebar and no tab bar — the MVP is one screen plus two dialogs.
 */
export interface TopBarProps {
  /** Usually the `SearchField`. */
  center?: React.ReactNode;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}

export function TopBar({ center, right, style }: TopBarProps) {
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
