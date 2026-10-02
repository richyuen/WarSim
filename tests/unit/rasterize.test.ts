import { describe, expect, it } from 'vitest';
import { getBit, rasterizePolygon, setBits } from '../../src/sim/data/rasterize';
import { kmPerCell, LAT_BOTTOM_DEG, project, rowScales, unproject } from '../../src/sim/data/projection';

function raster(rings: number[][], w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  rasterizePolygon(rings.map((r) => Float64Array.from(r)), w, h, (y, x0, x1) => {
    for (let x = x0; x < x1; x++) g[y * w + x] = 1;
  });
  return g;
}

const count = (g: Uint8Array): number => g.reduce((a, b) => a + b, 0);

describe('rasterizePolygon', () => {
  it('fills exactly the cells whose centres are inside an axis-aligned square', () => {
    const g = raster([[2, 3, 7, 3, 7, 8, 2, 8]], 10, 10);
    expect(count(g)).toBe(25);
    expect(g[3 * 10 + 2]).toBe(1);
    expect(g[7 * 10 + 6]).toBe(1);
    expect(g[8 * 10 + 7]).toBe(0);
  });

  it('applies the even-odd rule for holes and is independent of ring orientation', () => {
    const outer = [0, 0, 10, 0, 10, 10, 0, 10];
    const hole = [3, 3, 3, 7, 7, 7, 7, 3];
    expect(count(raster([outer, hole], 10, 10))).toBe(100 - 16);
    expect(count(raster([[...outer].reverse()], 10, 10))).toBe(100);
  });

  it('clips to the grid and handles a triangle with the expected area', () => {
    // Hypotenuse x + y = 200 lies beyond the grid: every cell centre (x + y ≤ 199) is inside.
    expect(count(raster([[-5, -5, 205, -5, -5, 205]], 100, 100))).toBe(10_000);
    // Hypotenuse x + y = 100: centres with x + y + 1 < 100 → 99·100/2 = 4950 cells.
    expect(count(raster([[0, 0, 100, 0, 0, 100]], 100, 100))).toBe(4950);
    const t = raster([[0, 0, 400, 0, 0, 400]], 400, 400);
    expect(Math.abs(count(t) - 80000) / 80000).toBeLessThan(0.01);
  });

  it('setBits/getBit agree with a per-cell fill for arbitrary spans', () => {
    const w = 37;
    const bits = new Uint8Array(Math.ceil((w * 3) / 8));
    const ref = new Uint8Array(w * 3);
    for (const [y, a, b] of [[0, 0, 37], [1, 3, 29], [2, 8, 9], [2, 15, 33]] as const) {
      setBits(bits, w, y, a, b);
      for (let x = a; x < b; x++) ref[y * w + x] = 1;
    }
    for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) expect(getBit(bits, w, x, y)).toBe(ref[y * w + x] === 1);
  });
});

describe('Miller projection (ADR-7)', () => {
  it('maps the crop to a 2:1 extent with square cells', () => {
    expect(project(-180, 80)).toEqual([0, 0]);
    const [u, v] = project(180, LAT_BOTTOM_DEG);
    expect(u).toBe(1);
    expect(v).toBeCloseTo(1, 12);
    expect(LAT_BOTTOM_DEG).toBeCloseTo(-64.165, 3);
    expect(project(0, 0)[0]).toBe(0.5);
  });

  it('round-trips lon/lat and has the expected row scales', () => {
    for (const [lon, lat] of [[13.4, 52.5], [-74, 40.7], [151.2, -33.9], [179, 0]] as const) {
      const [u, v] = project(lon, lat);
      const [lo, la] = unproject(u, v);
      expect(lo).toBeCloseTo(lon, 9);
      expect(la).toBeCloseTo(lat, 9);
    }
    const { kx, ky } = rowScales(1024);
    const row = (lat: number): number => Math.floor(project(0, lat)[1] * 1024);
    expect(kx[row(0)]).toBeCloseTo(1, 3);
    expect(kx[row(60)]).toBeCloseTo(0.5, 2);
    expect(ky[row(60)]).toBeCloseTo(Math.cos(0.8 * (60 * Math.PI) / 180), 2);
    expect(kmPerCell(2048)).toBeCloseTo(19.57, 2);
  });
});
