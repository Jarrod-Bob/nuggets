/*
 * Where things are in and around the bucket. Everything is in the bucket's
 * own units: the prototype's 560 by 640 box (see BucketArt), y down. The
 * view places things in it by percentage, so the whole drawing scales.
 */

export const BOX_W = 560;
export const BOX_H = 640;
export const BUCKET_BOX = `0 0 ${BOX_W} ${BOX_H}`;

/** A nugget in the heap, the same size on the liner after a spill: a card outline (372 by 272) 112 units wide. */
export const NUGGET_W = 112;
export const NUGGET_H = (NUGGET_W * 272) / 372;

export const pctX = (x: number) => `${(x / BOX_W) * 100}%`;
export const pctY = (y: number) => `${(y / BOX_H) * 100}%`;

export interface Point {
  x: number;
  y: number;
}

/** A nugget's place: its centre, and its tilt in degrees. */
export interface Place extends Point {
  tilt: number;
}

/*
 * The heap: 30 places, in the order they fill. The mouth is the ellipse
 * centred (280, 200), 230 by 46; its front half (y = 200 + 46·√(1 − ((x − 280)/230)²),
 * 246 at the middle, ~240 at x 170 or 390) is the body's top edge, which hides
 * everything below it. A nugget is 82 high, so one centred on y sits from
 * y − 41 to y + 41.
 *
 * Layer 0, at the bottom, is centred 222 (back) and 246 (front): its tops,
 * 181 and 205, are inside the mouth (which at y 181 spans x 70..490), so a
 * few nuggets read as a few nuggets down in a bucket, the dark mouth behind
 * them. Each layer after it sits 22 to 28 higher and narrower, so the fill
 * rises as the pile grows: layer 1's back row (196, top 155) meets the back
 * rim (154 at the middle) and from layer 2 up the heap stands out of the
 * mouth as a mound, never wider than the mouth (x 94..466), topping out at
 * y 69, well inside the box.
 */
const LAYERS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // Layer 0, back-middle first so the first nugget is the most visible.
  [
    [282, 222],
    [203, 224],
    [362, 221],
    [280, 247],
    [126, 220],
    [438, 223],
    [172, 245],
    [390, 246],
  ],
  [
    [238, 197],
    [326, 195],
    [152, 199],
    [410, 198],
    [282, 222],
    [196, 223],
    [368, 221],
  ],
  [
    [282, 172],
    [196, 174],
    [366, 171],
    [150, 194],
    [240, 192],
    [414, 193],
  ],
  [
    [236, 148],
    [326, 147],
    [182, 168],
    [280, 166],
    [374, 169],
  ],
  [
    [254, 128],
    [318, 126],
    [286, 142],
  ],
  [[284, 110]],
];

// A small deterministic mess, so the heap isn't a grid: a nudge and a tilt per place.
const jitter = (i: number, by: number) => (((i * 37 + 11) % 17) / 16 - 0.5) * by;

export const HEAP: readonly Place[] = LAYERS.flat().map(([x, y], i) => ({
  x: x + jitter(i, 10),
  y: y + jitter(i + 5, 6),
  tilt: ((i * 53 + 7) % 37) - 18,
}));

export const HEAP_SIZE = HEAP.length;

/**
 * Drawing order of the heap's places: by layer, then back to front, so a
 * nugget in front overlaps the one behind it and an upper layer lies on the
 * one below.
 */
const LAYER_OF = LAYERS.flatMap((layer, l) => layer.map(() => l));
export const drawRank = (slot: number) => LAYER_OF[slot] * 1000 + HEAP[slot].y;

/*
 * The tip. The bucket falls over to its left, turning about its middle,
 * (280, 400), by 81°. Why those numbers: the body's left side runs from
 * (50, 200) to (110, 590), 8.7° off vertical, so turning by 90 − 8.7 ≈ 81°
 * lays that side flat; about (280, 400) it lands at y ≈ 596..598, on the
 * shadow (y 586..638), and the whole tipped bucket stays inside x 46..494,
 * the box it stood in, so tipping never pushes it out of view. The mouth then
 * faces left: its middle moves to (82, 369), its rim from (47, 596) to
 * (118, 142).
 */
export const TIP_DEG = -81;
export const TIP_PIVOT: Point = { x: 280, y: 400 };
export const TIP_ORIGIN = `${(TIP_PIVOT.x / BOX_W) * 100}% ${(TIP_PIVOT.y / BOX_H) * 100}%`;
/** Where the tipped bucket lies, padded a little: spilled nuggets land outside it. */
const TIPPED: { x0: number; x1: number; y0: number; y1: number } = { x0: 30, x1: 510, y0: 125, y1: 612 };
/** Just outside the tipped mouth, on the floor: the spill fans out from here. */
const SPILL_FROM: Point = { x: 30, y: 560 };

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Turns a point about the pivot, the way CSS `rotate(deg)` does (positive is clockwise on screen). */
function turn(p: Point, deg: number): Point {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const dx = p.x - TIP_PIVOT.x;
  const dy = p.y - TIP_PIVOT.y;
  return { x: TIP_PIVOT.x + dx * c - dy * s, y: TIP_PIVOT.y + dx * s + dy * c };
}
/** A point in the tipped bucket's own units, as it lands on the liner. */
export const toLiner = (p: Point) => turn(p, TIP_DEG);
/** A point on the liner, in the tipped bucket's own units: the heap rides in the bucket, so that's where its flight is drawn. */
export const toBucket = (p: Point) => turn(p, -TIP_DEG);

