import { describe, expect, it } from 'vitest';
import { landPoint, maskBit, maskLand, type LandMask } from '../../src/shared/landMask';

// PLAN 2.9a (ADR-79): the fine land mask, read one way by the sim, the renderer and the tests.

/** A mask for a map of `mw` × `mh` cells, `k` pixels to a cell, land where `land` says. */
function mask(mw: number, mh: number, k: number, land: (px: number, py: number) => boolean): LandMask {
  const w = mw * k;
  const h = mh * k;
  const bits = new Uint8Array(Math.ceil((w * h) / 8));
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++)
      if (land(px, py)) {
        const i = py * w + px;
        bits[i >> 3]! |= 1 << (i & 7);
      }
  return { w, h, bits };
}

describe('the fine land mask (PLAN 2.9a)', () => {
  it('a point is on land when the bit of the pixel that holds it is set', () => {
    // Land east of pixel column 12 (cell 1.5), 8 px to a cell.
    const m = mask(4, 2, 8, (px) => px >= 12);
    expect(maskBit(m, 11, 0)).toBe(false);
    expect(maskBit(m, 12, 0)).toBe(true);
    expect(maskLand(m, 4, 2, 1.49, 0.5, false)).toBe(false);
    expect(maskLand(m, 4, 2, 1.5, 0.5, false)).toBe(true);
    expect(maskLand(m, 4, 2, 3.999, 1.999, false)).toBe(true);
    // Outside the rows, and beyond the edges of a map that does not loop: no land.
    expect(maskLand(m, 4, 2, 2, -0.01, false)).toBe(false);
    expect(maskLand(m, 4, 2, 2, 2, false)).toBe(false);
    expect(maskLand(m, 4, 2, 4.2, 1, false)).toBe(false);
    expect(maskLand(m, 4, 2, -0.2, 1, false)).toBe(false);
    // On a map that loops, x goes round: 4.2 is 0.2 (sea here), -0.2 is 3.8 (land).
    expect(maskLand(m, 4, 2, 4.2, 1, true)).toBe(false);
    expect(maskLand(m, 4, 2, -0.2, 1, true)).toBe(true);
  });

  it('the land point of a cell is the middle of its pixel furthest from water', () => {
    // Cell (1, 1) of a 3 × 3 map: its west half is sea (and all of the cells west of it).
    const half = mask(3, 3, 8, (px) => px >= 12);
    const p = landPoint(half, 3, 1, 1, false)!;
    // The east edge of the cell is 4 px from the water; of that column, the row at the middle.
    expect(p[0]).toBeCloseTo(1 + 7.5 / 8, 12);
    expect(Math.abs(p[1] - 1.5)).toBeLessThan(1 / 8);
    expect(maskLand(half, 3, 3, p[0], p[1], false)).toBe(true);
    // A cell that is all land with land all round: its middle (the pixel nearest it; every pixel is as far from water).
    const all = mask(3, 3, 8, () => true);
    const mid = landPoint(all, 3, 1, 1, false)!;
    expect(Math.abs(mid[0] - 1.5)).toBeLessThanOrEqual(0.5 / 8);
    expect(Math.abs(mid[1] - 1.5)).toBeLessThanOrEqual(0.5 / 8);
    // A cell without land: none.
    expect(landPoint(half, 3, 0, 1, false)).toBeNull();
  });

  it('a spit: the point is on its widest part', () => {
    // In cell (1, 1): a strip 1 px wide along the top, and a block of 3 × 3 px at the bottom right.
    const spit = mask(3, 3, 8, (px, py) => (py === 8 && px >= 8 && px < 16) || (px >= 13 && px < 16 && py >= 13 && py < 16));
    const p = landPoint(spit, 3, 1, 1, false)!;
    expect(p).toEqual([1 + 6.5 / 8, 1 + 6.5 / 8]); // the block's middle pixel (14, 14)
  });

  it('the same point whatever is asked first, and on both sides of a looping map’s seam', () => {
    const m = mask(4, 2, 8, (px, py) => (px + 3 * py) % 5 !== 0 && px % 32 < 20);
    const a = landPoint(m, 4, 2, 1, true);
    landPoint(m, 4, 0, 0, true);
    expect(landPoint(m, 4, 2, 1, true)).toEqual(a);
    // Cell 3 looks east over the seam at cell 0: water there counts, as it would in the middle of the map.
    const seam = mask(4, 2, 8, (px) => px >= 8);
    const east = landPoint(seam, 4, 3, 0, true)!;
    const inner = landPoint(seam, 4, 2, 0, true)!;
    expect(east[0]).toBeLessThan(3.5); // pushed west, away from the sea across the seam
    expect(inner[0] - 2).toBeCloseTo(0.5 - 0.5 / 8, 12); // nothing near: the middle, by the tie's rule the first of the four middle pixels
    // The same map without the loop: beyond the east edge there is no land either, so the same answer.
    expect(landPoint(seam, 4, 3, 0, false)).toEqual(east);
  });
});
