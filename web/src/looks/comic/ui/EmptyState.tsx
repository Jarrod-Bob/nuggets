import React from 'react';
import { CaptionBox } from './CaptionBox';

/** Nothing to show, in the narrator's voice: a caption box with a heading, a line of help and at most one action. */
export interface EmptyStateProps {
  /** The heading; the same words as the Classic look. */
  headline: string;
  body?: string;
  action?: React.ReactNode;
  /** Where we are, in the narrator's voice. Default "Meanwhile…". */
  eyebrow?: React.ReactNode;
  tone?: 'nugget' | 'mayo' | 'paper';
}

export function EmptyState({ headline, body, action, eyebrow = 'Meanwhile…', tone }: EmptyStateProps) {
  return (
    <CaptionBox eyebrow={eyebrow} tone={tone} className="comic-empty">
      <h3 className="comic-empty-title">{headline}</h3>
      {body && <p className="comic-empty-body">{body}</p>}
      {action && <div className="comic-empty-action">{action}</div>}
    </CaptionBox>
  );
}
