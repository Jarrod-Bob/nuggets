import React from 'react';

export function SearchField({ placeholder = 'Search your nuggets…', value, onChange, onClear, style }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 8px 0 14px',
      background: focus ? 'var(--nug-white)' : 'var(--nug-cream-200)',
      border: `var(--border-regular) solid ${focus ? 'var(--nug-golden-500)' : 'transparent'}`,
      borderRadius: 'var(--radius-pill)', boxShadow: focus ? 'var(--focus-shadow)' : 'none',
      transition: 'all var(--dur-fast) var(--ease-out)', ...style,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--nug-ink-500)" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={value} placeholder={placeholder} onChange={onChange}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 'var(--text-body-md)', color: 'var(--text-body)' }} />
      {value && onClear && (
        <button type="button" onClick={onClear} aria-label="Clear search"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--nug-ink-500)', fontSize: 16, lineHeight: 1, padding: '4px 8px' }}>×</button>
      )}
    </div>
  );
}
