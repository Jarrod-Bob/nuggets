import type { Idea } from '../api';
import { formatRelative } from './formatRelative';

/**
 * The nugget page's origin line (issue #7): "arrived via Telegram, 3d ago".
 * Null for a nugget typed into the app, which has no origin worth stating.
 * The time is when the nugget landed in the bank (created_at), not when it was
 * first typed on the phone.
 */
export function describeOrigin(idea: Pick<Idea, 'origin' | 'created_at'>, now: Date = new Date()): string | null {
  if (!idea.origin) return null;
  return `arrived via ${idea.origin}, ${formatRelative(idea.created_at, now)}`;
}

/** The settings screen's sync line (issue #8): "last synced 2m ago", or "not synced yet". */
export function describeLastSync(lastSyncAt: string | undefined, now: Date = new Date()): string {
  return lastSyncAt ? `last synced ${formatRelative(lastSyncAt, now)}` : 'not synced yet';
}
