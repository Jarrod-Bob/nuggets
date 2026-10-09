import React from 'react';
import { IconButton } from '../core/IconButton';

/** Centred modal: 2px ink border, 28px radius, warm blurred scrim. */
export interface DialogProps {
  open?: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  /** Buttons, right-aligned. */
  footer?: React.ReactNode;
  width?: number;
  children?: React.ReactNode;
}

export function Dialog({ open = false, title, description, onClose, footer, width = 460, children }: DialogProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,28,18,.44)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: width, padding: 24,
        // Never taller than the window (less the scrim's padding): the body
        // scrolls instead, keeping the title and buttons in view.
        maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column',
        background: 'var(--surface-card)', border: 'var(--border-chunky) solid var(--nug-ink-900)',
        borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-3)',
        animation: 'none', transform: 'none',
      }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: description ? 6 : 16 }}>
          <h2 style={{ flex: 1, fontSize: 'var(--text-title-2)', fontWeight: 'var(--weight-bold)' }}>{title}</h2>
          {onClose && <IconButton label="Close" onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></IconButton>}
        </div>
        {description && <p style={{ flex: 'none', margin: '0 0 18px', fontSize: 'var(--text-body-md)', color: 'var(--nug-ink-700)', textWrap: 'pretty' }}>{description}</p>}
        {/* The padding and matching negative margin keep focus rings from being clipped by the scroll. */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 4, margin: -4 }}>{children}</div>
        {footer && <div style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>{footer}</div>}
      </div>
    </div>
  );
}
