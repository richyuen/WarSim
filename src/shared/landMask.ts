/**
 * The fine land mask (SPEC §3.1): one bit a pixel, 1 = land, row-major, the lowest bit of a
 * byte first; 16384 × 8192 for the Earth, 8 px to a cell of the M map. The sim (where a
 * formation and its elements stand: PLAN 2.9a), the renderer (the coast of T2 and T3) and the
 * tests read it through this module, so that "land at (x, y)" has one meaning.
 *
 * **The convention:** a point is on land when the bit of the mask pixel that holds it is set
 * (`maskLand`). The coast runs along pixel edges.
 *
 * **The drawn coast** (PLAN 2.9b) is that coast made a shore: `maskField` blends the four
 * pixels round a place, 1 where they are all land and 0 where none is, and the map's shader
 * (`mapShader.ts`, the same blend) draws land where it is over a half, after moving the line by
 * a noise of at most `SHORE_NOISE` × 4f(1 − f). So the picture can say other than the bit,
 * inside the squares where the four pixels differ, and nowhere else.
 *
 * **Surely land** (`maskSure`): the field is `SURE_LAND` or more. Such a place is in a land
 * pixel (with its own pixel water the field is 0.75 at most) and is drawn as land whatever the
 * noise (0.85 − 0.35 × 4 × 0.85 × 0.15 = 0.67, over a half). It is where a formation and its
 * elements stand, and where a tree does.
 */
export interface LandMask {
  w: number;
  h: number;
  bits: Uint8Array;
}

/** The mask's bit at pixel (`px`, `py`); outside its rows there is no land. `px` is taken as it is: wrap it first. */
export function maskBit(mask: LandMask, px: number, py: number): boolean {
  if (py < 0 || py >= mask.h || px < 0 || px >= mask.w) return false;
  const i = py * mask.w + px;
  return ((mask.bits[i >> 3]! >> (i & 7)) & 1) === 1;
}

/**
 * Whether (`x`, `y`), in cells of a map `mapW` × `mapH` cells wide and high, is on land. On a
 * map that loops (`wrapX`) x is taken modulo its width; on one that does not, there is no land
 * beyond its edges.
 */
export function maskLand(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): boolean {
  let px = Math.floor((x * mask.w) / mapW);
  if (wrapX) px = ((px % mask.w) + mask.w) % mask.w;
  return maskBit(mask, px, Math.floor((y * mask.h) / mapH));
}

/**
 * How far the drawn shore's noise can move the field, at a half (the shader takes it from
 * here). `SURE_LAND` is safe for this much and no more: a larger noise needs a larger margin,
 * and the unit test of the two holds them together.
 */
export const SHORE_NOISE = 0.35;
/** The least of `maskField` at which a place is land in the mask and in every picture of it. */
export const SURE_LAND = 0.85;

/**
 * How much land the four mask pixels round (`x`, `y`) hold, 0–1: their bits blended by how near
 * each pixel's middle is. At a pixel's middle it is that pixel's bit; on the edge between a
 * land pixel and a water pixel it is a half. Sums and products of doubles only: every engine
 * gives the same number.
 */
export function maskField(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): number {
  const mx = (x * mask.w) / mapW - 0.5;
  const my = (y * mask.h) / mapH - 0.5;
  const x0 = Math.floor(mx);
  const y0 = Math.floor(my);
  const tx = mx - x0;
  const ty = my - y0;
  const at = (px: number, py: number): number => (maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py) ? 1 : 0);
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

/**
 * Whether cell (`cx`, `cy`) is inland: its mask pixels and the ring of pixels round them are
 * all land. Every place in such a cell is surely land (the four pixels round any of them are
 * among those), so who asks often can ask this once for a cell and remember it.
 */
export function cellInland(mask: LandMask, mapW: number, cx: number, cy: number, wrapX: boolean): boolean {
  const k = Math.round(mask.w / mapW);
  for (let py = cy * k - 1; py <= cy * k + k; py++) {
    for (let px = cx * k - 1; px <= cx * k + k; px++) {
      if (!maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py)) return false;
    }
  }
  return true;
}

