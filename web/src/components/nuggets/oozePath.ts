import { nugHash } from './fluidRadius';

/**
 * The shape of curry spreading from a card's top-left corner (issue #37), as
 * a clip-path for the flood. At `p = 0` it is nothing, hidden under the corner
 * sauce; as `p` grows it spreads out from the corner, faster downwards than
 * across (sauce is heavy), with a gently wavy front and a few drips leading
 * it. At `p = 1` it covers the whole card with room to spare.
 */

export interface OozeParams {
  /** Where the front's waves sit, so each nugget's front differs. */
  phase: number;
  /** Drips on the front: angle from the top edge (radians), length and width (px). */
  drips: { angle: number; length: number; width: number }[];
}

const WAVE = 5; // px, the front's wobble either side of its line
const LOBES = 9; // waves across the quarter turn
const SAMPLES = 96;

export function oozeParams(seed: string): OozeParams {
  let h = nugHash(seed + ':ooze');
  const next = () => (h = Math.imul(h ^ 0x9e37, 0x01000193) >>> 0);
  const drips = [0, 1, 2, 3].map(i => {
    next();
    return {
      angle: 0.2 + i * 0.36 + ((h >>> 4) % 100) / 100 * 0.2,
      length: 10 + ((h >>> 11) % 17),
      width: 5 + ((h >>> 19) % 5),
    };
  });
  next();
  return { phase: ((h >>> 7) % 628) / 100, drips };
}

// Gravity: the front reaches further down than across.
function stretch(angle: number): number {
  return 0.8 + 0.45 * Math.sin(angle);
}

// How large the ooze grows by p = 1: enough that even the front's troughs
// are past the card's far edges in every direction.
function fullRadius(w: number, h: number): number {
  let r = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * (Math.PI / 2);
    const toEdge = Math.min(Math.cos(a) > 1e-6 ? w / Math.cos(a) : Infinity, Math.sin(a) > 1e-6 ? h / Math.sin(a) : Infinity);
    r = Math.max(r, (toEdge + WAVE + 2) / stretch(a));
  }
  return r * 1.04;
}

/** The front as points, corner first. Exported for tests. */
export function oozePoints(p: number, w: number, h: number, params: OozeParams): [number, number][] {
  const radius = fullRadius(w, h) * Math.max(0, Math.min(1, p));
  // Waves and drips grow in with the ooze, so the start is a clean dot under the corner sauce.
  const grown = Math.min(1, radius / 50);
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * (Math.PI / 2);
    // The waves drift as it spreads, so the front looks like it's moving, not just scaling.
    let r = radius * stretch(a) + WAVE * grown * Math.sin(a * LOBES * 2 + params.phase + p * 3);
    for (const d of params.drips) {
      const across = ((a - d.angle) * Math.max(radius, 1)) / d.width;
      r += d.length * grown * Math.exp(-across * across);
    }
    r = Math.max(0, r);
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** The front as an SVG path, smoothed through the midpoints of its points. */
export function oozePath(p: number, w: number, h: number, params: OozeParams): string {
  const pts = oozePoints(p, w, h, params);
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M0 0L${f(pts[1][0])} ${f(pts[1][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d}L${f(lx)} ${f(ly)}Z`;
}
