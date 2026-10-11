/** A seeded pseudo-random stream in [0, 1): the same seed always gives the same sequence. */
function rng(seed: number): () => number {
  let s = (Math.abs(seed | 0) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * A lumpy closed blob as an SVG path (a Catmull-Rom spline through `n` jittered
 * points on an ellipse), so the same seed always draws the same shape. Ported
 * from the design's `blob`.
 */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, n = 16, jitter = 0.09): string {
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 2 * jitter + (i % 2 ? 0.035 : -0.02);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${round(pts[0][0])} ${round(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${round(p1[0] + (p2[0] - p0[0]) / 6)} ${round(p1[1] + (p2[1] - p0[1]) / 6)} ${round(p2[0] - (p3[0] - p1[0]) / 6)} ${round(p2[1] - (p3[1] - p1[1]) / 6)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d + 'Z';
}
