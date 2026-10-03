/**
 * Map-import fixtures (PLAN 1.37a), generated at test time (no binary in the repo): a 64×32 image
 * in which every pixel covers exactly 32×32 cells of the 2048×1024 1938 map.
 *   terrain: left half water; right half plains, except a 16×8 block of forest at x 40..55,
 *   y 4..11 and a 4×4 block of mountains at x 60..63, y 28..31.
 *   nations: black (unowned) except an 8×4 block in Germany's colour at x 44..51, y 16..19 and an
 *   8×4 block in Poland's colour at x 36..43, y 24..27 (both on the plains half).
 */
import { inflateSync } from 'node:zlib';
import { encodePng } from '../../tools/data/png';

export const FIX_W = 64;
export const FIX_H = 32;
export const CELLS_PER_PIXEL = 32 * 32;

function image(paint: (x: number, y: number) => number): Buffer {
  const rgb = new Uint8Array(FIX_W * FIX_H * 3);
  for (let y = 0; y < FIX_H; y++) {
    for (let x = 0; x < FIX_W; x++) {
      const c = paint(x, y);
      const o = (y * FIX_W + x) * 3;
      rgb[o] = (c >> 16) & 255;
      rgb[o + 1] = (c >> 8) & 255;
      rgb[o + 2] = c & 255;
    }
  }
  return encodePng(rgb, FIX_W, FIX_H);
}

/** Terrain fixture in the terrain palette colours (data/terrain.json). */
export function terrainFixture(colors: { water: number; plains: number; forest: number; mountains: number }): Buffer {
  return image((x, y) => {
    if (x < 32) return colors.water;
    if (x >= 60 && y >= 28) return colors.mountains;
    if (x >= 40 && x <= 55 && y >= 4 && y <= 11) return colors.forest;
    return colors.plains;
  });
}

/** Expected cells per class after the terrain fixture. */
export const TERRAIN_FIXTURE_PIXELS = { water: 32 * 32, forest: 16 * 8, mountains: 4 * 4, plains: 32 * 32 - 16 * 8 - 4 * 4 };

export function nationFixture(ger: number, pol: number): Buffer {
  return image((x, y) => (x >= 44 && x <= 51 && y >= 16 && y <= 19 ? ger : x >= 36 && x <= 43 && y >= 24 && y <= 27 ? pol : 0x000000));
}

export const NATION_FIXTURE_PIXELS = { ger: 8 * 4, pol: 8 * 4 };

/**
 * Cell counts per terrain class after importing `values` into a world whose cities sit at
 * `cityCells` over `terrainBefore` (PLAN 1.41: city cells keep their land, never become water).
 */
export function importedCounts(values: ArrayLike<number>, terrainBefore: ArrayLike<number>, cityCells: Iterable<number>, classes: number, water: number): number[] {
  const counts = new Array<number>(classes).fill(0);
  for (let c = 0; c < values.length; c++) counts[values[c]!]!++;
  for (const c of new Set(cityCells)) {
    if (values[c] !== water) continue;
    counts[water]!--;
    counts[terrainBefore[c]!]!++;
  }
  return counts;
}

/** Decodes the fixture PNG (8-bit RGB, filter 0 rows, as tools/data/png.ts writes) to RGBA. */
export function decode(png: Buffer): Uint8Array {
  const idat = png.subarray(33 + 8, png.length - 12 - 4); // after signature + IHDR, before IEND; strip length+type
  const raw = inflateSync(idat);
  const rgba = new Uint8Array(FIX_W * FIX_H * 4);
  for (let y = 0; y < FIX_H; y++) {
    for (let x = 0; x < FIX_W; x++) {
      const s = y * (FIX_W * 3 + 1) + 1 + x * 3;
      rgba.set([raw[s]!, raw[s + 1]!, raw[s + 2]!, 255], (y * FIX_W + x) * 4);
    }
  }
  return rgba;
}
