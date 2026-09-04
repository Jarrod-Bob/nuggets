import type { Status } from '../api';
import type { BadgeProps } from '../components/core/Badge';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * Each status maps to one Badge tone (the design system ships exactly five, one
 * per status) and a human label. raw is the neutral resting state; parked is
 * ink (stopped but kept); killed is ketchup (decided against).
 */
const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  raw: { label: 'Raw', tone: 'neutral' },
  exploring: { label: 'Exploring', tone: 'golden' },
  building: { label: 'Building', tone: 'herb' },
  parked: { label: 'Parked', tone: 'ink' },
  killed: { label: 'Killed', tone: 'ketchup' },
};

export function statusLabel(status: Status): string {
  return STATUS_META[status]?.label ?? status;
}

export function statusTone(status: Status): Tone {
  return STATUS_META[status]?.tone ?? 'neutral';
}

/** Anything past raw counts as "acted on" — the card shows the bitten treatment. */
export function isActedOn(status: Status): boolean {
  return status !== 'raw';
}

/** A blank label renders as the URL's host, so a bare link still reads as something. */
export function linkText(url: string, label: string): string {
  if (label.trim()) return label;
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
