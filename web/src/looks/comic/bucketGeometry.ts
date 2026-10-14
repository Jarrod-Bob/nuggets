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
