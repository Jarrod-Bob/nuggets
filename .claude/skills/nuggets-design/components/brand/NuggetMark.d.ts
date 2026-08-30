import * as React from 'react';

/**
 * The nugget illustration. NOTE: Nuggets supplied no logo, so this is a brand
 * *motif*, not an official mark — pair it with the wordmark set in Baloo 2.
 * Paths resolve relative to the page, so pass a corrected `src` prefix if your
 * page is not at the project root.
 */
export interface NuggetMarkProps {
  size?: number;
  variant?: 'single' | 'alt' | 'trio' | 'bucket' | 'dip';
  /** Swap for the eaten version — two bites out of the top-right. Available on `single` and `trio`; ignored elsewhere. */
  bitten?: boolean;
  style?: React.CSSProperties;
}
export declare function NuggetMark(props: NuggetMarkProps): JSX.Element;
