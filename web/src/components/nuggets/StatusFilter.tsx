import React from 'react';
import { STATUSES, type Status } from '../../api';
import { statusLabel } from '../../lib/status';

/**
 * Narrows the list to one status. Single-select, combining with the query and
 * tag filters by AND, following the same All-plus-chips shape as TagFilter.
 * `null` means All.
 */
export interface StatusFilterProps {
  value?: Status | null;
  onChange?: (status: Status | null) => void;
  style?: React.CSSProperties;
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    height: 26,
    padding: '0 12px',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    background: active ? 'var(--nug-ink-900)' : 'transparent',
    border: `var(--border-hairline) solid ${active ? 'var(--nug-ink-900)' : 'var(--nug-ink-200)'}`,
    color: active ? 'var(--nug-cream-50)' : 'var(--nug-ink-500)',
    font: 'inherit',
    fontSize: 'var(--text-body-sm)',
    fontWeight: 'var(--weight-semibold)',
    transition: 'all var(--dur-fast) var(--ease-out)',
  };
}

export function StatusFilter({ value = null, onChange, style }: StatusFilterProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, ...style }}>
      <button type="button" onClick={() => onChange?.(null)} style={chipStyle(value === null)}>
        All
      </button>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(value === s ? null : s)}
          style={chipStyle(value === s)}
        >
          {statusLabel(s)}
        </button>
      ))}
    </div>
  );
}
