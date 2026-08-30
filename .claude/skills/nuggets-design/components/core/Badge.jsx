import React from 'react';

const nugBadgeTones = {
  neutral: { bg: 'var(--nug-cream-200)', fg: 'var(--nug-ink-700)' },
  golden: { bg: 'var(--nug-golden-200)', fg: 'var(--nug-golden-700)' },
  ketchup: { bg: 'var(--nug-ketchup-100)', fg: 'var(--nug-ketchup-600)' },
  herb: { bg: '#DCEFE1', fg: '#2C6E42' },
  ink: { bg: 'var(--nug-ink-900)', fg: 'var(--nug-cream-50)' },
};

export function Badge({ tone = 'neutral', children, style }) {
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
