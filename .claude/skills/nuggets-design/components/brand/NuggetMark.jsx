import React from 'react';

/** Renders the nugget blob illustration shipped in assets/. */
export function NuggetMark({ size = 40, variant = 'single', bitten = false, style }) {
  const files = { single: 'nugget.svg', alt: 'nugget-alt.svg', trio: 'nugget-trio.svg', bucket: 'bucket.svg', dip: 'dip-cup.svg' };
  const bites = { single: 'nugget-bitten.svg', trio: 'nugget-trio-bitten.svg' };
  const src = (bitten && bites[variant]) || files[variant] || 'nugget.svg';
  const ratio = { single: 100 / 120, alt: 100 / 120, trio: 120 / 260, bucket: 130 / 140, dip: 80 / 100 }[variant] || 1;
  return <img src={`${(typeof window !== 'undefined' && window.NUG_ASSET_BASE) || 'assets/'}${src}`} alt="" aria-hidden="true" style={{ width: size, height: size * ratio, display: 'block', ...style }} />;
}
