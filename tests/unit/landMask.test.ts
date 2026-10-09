import { describe, expect, it } from 'vitest';
import { cellInland, landPoint, landWay, waterPoint, lineClear, maskBit, maskField, maskLand, maskSure, SHORE_NOISE, SURE_LAND, type LandMask } from '../../src/shared/landMask';

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

  it('the water point of a cell is the middle of its water pixel furthest from land (PLAN 4.2b)', () => {
    // Cell (1, 1) of a 3 × 3 map: its west half is sea (and all of the cells west of it).
    const half = mask(3, 3, 8, (px) => px >= 12);
    const p = waterPoint(half, 3, 1, 1, false)!;
    // The west edge of the cell is 4 px from the land; of that column, the row at the middle.
    expect(p[0]).toBeCloseTo(1 + 0.5 / 8, 12);
    expect(Math.abs(p[1] - 1.5)).toBeLessThan(1 / 8);
    expect(maskLand(half, 3, 3, p[0], p[1], false)).toBe(false);
    // A cell of water with water all round: its middle; one without water: none.
    const mid = waterPoint(mask(3, 3, 8, () => false), 3, 1, 1, false)!;
    expect(Math.abs(mid[0] - 1.5)).toBeLessThanOrEqual(0.5 / 8);
    expect(Math.abs(mid[1] - 1.5)).toBeLessThanOrEqual(0.5 / 8);
    expect(waterPoint(half, 3, 2, 1, false)).toBeNull();
    // A pond of 3 × 3 px in a cell of land: its middle pixel.
    const pond = mask(3, 3, 8, (px, py) => !(px >= 13 && px < 16 && py >= 13 && py < 16));
    expect(waterPoint(pond, 3, 1, 1, false)).toEqual([1 + 6.5 / 8, 1 + 6.5 / 8]);
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
  // PLAN 4.1d2: the way of a march's step below the cell.
  describe('the way over land between two places', () => {
    /** Each place of the line, 16 to a pixel's width, is surely land. */
    const sure = (m: LandMask, mapW: number, mapH: number, line: Float64Array, wrapX: boolean): boolean => {
      for (let i = 2; i < line.length; i += 2) {
        for (let j = 0; j <= 256; j++) {
          const t = j / 256;
          if (!maskSure(m, mapW, mapH, line[i - 2]! + (line[i]! - line[i - 2]!) * t, line[i - 1]! + (line[i + 1]! - line[i - 1]!) * t, wrapX)) return false;
        }
      }
      return true;
    };
    // Cells (1, 1) and (2, 1) of a 4 × 3 map: a bay 4 px wide comes down between their middles to 2 px below them.
    const bay = mask(4, 3, 8, (px, py) => !(px >= 14 && px < 18 && py < 14));

    it('a clear line has no way: the straight line is it', () => {
      const found = { clear: false };
      expect(landWay(bay, 4, [1.5, 2.5], [2.5, 2.5], false, found)).toBeNull();
      expect(found.clear).toBe(true);
      expect(lineClear(bay, 12, 20, 20, 20, false)).toBe(true);
      // Along the bay's foot, a quarter of a pixel into the first row of land: the squares it passes hold water pixels.
      expect(lineClear(bay, 12, 14.25, 20, 14.25, false)).toBe(false);
      // Along that row's middles it is between land pixels only.
      expect(lineClear(bay, 12, 14.5, 20, 14.5, false)).toBe(true);
    });

    it('round a bay: from the one place to the other, every place of it surely land', () => {
      const found = { clear: true };
      const way = landWay(bay, 4, [1.5, 1.5], [2.5, 1.5], false, found)!;
      expect(found.clear).toBe(false);
      expect([way[0], way[1]]).toEqual([1.5, 1.5]);
      expect([way[way.length - 2], way[way.length - 1]]).toEqual([2.5, 1.5]);
      expect(sure(bay, 4, 3, way, false)).toBe(true);
      // It goes below the bay's foot (row 14), and no further than it must: by the two corners under the bay.
      let low = 0;
      let len = 0;
      for (let i = 0; i < way.length; i += 2) low = Math.max(low, way[i + 1]!);
      for (let i = 2; i < way.length; i += 2) len += Math.hypot(way[i]! - way[i - 2]!, way[i + 1]! - way[i - 1]!);
      expect(low).toBeGreaterThan(14 / 8);
      expect(low).toBeLessThanOrEqual(15.5 / 8);
      expect(len).toBeLessThan(1.6);
      expect(way.length).toBeLessThanOrEqual(2 * 5);
      // The straight line is over the bay's water.
      expect(maskLand(bay, 4, 3, 2, 1.5, false)).toBe(false);
    });

    it('the same way whatever was asked before, and from a pixel’s middle as from a cell’s', () => {
      const a = landWay(bay, 4, [1.5, 1.5], [2.5, 1.5], false);
      landWay(bay, 4, [2.5, 1.5], [1.5, 1.5], false);
      expect(landWay(bay, 4, [1.5, 1.5], [2.5, 1.5], false)).toEqual(a);
      const way = landWay(bay, 4, [1 + 4.5 / 8, 1 + 3.5 / 8], [2 + 6.5 / 8, 1 + 2.5 / 8], false)!;
      expect([way[0], way[1]]).toEqual([1 + 4.5 / 8, 1 + 3.5 / 8]);
      expect([way[way.length - 2], way[way.length - 1]]).toEqual([2 + 6.5 / 8, 1 + 2.5 / 8]);
      expect(sure(bay, 4, 3, way, false)).toBe(true);
      // No place twice.
      for (let i = 2; i < way.length; i += 2) expect(way[i] === way[i - 2] && way[i + 1] === way[i - 1]).toBe(false);
    });

    it('water all the way between them (a river, a strait): no way, and the line is not clear', () => {
      const river = mask(4, 3, 8, (px) => px !== 16);
      const found = { clear: true };
      expect(landWay(river, 4, [1.5, 1.5], [2.5, 1.5], false, found)).toBeNull();
      expect(found.clear).toBe(false);
      // A river that only touches at a corner is closed too: no corner of water is cut.
      const stair = mask(4, 3, 8, (px, py) => px !== 4 + py && px !== 5 + py);
      expect(landWay(stair, 4, [1.5, 1.5], [2.5, 1.5], false)).toBeNull();
      const thin = mask(4, 3, 8, (px, py) => px !== 4 + py);
      expect(landWay(thin, 4, [1.5, 1.5], [2.5, 1.5], false)).toBeNull();
    });

    it('a way keeps to the box of the two cells, and to the cells beside it that are open', () => {
      // The bay of the first test, down to the foot of the two cells (their rows are 8 to 15) and 6 px on: the land way is in the cells below.
      const long = mask(4, 4, 8, (px, py) => !(px >= 14 && px < 18 && py < 22));
      const found = { clear: true };
      expect(landWay(long, 4, [1.5, 1.5], [2.5, 1.5], false, found)).toBeNull();
      expect(found.clear).toBe(false);
      // With the cells below open it goes through them, and through no other.
      const asked: string[] = [];
      const below = landWay(long, 4, [1.5, 1.5], [2.5, 1.5], false, undefined, (cx, cy) => {
        asked.push(`${cx},${cy}`);
        return cy === 2;
      })!;
      expect(sure(long, 4, 4, below, false)).toBe(true);
      let low = 0;
      for (let i = 0; i < below.length; i += 2) {
        low = Math.max(low, below[i + 1]!);
        expect(below[i + 1]).toBeGreaterThan(1);
        expect(below[i]).toBeGreaterThan(1);
        expect(below[i]).toBeLessThan(3);
      }
      expect(low).toBeGreaterThan(22 / 8);
      expect(asked.length).toBeGreaterThan(0);
      // The cells of the box are not asked about: they are the step's own.
      expect(asked).not.toContain('1,1');
      expect(asked).not.toContain('2,1');
      // With only the cell below the first open, there is none: the way would cut the corner into the other.
      expect(landWay(long, 4, [1.5, 1.5], [2.5, 1.5], false, undefined, (cx, cy) => cx === 1 && cy === 2)).toBeNull();
      // No further than a cell beyond the box, whatever is open.
      const longer = mask(4, 5, 8, (px, py) => !(px >= 14 && px < 18 && py < 30));
      expect(landWay(longer, 4, [1.5, 1.5], [2.5, 1.5], false, undefined, () => true)).toBeNull();
      // A step on the diagonal has the four cells of its box: round a pond on the shared corner.
      const pond = mask(4, 4, 8, (px, py) => !(px >= 14 && px < 18 && py >= 14 && py < 18));
      const round = landWay(pond, 4, [1.5, 1.5], [2.5, 2.5], false)!;
      expect(sure(pond, 4, 4, round, false)).toBe(true);
      for (let i = 0; i < round.length; i += 2) {
        expect(round[i]).toBeGreaterThan(1);
        expect(round[i]).toBeLessThan(3);
        expect(round[i + 1]).toBeGreaterThan(1);
        expect(round[i + 1]).toBeLessThan(3);
      }
    });

    it('over the seam of a map that loops, x unfolded; none on a map with edges', () => {
      // Cells (3, 1) and (0, 1): the bay lies on the seam.
      const seam = mask(4, 3, 8, (px, py) => !((px >= 30 || px < 2) && py < 14));
      const way = landWay(seam, 4, [3.5, 1.5], [4.5, 1.5], true)!;
      expect([way[way.length - 2], way[way.length - 1]]).toEqual([4.5, 1.5]);
      expect(sure(seam, 4, 3, way, true)).toBe(true);
      expect(landWay(seam, 4, [3.5, 1.5], [4.5, 1.5], false)).toBeNull();
    });
  });
});
