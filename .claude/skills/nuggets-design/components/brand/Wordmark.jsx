import React from 'react';

export function Wordmark({ size = 24, tone = 'ink', withMark = true, iconOnly = false, style }) {
  const colors = { ink: 'var(--nug-ink-900)', cream: 'var(--nug-cream-50)', golden: 'var(--nug-golden-500)' };
  if (iconOnly) {
    return <img src={`${(typeof window !== 'undefined' && window.NUG_ASSET_BASE) || 'assets/'}nugget.svg`} alt="Nuggets" style={{ width: size, height: size * 0.83, display: 'block', ...style }} />;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }}>
      {withMark && <img src={`${(typeof window !== 'undefined' && window.NUG_ASSET_BASE) || 'assets/'}nugget.svg`} alt="" aria-hidden="true" style={{ width: size * 1.15, height: size * 0.96, display: 'block' }} />}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-black)', fontSize: size, letterSpacing: '-0.03em', lineHeight: 1, color: colors[tone] || colors.ink }}>nuggets</span>
    </span>
  );
}
