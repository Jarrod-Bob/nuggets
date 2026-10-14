import React from 'react';
import { BUCKET_BOX } from './bucketGeometry';

/*
 * The bucket's drawing, ported from the prototype's (design/comic-strip,
 * #v-bucket) in its 560 by 640 box, split in two so the heap can sit between:
 *
 *   BucketBack   the open mouth: an ink ellipse centred (280, 200), 230 by 46,
 *                so it spans x 50..510 and y 154..246, plus the rim's back
 *                half, the arc over the top (y < 200).
 *   (the heap)
 *   BucketFront  the body, whose top edge is the rim's front half (the arc
 *                under, y > 200) so everything above it stays visible through
 *                the mouth; the stripes, the halftone, the front lip and the
 *                paint-tin label the count is written on.
 *
 * The label is wider and taller than the prototype's sticker so the count
 * fits on it. It wraps the body like a paint tin's: its top and bottom edges
 * curve the way rings round the bucket do (every ring's height is 0.2 of its
 * width, like the mouth's 46/230), covering 0.86 of the body's width.
 */

const BODY = 'M50 200L110 590A170 34 0 0 0 450 590L510 200A230 46 0 0 1 50 200Z';
const FRONT_LIP = 'M48 200A232 48 0 0 0 512 200L512 214A232 50 0 0 1 48 214Z';
export const LABEL = 'M89 252Q280 296 471 252L429 572Q280 606 131 572Z';
const LABEL_INSET = 'M103 266Q280 306 457 266L420 560Q280 592 140 560Z';

const STRIPES = [
  'M101.1 228.9L152.2 238.2L185.6 618.3L147.8 611.4Z',
  'M203.3 243.4L254.4 245.7L261.1 623.8L223.3 622.1Z',
  'M305.6 245.7L356.7 243.4L336.7 622.1L298.9 623.8Z',
  'M407.8 238.2L458.9 228.9L412.2 611.4L374.4 618.3Z',
];

/** The prototype's halftone shading down the right of the body: rows 11 apart, the dots shrinking towards the middle. Clipped to the body. */
const DOTS = (() => {
  const dots: Array<{ cx: number; cy: number; r: number }> = [];
  for (let row = 0; row < 33; row++) {
    const cy = 250 + row * 11;
    for (let col = 0; col < 14; col++) {
      const r = 3.1 - col * 0.19 - row * 0.004;
      if (r < 0.6) break;
      dots.push({ cx: Math.round((488.8 - row * 1.7 - col * 11) * 10) / 10, cy, r: Math.round(r * 10) / 10 });
    }
  }
  return dots;
})();

export function BucketShadow() {
  return (
    <svg className="comic-bucket-art" viewBox={BUCKET_BOX} aria-hidden="true">
      <ellipse cx="290" cy="612" rx="230" ry="26" fill="var(--comic-toast)" />
    </svg>
  );
}

export function BucketBack() {
  return (
    <svg className="comic-bucket-art" viewBox={BUCKET_BOX} aria-hidden="true">
      <ellipse cx="280" cy="200" rx="230" ry="46" fill="var(--comic-ink)" />
      <path d="M50 200A230 46 0 0 1 510 200" stroke="var(--comic-ink)" strokeWidth={5} fill="none" />
    </svg>
  );
}

/** The parts that take the pointer are marked `comic-bucket-solid`; everything else lets it through to the heap. */
export function BucketFront() {
  const clip = React.useId();
  return (
    <svg className="comic-bucket-art" viewBox={BUCKET_BOX} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path className="comic-bucket-solid" d={BODY} fill="var(--comic-paper)" />
      {STRIPES.map((d) => (
        <path key={d} d={d} fill="var(--comic-tomato)" />
      ))}
      <g fill="var(--comic-ink)" opacity="0.32" clipPath={`url(#${clip})`}>
        {DOTS.map((d) => (
          <circle key={`${d.cx},${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} />
        ))}
      </g>
      <path d={BODY} fill="none" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
      <path className="comic-bucket-solid" d={FRONT_LIP} fill="var(--comic-paper)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
      <path d={LABEL} fill="var(--comic-mayo)" stroke="var(--comic-ink)" strokeWidth={5} strokeLinejoin="round" />
      <path d={LABEL_INSET} fill="none" stroke="var(--comic-ink)" strokeWidth={2} strokeLinejoin="round" strokeDasharray="2 7" strokeLinecap="round" />
      {/* The shine, between the body's left edge and the label's. */}
      <path d="M73 262L102 460" stroke="var(--comic-paper)" strokeWidth={9} strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
