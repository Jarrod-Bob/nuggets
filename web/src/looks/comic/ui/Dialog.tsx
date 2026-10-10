import React from 'react';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

/**
 * A Comic dialog: the inked panel with a sticker shadow, over a scrim. It owns
 * the overlay, so it is named by its title (`role="dialog"`), closes on Escape
 * and on its close button, takes focus when it opens and gives it back when it
 * closes. Mount it only while open. Presentational: no api, no models.
 */
export interface DialogProps {
  title: React.ReactNode;
  /** One line under the title, wired with aria-describedby. */
  description?: React.ReactNode;
  /** Called by Escape, the close button and a click on the scrim. */
  onClose?: () => void;
  /** Pills for the mayo footer: Cancel, then the one tomato pill. */
  footer?: React.ReactNode;
  /** Width in px or any CSS length. Default 560. */
  width?: number | string;
  className?: string;
  children?: React.ReactNode;
}

/** The open Comic dialogs, oldest first: Escape closes only the last. */
const open: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ title, description, onClose, footer, width = 560, className, children }: DialogProps) {
  const id = React.useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;
  const panel = React.useRef<HTMLElement>(null);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    const token = Symbol('dialog');
    const before = document.activeElement as HTMLElement | null;
    const el = panel.current;
    // Take focus: the first control in the body, else the panel itself.
    (el?.querySelector('.comic-dialog-body')?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();
    open.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only the topmost Comic dialog answers; a key something else already
        // handled (the curry corner draining) is left alone.
        if (open[open.length - 1] !== token || e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current?.();
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(token), 1);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="comic-dialog-overlay">
      <div className="comic-dialog-scrim" onClick={onClose} />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={['comic-panel', 'comic-dialog', className].filter(Boolean).join(' ')}
        style={{ width }}
      >
        <header className="comic-dialog-head">
          <h2 id={titleId} className="comic-dialog-title">
            {title}
          </h2>
          {onClose && (
            <IconButton label="Close" onClick={onClose}>
              <Icon name="close" size={16} />
            </IconButton>
          )}
        </header>
        {description && (
          <p id={descId} className="comic-dialog-desc">
            {description}
          </p>
        )}
        <div className="comic-dialog-body">{children}</div>
        {footer && <footer className="comic-dialog-foot">{footer}</footer>}
      </section>
    </div>
  );
}
