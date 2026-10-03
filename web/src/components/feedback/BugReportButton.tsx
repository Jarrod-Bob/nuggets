import React from 'react';
import { useLocation } from 'react-router-dom';
import { iconBug } from '../icons';
import { bugReportUrl } from '../../lib/bugReport';

/**
 * The floating "Report a bug" control the shell pins to the bottom-right of
 * every route. It is a link rather than a button: it opens GitHub's bug-report
 * form for nuggets in a new tab with the route, build and browser pre-filled,
 * and nuggets itself sends nothing. It sits below dialogs (z-index 50 < 60),
 * and the shell's footer leaves room under the last row of content so nothing
 * stays hidden behind it. On narrow screens it shrinks to its icon.
 */
export function BugReportButton() {
  const { pathname } = useLocation();
  const [hover, setHover] = React.useState(false);
  const href = bugReportUrl({ page: pathname, version: __NUGGETS_BUILD__, userAgent: navigator.userAgent });
  return (
    <a
      className="nug-bug-report"
      href={href} target="_blank" rel="noopener noreferrer"
      aria-label="Report a bug (opens GitHub in a new tab)" title="Report a bug"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed', right: 'var(--gutter-mobile)', bottom: 'var(--gutter-mobile)', zIndex: 50,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        height: 40, minWidth: 40, borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body-sm)',
        color: 'var(--nug-ink-900)', textDecoration: 'none', whiteSpace: 'nowrap',
        background: hover ? 'var(--nug-cream-200)' : 'var(--nug-cream-50)',
        border: 'var(--border-regular) solid var(--nug-ink-900)',
        boxShadow: 'var(--crust-edge-ink), var(--shadow-2)',
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}>
      {iconBug}
      <span className="nug-bug-report__label">Report a bug</span>
    </a>
  );
}
