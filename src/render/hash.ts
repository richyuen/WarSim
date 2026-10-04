/**
 * Placement noise for the view: where a shot lands, how a wreck lies, where an individual
 * stands in its element's footprint. Presentation only, and deterministic: the same ids give
 * the same picture on every frame and after every reload. (The sim has its own hash, `sim/core`;
 * nothing here reaches sim state.)
 */

/** A 32-bit mix of two integers. */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ Math.imul(b + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Two numbers in [−1, 1) from one hash: its low and its high half. */
export function pair(h: number): [number, number] {
  return [(h & 0xffff) / 32768 - 1, (h >>> 16) / 32768 - 1];
}
