import React from 'react';

const nugBtnSizes = {
  sm: { padding: '0 14px', height: 34, fontSize: 'var(--text-body-sm)', gap: 6 },
  md: { padding: '0 20px', height: 42, fontSize: 'var(--text-body-md)', gap: 8 },
  lg: { padding: '0 28px', height: 52, fontSize: 'var(--text-body-lg)', gap: 10 },
};

const nugBtnVariants = {
  primary: { bg: 'var(--nug-golden-400)', bgHover: 'var(--nug-golden-500)', fg: 'var(--nug-ink-900)', border: 'transparent', edge: 'var(--nug-golden-600)' },
  danger:  { bg: 'var(--nug-ketchup-500)', bgHover: 'var(--nug-ketchup-600)', fg: 'var(--nug-cream-50)', border: 'transparent', edge: 'var(--nug-ketchup-600)' },
  secondary:{ bg: 'var(--nug-cream-50)', bgHover: 'var(--nug-cream-200)', fg: 'var(--nug-ink-900)', border: 'var(--nug-ink-900)', edge: 'var(--nug-ink-900)' },
  ghost:   { bg: 'transparent', bgHover: 'var(--nug-cream-200)', fg: 'var(--nug-ink-700)', border: 'transparent', edge: null },
};

export function Button({ variant = 'primary', size = 'md', fullWidth = false, disabled = false, iconLeft, iconRight, onClick, type = 'button', children, style }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = nugBtnSizes[size] || nugBtnSizes.md;
  const v = nugBtnVariants[variant] || nugBtnVariants.primary;
  const lift = v.edge && !disabled;
  return (
    <button
      type={type} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, height: s.height, padding: s.padding, width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', fontSize: s.fontSize,
        letterSpacing: '0.005em', color: v.fg, background: hover && !disabled ? v.bgHover : v.bg,
        border: `var(--border-regular) solid ${v.border}`, borderRadius: 'var(--radius-pill)',
        boxShadow: lift ? (press ? `0 1px 0 ${v.edge}` : `0 3px 0 ${v.edge}`) : 'none',
        transform: lift && press ? 'translateY(2px)' : 'translateY(0)',
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        whiteSpace: 'nowrap', ...style,
      }}>
      {iconLeft}{children}{iconRight}
    </button>
  );
}
