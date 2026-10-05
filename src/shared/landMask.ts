/**
 * The fine land mask (SPEC §3.1): one bit a pixel, 1 = land, row-major, the lowest bit of a
 * byte first; 16384 × 8192 for the Earth, 8 px to a cell of the M map. The sim (where a
 * formation and its elements stand: PLAN 2.9a), the renderer (the coast of T2 and T3) and the
 * tests read it through this module, so that "land at (x, y)" has one meaning.
 *
 * **The convention:** a point is on land when the bit of the mask pixel that holds it is set.
 * No interpolation: the coast runs along pixel edges, and a picture that smooths it must not
 * say otherwise further than half a pixel from that line.
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
