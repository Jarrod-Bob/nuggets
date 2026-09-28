import type { FeatureRequest } from '../api';

/** The settings screen's queue line: "2 queued · 1 failed", or null when nothing is waiting. */
export function describeQueue(pending: number, failed: number): string | null {
  const parts: string[] = [];
  if (pending > 0) parts.push(`${pending} queued`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.length ? parts.join(' · ') : null;
}

/** How the nugget page shows a feature request: 'sending' is still pending to the captain. */
export type FeatureRequestView = 'created' | 'pending' | 'failed';

export function featureRequestView(request: Pick<FeatureRequest, 'state'>): FeatureRequestView {
  switch (request.state) {
    case 'created':
      return 'created';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}
