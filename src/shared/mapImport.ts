/**
 * Map import (SPEC §9, PLAN 1.37a): an image becomes a terrain or nation layer by palette
 * mapping. The image is resampled to the map by nearest neighbour (cell (x, y) reads pixel
 * (⌊x·iw/W⌋, ⌊y·ih/H⌋)); each pixel takes the value of the nearest palette colour (RGB distance),
 * or `fallback` when that is farther than `maxDist`. The result travels in the command as runs
 * (RLE), so imports of flat-coloured maps stay small in the command log.
 */

export interface PaletteEntry {
  /** 0xRRGGBB. */
  rgb: number;
  value: number;
}

/** Values for a W×H map from RGBA pixels `rgba` (iw×ih). */
export function paletteMap(rgba: ArrayLike<number>, iw: number, ih: number, w: number, h: number, palette: readonly PaletteEntry[], maxDist: number, fallback: number): Uint16Array {
  // One lookup per distinct pixel colour (images are mostly flat areas).
  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number): number => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = fallback;
    let bestD = maxDist * maxDist;
    for (const p of palette) {
      const dr = r - ((p.rgb >> 16) & 255);
      const dg = g - ((p.rgb >> 8) & 255);
      const db = b - (p.rgb & 255);
      const d = dr * dr + dg * dg + db * db;
      if (d <= bestD) {
        bestD = d;
        best = p.value;
      }
    }
    cache.set(key, best);
    return best;
  };
  const out = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    const py = Math.floor((y * ih) / h);
    for (let x = 0; x < w; x++) {
      const o = (py * iw + Math.floor((x * iw) / w)) * 4;
      out[y * w + x] = nearest(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!);
    }
  }
  return out;
}

/** Run-length encoding: flat [value, count, value, count, …]. */
export function encodeRuns(values: ArrayLike<number>): number[] {
  const runs: number[] = [];
  for (let i = 0; i < values.length; ) {
    const v = values[i]!;
    let j = i + 1;
    while (j < values.length && values[j] === v) j++;
    runs.push(v, j - i);
    i = j;
  }
  return runs;
}

/** Decodes runs into exactly `n` values (null if they do not cover n). */
export function decodeRuns(runs: readonly number[], n: number): Uint16Array | null {
  const out = new Uint16Array(n);
  let o = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const count = runs[i + 1]!;
    if (!Number.isInteger(count) || count <= 0 || o + count > n) return null;
    out.fill(runs[i]!, o, o + count);
    o += count;
  }
  return o === n ? out : null;
}
