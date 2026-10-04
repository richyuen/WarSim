import { describe, expect, it } from 'vitest';
import { decodeAdmin1, encodeAdmin1, type Admin1Meta } from '../../src/shared/admin1';
import { xxhash32View } from '../../src/sim/core/hash';
import { project } from '../../src/sim/data/projection';
import { buildProvinceRaster } from '../../src/sim/data/provinces';
import { earthAsset } from '../helpers/earth';

const geo = decodeAdmin1(earthAsset('admin1-geometry'));
const meta = JSON.parse(earthAsset('admin1-meta').toString('utf8')) as Admin1Meta[];

describe('admin-1 assets', () => {
  it('geometry and metadata line up and the codec round-trips', () => {
    expect(geo.provinces.length).toBe(meta.length);
    expect(meta.length).toBe(4596);
    expect(geo.vertexCount).toBeGreaterThan(1_000_000);
    meta.forEach((m, i) => expect(m.id).toBe(i + 1));
    const sample = geo.provinces.slice(0, 50);
    expect(decodeAdmin1(encodeAdmin1(sample)).provinces).toEqual(sample);
  });
});

describe('province raster (PLAN 0.19)', () => {
  for (const [w, h] of [[1024, 512], [2048, 1024]] as const) {
    it(`every source province is present at ${w}×${h}`, () => {
      const r = buildProvinceRaster(geo, meta, w, h);
      expect(r.missing).toEqual([]);
      for (let id = 1; id <= meta.length; id++) expect(r.cells[id], meta[id - 1]!.name).toBeGreaterThan(0);
      let sum = 0;
      for (const c of r.cells) sum += c;
      expect(sum).toBe(w * h);
    });
  }

  const r = buildProvinceRaster(geo, meta, 2048, 1024);
  const at = (lon: number, lat: number): Admin1Meta => {
    const [u, v] = project(lon, lat);
    const id = r.ids[Math.floor(v * 1024) * 2048 + Math.floor(u * 2048)]!;
    return meta[id - 1]!;
  };

  it('known places fall in the right province (M size)', () => {
    expect(at(13.4, 52.52).name).toBe('Berlin');
    expect(at(21.0, 52.23).adm0).toBe('POL');
    expect(at(20.5, 54.7).name).toMatch(/Kaliningrad/);
    expect(at(24.03, 49.84).adm0).toBe('UKR'); // Lviv
    expect(at(2.35, 48.86).adm0).toBe('FRA');
    expect(at(-73.75, 42.65).name).toBe('New York'); // Albany (Manhattan's cell borders New Jersey)
    expect(at(139.7, 35.7).adm0).toBe('JPN');
    expect(at(-30, 30)).toBeUndefined(); // open Atlantic: no province
  });

  it('is deterministic (same hash on rebuild)', () => {
    expect(xxhash32View(buildProvinceRaster(geo, meta, 2048, 1024).ids)).toBe(xxhash32View(r.ids));
  });
});
