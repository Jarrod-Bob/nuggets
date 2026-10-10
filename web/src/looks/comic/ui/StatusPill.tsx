import type { Status } from '../../../lib/status';
import { statusLabel } from '../../../lib/status';

/**
 * A nugget's status as a word on its status fill (Done is pickle, Killed is
 * burnt, Parked a dashed mayo). Colour is never the only signal: the word is
 * always there. The label is the Classic look's, so both Looks share their tests.
 */
export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return <span className={['comic-status', `comic-status--${status}`, className].filter(Boolean).join(' ')}>{statusLabel(status)}</span>;
}
