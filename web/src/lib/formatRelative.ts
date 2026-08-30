/**
 * Formats an RFC3339 timestamp as a short relative-time string in the style
 * used throughout the design system's seed data (e.g. 'just now', '2d ago',
 * '1w ago', '3mo ago'). Not exhaustive — good enough for a single-user local
 * app's activity feed, not a general-purpose i18n formatter.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffDay < 30) return `${diffWeek}w ago`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffDay < 365) return `${diffMonth}mo ago`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y ago`;
}
