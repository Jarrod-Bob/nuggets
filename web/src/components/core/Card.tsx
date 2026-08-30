import React from 'react';

/** Generic surface container. `NuggetCard` is the specialised idea version. */
export interface CardProps {
  tone?: 'plain' | 'cream' | 'sunken' | 'ink';
  padding?: number | string;
  /** Adds the hover lift and pointer cursor. */
  interactive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

interface ToneSpec { bg: string; border: string }

export function Card({ tone = 'plain', padding = 20, interactive = false, onClick, children, style }: CardProps) {
  const [hover, setHover] = React.useState(false);
  const tones: Record<NonNullable<CardProps['tone']>, ToneSpec> = {
    plain: { bg: 'var(--surface-card)', border: 'var(--nug-ink-200)' },
    cream: { bg: 'var(--nug-cream-50)', border: 'var(--nug-ink-200)' },
    sunken: { bg: 'var(--nug-cream-200)', border: 'transparent' },
    ink: { bg: 'var(--nug-ink-900)', border: 'transparent' },
  };
  const t = tones[tone] || tones.plain;
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: t.bg, color: tone === 'ink' ? 'var(--nug-cream-50)' : 'var(--text-body)',
        border: `var(--border-regular) solid ${t.border}`, borderRadius: 'var(--radius-lg)',
        padding, boxShadow: interactive && hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'transform var(--dur-base) var(--ease-bounce), box-shadow var(--dur-base) var(--ease-out)',
        ...style,
      }}>{children}</div>
  );
}
