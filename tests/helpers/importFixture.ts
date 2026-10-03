/**
 * Map-import fixtures (PLAN 1.37a), generated at test time (no binary in the repo): a 64×32 image
 * in which every pixel covers exactly 32×32 cells of the 2048×1024 1938 map.
 *   terrain: left half water; right half plains, except a 16×8 block of forest at x 40..55,
 *   y 4..11 and a 4×4 block of mountains at x 60..63, y 28..31.
 *   nations: black (unowned) except an 8×4 block in Germany's colour at x 44..51, y 16..19 and an
 *   8×4 block in Poland's colour at x 36..43, y 24..27 (both on the plains half).
 */
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
