import * as React from 'react';

/**
 * The Nuggets wordmark: the name set in Baloo 2 ExtraBold, lowercase, tight
 * tracking, optionally preceded by the nugget motif. Stands in for a real logo
 * until brand files exist.
 */
export interface WordmarkProps {
  size?: number;
  tone?: 'ink' | 'cream' | 'golden';
  withMark?: boolean;
  /** Renders only the single-nugget icon, no wordmark text — for tight spaces (favicon, avatar). */
  iconOnly?: boolean;
  style?: React.CSSProperties;
}
export declare function Wordmark(props: WordmarkProps): JSX.Element;