/** Whether (`x`, `y`) is surely land: in a land pixel of the mask, and land in the picture drawn from it. */
export function maskSure(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): boolean {
  return maskField(mask, mapW, mapH, x, y, wrapX) >= SURE_LAND;
}

/**
 * The land point of cell (`cx`, `cy`) of a map `mapW` cells wide: the middle of the mask pixel of that cell that is
 * furthest from water, in cells; null when the cell has no land pixel. A formation that would
 * stand on water takes it (PLAN 2.9a): it is where a block of elements has most room.
 *
 * - Distance is to the nearest water pixel within a cell's width of the cell (beyond that the
 *   answer would not change which pixel wins by enough to matter, and the cost stays small).
 * - Ties go to the pixel nearest the cell's middle, then to the first in row order: whole
 *   numbers throughout, so every engine gives the same point.
 */
export function landPoint(mask: LandMask, mapW: number, cx: number, cy: number, wrapX: boolean): [number, number] | null {
  const k = Math.round(mask.w / mapW); // mask pixels to a cell
  const x0 = cx * k;
  const y0 = cy * k;
  const at = (px: number, py: number): boolean => maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py);
  let best = -1;
  let bestMid = 0;
  let bx = 0;
  let by = 0;
  for (let py = y0; py < y0 + k; py++) {
    for (let px = x0; px < x0 + k; px++) {
      if (!at(px, py)) continue;
      // The square of the distance to the nearest water pixel in the window, in pixels.
      let near = 2 * k * k + 1;
      for (let qy = y0 - k; qy < y0 + 2 * k && near > 1; qy++) {
        for (let qx = x0 - k; qx < x0 + 2 * k; qx++) {
          if (at(qx, qy)) continue;
          const d = (qx - px) * (qx - px) + (qy - py) * (qy - py);
          if (d < near) near = d;
        }
      }
      // Twice the distance from the cell's middle, squared, in half pixels: whole numbers.
      const mid = (2 * (px - x0) + 1 - k) ** 2 + (2 * (py - y0) + 1 - k) ** 2;
      if (near > best || (near === best && mid < bestMid)) {
        best = near;
        bestMid = mid;
        bx = px;
        by = py;
      }
    }
  }
  if (best < 0) return null;
  return [(bx + 0.5) / k, (by + 0.5) / k];
}

/**
 * Gives cell (`cx`, `cy`) of a map `mapW` cells wide an islet where the mask has no land pixel
 * in it: the cell's pixels but for its corners, cut a quarter of the cell deep (rows of 4, 6
 * and 8 pixels on the M map, 52 of the 64). True when the mask changed; a cell with any land
 * pixel is left alone, so a second call changes nothing.
 *
 * It is for land the game has and the mask's source is too coarse to show (an atoll that the
 * scenario owns: PLAN 2.15e2b, ADR-105). Every reader of the mask takes it for land: the
 * cell's middle is surely land (the four pixels round it), a formation's elements have the
 * width of a cell to stand on, and each quarter of the cell is more than half land (13 of 16),
 * which is what the coverage drawn at T0 and T1 asks (`buildLandCoverage` at two texels to a
 * cell). Smaller, it was a square speck at T1 (6 × 6: 9 of 16) or nothing (4 × 4).
 */
export function addIslet(mask: LandMask, mapW: number, cx: number, cy: number): boolean {
  const k = Math.round(mask.w / mapW);
  const x0 = cx * k;
  const y0 = cy * k;
  for (let py = y0; py < y0 + k; py++) {
    for (let px = x0; px < x0 + k; px++) if (maskBit(mask, px, py)) return false;
  }
  const cut = Math.floor(k / 4);
  for (let r = 0; r < k; r++) {
    const inset = Math.max(0, cut - Math.min(r, k - 1 - r));
    for (let px = x0 + inset; px < x0 + k - inset; px++) {
      const i = (y0 + r) * mask.w + px;
      mask.bits[i >> 3] = mask.bits[i >> 3]! | (1 << (i & 7));
    }
  }
  return true;
}
