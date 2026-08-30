// FNV-1a, same mixer as dipFor — a weak hash clusters the corners and the
// variance disappears.
function nugHash(s = ''): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Eight corner values in [min,max] — a soft rounded rect that is never quite the
 *  same twice, the way no two nuggets are the same shape. */
export function fluidRadius(seed = '', min = 10, max = 28): string {
  let h = nugHash(seed);
  const v: number[] = [];
  for (let i = 0; i < 8; i++) { h = Math.imul(h ^ (i + 1), 0x01000193) >>> 0; v.push(min + ((h >>> 9) % (max - min + 1))); }
  return `${v[0]}px ${v[1]}px ${v[2]}px ${v[3]}px / ${v[4]}px ${v[5]}px ${v[6]}px ${v[7]}px`;
}
