import React from 'react';

const nugIconBtnSizes = { sm: 30, md: 38, lg: 46 };

export function IconButton({ size = 'md', variant = 'ghost', label, disabled = false, onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  const d = nugIconBtnSizes[size] || nugIconBtnSizes.md;
  const filled = variant === 'filled';
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: d, height: d, padding: 0, borderRadius: 'var(--radius-pill)',
        border: variant === 'outline' ? 'var(--border-regular) solid var(--nug-ink-900)' : 'none',
        background: filled ? (hover ? 'var(--nug-golden-500)' : 'var(--nug-golden-400)') : (hover ? 'var(--nug-cream-200)' : 'transparent'),
        color: filled ? 'var(--nug-ink-900)' : 'var(--nug-ink-700)',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }}>
      {children}
    </button>
  );
}
