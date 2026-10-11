import { cx } from './cx';
import React from 'react';

/**
 * The state of a connection or a queued job. StatusPill is a nugget's status;
 * this is everything else. Children are the word.
 */
export interface StatePillProps {
  /** `ok` (pickle) connected or sent; `off` (dashed) not connected; `wait` (raw) queued; `attention` (tomato) needs re-sync; `error` (red-ink line) failed. */
  tone: 'ok' | 'off' | 'wait' | 'attention' | 'error';
  children: React.ReactNode;
  className?: string;
}

export function StatePill({ tone, children, className }: StatePillProps) {
  return <span className={cx('comic-state', `comic-state--${tone}`, className)}>{children}</span>;
}
