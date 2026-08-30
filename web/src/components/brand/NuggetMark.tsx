import React from 'react';

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

/** Renders the nugget blob illustration shipped in assets/. */
export function NuggetMark({ size = 40, variant = 'single', bitten = false, style }: NuggetMarkProps) {
  const files: Record<NonNullable<NuggetMarkProps['variant']>, string> = { single: 'nugget.svg', alt: 'nugget-alt.svg', trio: 'nugget-trio.svg', bucket: 'bucket.svg', dip: 'dip-cup.svg' };
  const bites: Partial<Record<NonNullable<NuggetMarkProps['variant']>, string>> = { single: 'nugget-bitten.svg', trio: 'nugget-trio-bitten.svg' };
  const src = (bitten && bites[variant]) || files[variant] || 'nugget.svg';
  const ratio = ({ single: 100 / 120, alt: 100 / 120, trio: 120 / 260, bucket: 130 / 140, dip: 80 / 100 } as Record<string, number>)[variant] || 1;
  return <img src={`${(typeof window !== 'undefined' && (window as any).NUG_ASSET_BASE) || 'assets/'}${src}`} alt="" aria-hidden="true" style={{ width: size, height: size * ratio, display: 'block', ...style }} />;
}
