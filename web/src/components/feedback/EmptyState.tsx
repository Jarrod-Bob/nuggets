import React from 'react';

/** Empty view: nugget illustration, warm headline, one action. */
export interface EmptyStateProps {
  headline: string;
  body?: string;
  action?: React.ReactNode;
  variant?: 'single' | 'trio' | 'bucket' | 'dip';
  style?: React.CSSProperties;
}

export function EmptyState({ headline, body, action, variant = 'single', style }: EmptyStateProps) {
  const src = { single: 'nugget.svg', trio: 'nugget-trio.svg', bucket: 'bucket.svg', dip: 'dip-cup.svg' }[variant] || 'nugget.svg';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 12, padding: '48px 24px', ...style,
    }}>
      <img src={`${(typeof window !== 'undefined' && (window as any).NUG_ASSET_BASE) || 'assets/'}${src}`} alt="" aria-hidden="true" style={{ width: variant === 'trio' ? 180 : 92, opacity: .9, marginBottom: 4 }} />
      <h3 style={{ fontSize: 'var(--text-title-2)', fontWeight: 'var(--weight-bold)' }}>{headline}</h3>
      {body && <p style={{ margin: 0, maxWidth: 340, fontSize: 'var(--text-body-md)', color: 'var(--nug-ink-500)', textWrap: 'pretty' }}>{body}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
