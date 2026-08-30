import React from 'react';

/** Small uppercase status pill — counts, states, "new", plan names. */
export interface BadgeProps {
  tone?: 'neutral' | 'golden' | 'ketchup' | 'herb' | 'ink';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

interface ToneSpec { bg: string; fg: string }

const nugBadgeTones: Record<NonNullable<BadgeProps['tone']>, ToneSpec> = {
  neutral: { bg: 'var(--nug-cream-200)', fg: 'var(--nug-ink-700)' },
  golden: { bg: 'var(--nug-golden-200)', fg: 'var(--nug-golden-700)' },
  ketchup: { bg: 'var(--nug-ketchup-100)', fg: 'var(--nug-ketchup-600)' },
  herb: { bg: '#DCEFE1', fg: '#2C6E42' },
  ink: { bg: 'var(--nug-ink-900)', fg: 'var(--nug-cream-50)' },
};

export function Badge({ tone = 'neutral', children, style }: BadgeProps) {
  const t = nugBadgeTones[tone] || nugBadgeTones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
      background: t.bg, color: t.fg, borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-body)', fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', ...style,
    }}>{children}</span>
  );
}
