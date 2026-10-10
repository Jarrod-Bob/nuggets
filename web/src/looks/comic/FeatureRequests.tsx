import type { FeatureRequest } from '../../api';
import { featureRequestView } from '../../lib/featureRequest';
import { Button, cx, StatePill } from './ui';

const STATE = { created: { tone: 'ok', label: 'Sent' }, pending: { tone: 'wait', label: 'Queued' }, failed: { tone: 'error', label: 'Failed' } } as const;

export interface FeatureRequestsProps {
  requests: FeatureRequest[];
  onRetry: (id: number) => void;
  /** The request whose Retry is in flight, if any. */
  retrying?: number | null;
}

/**
 * A nugget's GitHub feature requests as a strip of small panels, one per
 * request: the same words as Classic's list ("Feature request #42", "queued",
 * "failed"), the repo in mono, a state pill, GitHub's last error, and a Retry
 * pill on a failed one, whose panel turns red ink. Renders nothing for a
 * nugget with none.
 */
export function FeatureRequests({ requests, onRetry, retrying = null }: FeatureRequestsProps) {
  if (requests.length === 0) return null;
  return (
    <ul aria-label="Feature requests" className="comic-requests">
      {requests.map((r) => {
        const view = featureRequestView(r);
        return (
          <li key={r.id} className={cx('comic-panel', 'comic-request', view === 'failed' && 'comic-request--failed')}>
            <div className="comic-request-head">
              {view === 'created' &&
                (r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="comic-request-name">
                    Feature request #{r.number}
                  </a>
                ) : (
                  <strong className="comic-request-name">Feature request #{r.number}</strong>
                ))}
              {view === 'pending' && <span className="comic-request-name">Feature request queued</span>}
              {view === 'failed' && <span className="comic-request-name">Feature request failed</span>}
              <StatePill tone={STATE[view].tone}>{STATE[view].label}</StatePill>
            </div>
            <span className="comic-request-repo">{r.repo}</span>
            {view !== 'created' && r.last_error && <span className="comic-request-error">{r.last_error}</span>}
            {view === 'failed' && (
              <Button size="sm" onClick={() => onRetry(r.id)} disabled={retrying === r.id}>
                Retry
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
