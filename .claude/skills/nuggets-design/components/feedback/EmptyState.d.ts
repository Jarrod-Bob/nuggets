import * as React from 'react';

/** Empty view: nugget illustration, warm headline, one action. */
export interface EmptyStateProps {
  headline: string;
  body?: string;
  action?: React.ReactNode;
  variant?: 'single' | 'trio' | 'bucket' | 'dip';
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
