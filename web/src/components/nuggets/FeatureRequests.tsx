import React from 'react';
import { Button } from '../core/Button';
import type { FeatureRequest } from '../../api';
import { featureRequestView } from '../../lib/featureRequest';

export interface FeatureRequestsProps {
  requests: FeatureRequest[];
  onRetry: (id: number) => void;
  /** The request whose Retry is in flight, if any. */
  retrying?: number | null;
}

const line: React.CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 'var(--text-body-sm)', color: 'var(--nug-ink-700)' };
const repoStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--nug-ink-500)', overflowWrap: 'anywhere' };

/**
 * A nugget's GitHub feature requests (tag-to-issue design §7): a link to each
 * created issue, a queued line while one waits to be sent, and the error with
 * a Retry button when GitHub refused it. Renders nothing for a nugget with
 * none.
 */
export function FeatureRequests({ requests, onRetry, retrying = null }: FeatureRequestsProps) {
  if (requests.length === 0) return null;
  return (
    <ul aria-label="Feature requests" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {requests.map((r) => {
        const view = featureRequestView(r);
        return (
          <li key={r.id} style={line}>
            {view === 'created' &&
              (r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--nug-ink-900)', fontWeight: 'var(--weight-bold)' }}>
                  Feature request #{r.number}
                </a>
              ) : (
                <strong>Feature request #{r.number}</strong>
              ))}
            {view === 'pending' && <span>Feature request queued</span>}
            {view === 'failed' && <span style={{ color: 'var(--nug-ketchup-600)', fontWeight: 'var(--weight-bold)' }}>Feature request failed</span>}
            <span style={repoStyle}>{r.repo}</span>
            {view !== 'created' && r.last_error && (
              <span style={{ flexBasis: '100%', color: view === 'failed' ? 'var(--nug-ketchup-600)' : 'var(--nug-ink-500)', overflowWrap: 'anywhere' }}>
                {r.last_error}
              </span>
            )}
            {view === 'failed' && (
              <Button variant="secondary" size="sm" onClick={() => onRetry(r.id)} disabled={retrying === r.id}>
                Retry
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
