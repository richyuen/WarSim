import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import straitsJson from '../../data/maps/earth/straits.json';
import { Terrain, TERRAIN_IDS } from '../../src/shared/terrain';
import { millerLat, Y_TOP } from '../../src/sim/data/projection';
import { applyCrossings, cellOf, loadTerrain, segmentCells, straitPath, type StraitDef } from '../../src/sim/data/terrain';
import golden from './terrain-golden.json';

// PLAN 1.2: the derived terrain (tools/data/terrain.ts) is geographically right at known places,
// stays within ±10% of the golden class counts, has plausible area shares, and every strait in
// data/maps/earth/straits.json becomes a land-to-land crossing at both shipped sizes.

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');
const straits = straitsJson.straits as unknown as StraitDef[];
const SIZES = [[2048, 1024], [1024, 512]] as const;

function load(w: number, h: number): Uint8Array {
  return loadTerrain(new Uint8Array(gunzipSync(readFileSync(path.join(dir, `terrain-${w}x${h}.u8.wsz`)))), w, h, straits).terrain;
}

const KNOWN: [string, number, number, readonly string[]][] = [
  ['Sahara', 10, 24, ['desert']],
  ['Rub al Khali', 50, 20, ['desert']],
  ['Gobi', 105, 43, ['desert']],
  ['Amazon', -60, -5, ['forest']],
  ['Congo', 22, 0, ['forest']],
  ['Siberian taiga', 100, 60, ['forest']],
  ['Everest', 86.9, 27.95, ['mountains']],
  ['Alps (Monte Rosa)', 7.8, 46.0, ['mountains']],
  ['Caucasus', 43, 42.8, ['mountains']],
  ['Tibetan plateau', 88, 33, ['hills', 'mountains']],
  ['Greenland ice sheet', -40, 75, ['ice']],
  ['Ukraine', 32, 49, ['plains']],
  ['Poland', 19, 52, ['plains']],
  ['North China plain', 116, 37, ['plains']],
  ['Kazakh steppe', 68, 48, ['grassland']],
  ['Mongolian steppe', 105, 47, ['grassland']],
  ['Pripyat marshes', 27, 52, ['marsh']],
  ['Sudd', 30.5, 8, ['marsh']],
  ['Taymyr', 100, 72, ['tundra']],
  ['Canadian Barrens', -100, 65, ['tundra']],
  ['Lake Superior', -87.5, 47.6, ['water']],
  ['central Atlantic', -30, 30, ['water']],
];

describe.each(SIZES)('terrain %i×%i (PLAN 1.2)', (w, h) => {
  const t = load(w, h);
  const at = (lon: number, lat: number): string => {
    const [x, y] = cellOf(lon, lat, w, h);
    return TERRAIN_IDS[t[Math.floor(y) * w + Math.floor(x)]!]!;
  };

  it('known places have the expected class', () => {
    const wrong = KNOWN.filter(([, lon, lat, ok]) => !ok.includes(at(lon, lat))).map(([n, lon, lat, ok]) => `${n}: ${at(lon, lat)} (want ${ok.join('|')})`);
    expect(wrong).toEqual([]);
  });

  it('class counts are within ±10% of the golden counts', () => {
    const want = (golden as Record<string, Record<string, number>>)[`${w}x${h}`]!;
    const got: Record<string, number> = {};
    for (const id of TERRAIN_IDS) got[id] = 0;
    for (const v of t) got[TERRAIN_IDS[v]!]!++;
    for (const id of TERRAIN_IDS) {
      const g = want[id]!;
      expect(Math.abs(got[id]! - g), `${id}: ${got[id]} vs golden ${g}`).toBeLessThanOrEqual(Math.max(2, 0.1 * g));
    }
  });

  it('area-weighted shares of land agree with published figures', () => {
    const area = new Float64Array(TERRAIN_IDS.length);
    for (let y = 0; y < h; y++) {
      const a = Math.sin(millerLat(Y_TOP - (y / h) * Math.PI)) - Math.sin(millerLat(Y_TOP - ((y + 1) / h) * Math.PI));
      for (let x = 0; x < w; x++) area[t[y * w + x]!]! += a;
    }
    let land = 0;
    for (let k = Terrain.Plains; k < TERRAIN_IDS.length; k++) land += area[k]!;
    const share = (k: number): number => area[k]! / land;
    // FAO FRA 2020: forest is 31% of land; forested hills/mountains are classed by relief here.
    expect(share(Terrain.Forest)).toBeGreaterThan(0.12);
    expect(share(Terrain.Forest)).toBeLessThan(0.4);
    // UNEP-WCMC (Kapos et al. 2000): ~24% of land is mountainous.
    expect(share(Terrain.Hills) + share(Terrain.Mountains)).toBeGreaterThan(0.15);
    expect(share(Terrain.Hills) + share(Terrain.Mountains)).toBeLessThan(0.35);
    // Arid + hyper-arid drylands are ~19% of land (UNEP); semi-arid steppe is grassland here.
    expect(share(Terrain.Desert)).toBeGreaterThan(0.08);
    expect(share(Terrain.Desert)).toBeLessThan(0.25);
    // Greenland's ice sheet (1.7 M km²) is ~1.3% of land; Antarctica is mostly south of the crop.
    expect(share(Terrain.Ice)).toBeGreaterThan(0.005);
    expect(share(Terrain.Ice)).toBeLessThan(0.03);
    expect(share(Terrain.Tundra)).toBeGreaterThan(0.03);
    expect(share(Terrain.Tundra)).toBeLessThan(0.15);
  });

  it('every strait links land on both shores through crossing cells', () => {
    const base = new Uint8Array(gunzipSync(readFileSync(path.join(dir, `terrain-${w}x${h}.u8.wsz`))));
    expect(base.includes(Terrain.Crossing)).toBe(false); // crossings are data, not baked in
    const res = applyCrossings(base, w, h, straits);
    expect(res.filter((r) => !r.linked).map((r) => r.id)).toEqual([]);
    for (const s of straits) {
      const p = straitPath(s, w, h);
      const first = p.findIndex((c) => base[c]! >= Terrain.Plains);
      const last = p.length - 1 - [...p].reverse().findIndex((c) => base[c]! >= Terrain.Plains);
      for (let i = first; i <= last; i++) expect(base[p[i]!], `${s.id} cell ${i}`).not.toBe(Terrain.Water);
    }
    expect(res.reduce((n, r) => n + r.cells, 0)).toBeGreaterThan(straits.length);
  });
});

describe('terrain helpers', () => {
  it('segmentCells returns a 4-connected path between the end cells', () => {
    const w = 64;
    const p = segmentCells(3.2, 4.7, 20.9, 15.1, w, 32);
    expect(p[0]).toBe(4 * w + 3);
    expect(p[p.length - 1]).toBe(15 * w + 20);
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1]!, p[i]!];
      expect(Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w))).toBe(1);
    }
  });

  it('a strait across the date line takes the short way', () => {
    const p = straitPath({ id: 'x', nameKey: 'strait.x', a: [179.9, 0], b: [-179.9, 0] }, 2048, 1024);
    expect(p.length).toBeLessThan(2 * 4 + 3);
  });

  it('loadTerrain rejects a raster of the wrong size', () => {
    expect(() => loadTerrain(new Uint8Array(10), 4, 4, [])).toThrow(/expected 4×4/);
  });
});
