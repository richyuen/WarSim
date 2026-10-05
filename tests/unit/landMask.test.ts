import { describe, expect, it } from 'vitest';
import { cellInland, landPoint, maskBit, maskField, maskLand, maskSure, SHORE_NOISE, SURE_LAND, type LandMask } from '../../src/shared/landMask';

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

  it('the field: a pixel’s bit at its middle, a half on a straight coast, and surely land only inside a land pixel', () => {
    // Land east of pixel column 12; 8 px to a cell: the coast is the line x = 1.5 cells.
    const m = mask(4, 2, 8, (px) => px >= 12);
    const f = (x: number, y = 1): number => maskField(m, 4, 2, x, y, false);
    expect(f((12 + 0.5) / 8)).toBe(1); // the middle of the first land pixel
    expect(f((11 + 0.5) / 8)).toBe(0); // and of the last water pixel
    expect(f(1.5)).toBeCloseTo(0.5, 12); // on the coast
    expect(f(1.5 + 0.25 / 8)).toBeCloseTo(0.75, 12);
    expect(f(3)).toBe(1);
    // Surely land: from 0.35 of a pixel inside the coast on.
    expect(maskSure(m, 4, 2, 1.5 + 0.34 / 8, 1, false)).toBe(false);
    expect(maskSure(m, 4, 2, 1.5 + 0.36 / 8, 1, false)).toBe(true);
    // Never in a water pixel, whatever stands round it: a lake of one pixel in the land.
    const lake = mask(4, 2, 8, (px, py) => !(px === 20 && py === 8));
    let most = 0;
    for (let dy = 0; dy <= 10; dy++) for (let dx = 0; dx <= 10; dx++) most = Math.max(most, maskField(lake, 4, 2, (20 + dx / 10) / 8, (8 + dy / 10) / 8, false));
    expect(most).toBeLessThanOrEqual(0.75);
    expect(most).toBeLessThan(SURE_LAND);
    // The noise of the drawn shore, at its largest, leaves a surely-land place land: SHORE_NOISE × 4f(1 − f) off f,
    // at SURE_LAND and at every field above it.
    for (let f = SURE_LAND; f <= 1; f += 0.01) expect(f - SHORE_NOISE * 4 * f * (1 - f), `a field of ${f.toFixed(2)}`).toBeGreaterThan(0.5);
    // And a place that is not surely land in a land pixel can be drawn as sea: the margin is needed.
    expect(0.6 - SHORE_NOISE * 4 * 0.6 * 0.4).toBeLessThan(0.5);
  });

  it('an inland cell: its pixels and the ring round them are land, and then every place in it is surely land', () => {
    const m = mask(4, 4, 8, (px, py) => !(px === 17 && py === 15)); // one pixel of water just above cell (2, 2)... in cell (2, 1)
    expect(cellInland(m, 4, 1, 2, false)).toBe(true);
    expect(cellInland(m, 4, 2, 2, false)).toBe(false); // the water touches its ring
    expect(cellInland(m, 4, 2, 1, false)).toBe(false); // and lies in this one
    for (let dy = 0; dy <= 8; dy++) for (let dx = 0; dx <= 8; dx++) expect(maskSure(m, 4, 4, 1 + dx / 8, 2 + dy / 8, false)).toBe(true);
    // At the map's edge there is no land beyond: not inland on a map that does not loop.
    expect(cellInland(m, 4, 0, 2, false)).toBe(false);
    expect(cellInland(m, 4, 0, 2, true)).toBe(true);
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
