import { describe, expect, it } from 'vitest';
import { oozeParams, oozePath, oozePoints } from './oozePath';

// Even-odd ray cast against the sampled front.
function inside([x, y]: [number, number], poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('oozePath', () => {
  const sizes: [number, number][] = [[240, 180], [520, 160], [240, 420]];

  it('is nothing before the ooze starts', () => {
    for (const p of oozePoints(0, 240, 180, oozeParams('a'))) expect(p).toEqual([0, 0]);
  });

  it('covers the whole card once it has spread', () => {
    for (const seed of ['a', 'Ideanori', 'Dinosaur nugget bucket', 'x'.repeat(40)]) {
      for (const [w, h] of sizes) {
        const poly = oozePoints(1, w, h, oozeParams(seed));
        for (let x = 1; x < w; x += 7) for (let y = 1; y < h; y += 7) {
          expect(inside([x, y], poly), `${seed} ${w}x${h} at ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it('spreads from the corner, reaching further down than across', () => {
    const pts = oozePoints(0.3, 400, 400, oozeParams('a'));
    const across = Math.max(...pts.filter(([, y]) => y < 1).map(([x]) => x));
    const down = Math.max(...pts.filter(([x]) => x < 1).map(([, y]) => y));
    expect(down).toBeGreaterThan(across);
    expect(inside([5, 5], pts)).toBe(true);
    expect(inside([380, 380], pts)).toBe(false);
  });

  it('is a closed SVG path', () => {
    expect(oozePath(0.5, 240, 180, oozeParams('a'))).toMatch(/^M0 0L.*Z$/);
  });
});
