import React from 'react';

/**
 * The Nuggets wordmark: the name set in Baloo 2 ExtraBold, lowercase, tight
 * tracking, optionally preceded by the nugget motif. Stands in for a real logo
 * until brand files exist.
 */
export interface WordmarkProps {
  size?: number;
  tone?: 'ink' | 'cream' | 'golden';
  withMark?: boolean;
  /** Renders only the single-nugget icon, no wordmark text — for tight spaces (favicon, avatar). */
  iconOnly?: boolean;
  style?: React.CSSProperties;
}

export function Wordmark({ size = 24, tone = 'ink', withMark = true, iconOnly = false, style }: WordmarkProps) {
  const colors: Record<NonNullable<WordmarkProps['tone']>, string> = { ink: 'var(--nug-ink-900)', cream: 'var(--nug-cream-50)', golden: 'var(--nug-golden-500)' };
  if (iconOnly) {
    return <img src={`${(typeof window !== 'undefined' && (window as any).NUG_ASSET_BASE) || 'assets/'}nugget.svg`} alt="Nuggets" style={{ width: size, height: size * 0.83, display: 'block', ...style }} />;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }}>
      {withMark && <img src={`${(typeof window !== 'undefined' && (window as any).NUG_ASSET_BASE) || 'assets/'}nugget.svg`} alt="" aria-hidden="true" style={{ width: size * 1.15, height: size * 0.96, display: 'block' }} />}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-black)', fontSize: size, letterSpacing: '-0.03em', lineHeight: 1, color: colors[tone] || colors.ink }}>nuggets</span>
    </span>
  );
}
