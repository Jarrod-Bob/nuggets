import React from 'react';
import nuggetSvg from '../../assets/nugget.svg';
import nuggetAltSvg from '../../assets/nugget-alt.svg';
import nuggetTrioSvg from '../../assets/nugget-trio.svg';
import bucketSvg from '../../assets/bucket.svg';
import dipCupSvg from '../../assets/dip-cup.svg';
import nuggetBittenSvg from '../../assets/nugget-bitten.svg';
import nuggetTrioBittenSvg from '../../assets/nugget-trio-bitten.svg';

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
  const files: Record<NonNullable<NuggetMarkProps['variant']>, string> = { single: nuggetSvg, alt: nuggetAltSvg, trio: nuggetTrioSvg, bucket: bucketSvg, dip: dipCupSvg };
  const bites: Partial<Record<NonNullable<NuggetMarkProps['variant']>, string>> = { single: nuggetBittenSvg, trio: nuggetTrioBittenSvg };
  const src = (bitten && bites[variant]) || files[variant] || nuggetSvg;
  const ratio = ({ single: 100 / 120, alt: 100 / 120, trio: 120 / 260, bucket: 130 / 140, dip: 80 / 100 } as Record<string, number>)[variant] || 1;
  return <img src={src} alt="" aria-hidden="true" style={{ width: size, height: size * ratio, display: 'block', ...style }} />;
}