/** The visible floor, in bucket units: the liner's inside as far as it is on screen. */
export interface Floor {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The floor in bucket units, from the bucket box's and the visible liner's screen rectangles. */
export function floorFrom(box: DOMRect, visible: { left: number; top: number; right: number; bottom: number }): Floor {
  const unit = box.width / BOX_W || 1;
  return {
    x0: (visible.left - box.left) / unit,
    x1: (visible.right - box.left) / unit,
    y0: (visible.top - box.top) / unit,
    y1: (visible.bottom - box.top) / unit,
  };
}

// The R2 sequence: well-spread points in the unit square, the same every time.
const r2 = (n: number): Point => ({ x: (0.5 + n * 0.7548776662) % 1, y: (0.5 + n * 0.569840291) % 1 });

/**
 * Where `count` spilled nuggets come to rest, in liner terms (bucket units,
 * untipped). Each lands whole on the visible floor, with its half-size kept
 * clear of the edge, and outside the tipped bucket; of the spots that allows,
 * the 3·count nearest the mouth are kept and `count` of them picked spread
 * among those, so the spill fans out from the mouth however much floor the
 * screen has: to the left on a wide screen, in front on a phone. Where the
 * floor is too small for that, the rest land wherever they fit on it.
 */
export function spillSpots(count: number, floor: Floor): Place[] {
  const mx = NUGGET_W / 2 + 6;
  const my = NUGGET_H / 2 + 6;
  const x0 = floor.x0 + mx;
  const y0 = floor.y0 + my;
  const w = Math.max(0, floor.x1 - mx - x0);
  const h = Math.max(0, floor.y1 - my - y0);
  const candidates = Array.from({ length: 600 }, (_, n) => {
    const u = r2(n);
    return { n, x: x0 + u.x * w, y: y0 + u.y * h };
  });
  const clear = (p: Point) => p.x < TIPPED.x0 || p.x > TIPPED.x1 || p.y < TIPPED.y0 || p.y > TIPPED.y1;
  const dist = (p: Point) => Math.hypot(p.x - SPILL_FROM.x, (p.y - SPILL_FROM.y) * 1.4);
  const near = candidates
    .filter(clear)
    .sort((a, b) => dist(a) - dist(b))
    .slice(0, count * 3)
    .sort((a, b) => a.n - b.n)
    .slice(0, count);
  const rest = candidates.filter((c) => !near.includes(c)).slice(0, count - near.length);
  return [...near, ...rest].map((p, i) => ({ x: p.x, y: p.y, tilt: ((i * 71 + 13) % 70) - 35 }));
}

/**
 * One spilled nugget's flight, in the tipped bucket's units, as keyframes:
 * up out of the mouth from its place in the heap, then an arc across the
 * liner (a quadratic Bézier sampled at even times, which is a thrown thing's
 * parabola) to its spot, and a small hop as it lands.
 */
export function flight(home: Place, spot: Place, turns: number): { left: string[]; top: string[]; rotate: number[]; times: number[] } {
  // Out of the mouth: straight up in the bucket, which is to the left once it has tipped.
  const out: Point = { x: 280 + (home.x - 280) * 0.6, y: Math.min(home.y, 150) - 70 };
  const a = toLiner(out);
  const ctrl: Point = { x: (a.x + spot.x) / 2 - 40, y: Math.min(a.y, spot.y) - 150 };
  const ARC = 6;
  const arc: Point[] = [];
  for (let k = 1; k <= ARC; k++) {
    const t = k / ARC;
    const u = 1 - t;
    arc.push({ x: u * u * a.x + 2 * u * t * ctrl.x + t * t * spot.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * spot.y });
  }
  const hop: Point = { x: spot.x, y: spot.y - 16 };
  const path = [home, ...[a, ...arc, hop, spot].map(toBucket)];
  const times = [0, 0.18, ...arc.map((_, k) => 0.18 + ((k + 1) / ARC) * 0.64), 0.91, 1];
  // On the liner a nugget lies at its own tilt, which in the tipped bucket is
  // 81° more; `turns` whole turns on the way make it tumble.
  const landed = spot.tilt - TIP_DEG + turns * 360;
  const rotate = times.map((t) => home.tilt + (landed - home.tilt) * Math.min(1, t / 0.82));
  return {
    left: path.map((p) => pctX(p.x - NUGGET_W / 2)),
    top: path.map((p) => pctY(p.y - NUGGET_H / 2)),
    rotate,
    times,
  };
}
