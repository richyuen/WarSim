import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeElevation, encodeElevation, halveElevation } from '../../src/shared/elevation';
import { project } from '../../src/sim/data/projection';
import { earthFile } from '../helpers/earth';

// PLAN 0.18: the committed runtime map assets match public/data/earth/manifest.json and are
// geographically sane (projection, land mask and elevation agree with known places).

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');

interface Asset {
  path: string;
  kind: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as {
  projection: { type: string; latTopDeg: number; latBottomDeg: number };
  assets: Asset[];
  sources: { id: string; sha256: string; license: string }[];
};

const load = (a: Asset): Uint8Array => earthFile(a.path);
const asset = (kind: string, w: number): Asset => {
  const a = manifest.assets.find((x) => x.kind === kind && x.width === w);
  if (!a) throw new Error(`no ${kind} asset at width ${w}`);
  return a;
};

describe('data manifest', () => {
  it('every asset exists with the recorded size and sha256; sources are pinned', () => {
    expect(manifest.assets.length).toBeGreaterThanOrEqual(4);
    for (const a of manifest.assets) {
      const b = readFileSync(path.join(dir, a.path));
      expect(b.byteLength, a.path).toBe(a.bytes);
      expect(createHash('sha256').update(b).digest('hex'), a.path).toBe(a.sha256);
    }
    for (const s of manifest.sources) {
      expect(s.sha256, s.id).toMatch(/^[0-9a-f]{64}$/);
      expect(s.license, s.id).toMatch(/Public domain/);
    }
    expect(manifest.projection).toMatchObject({ type: 'miller', latTopDeg: 80 });
    expect(manifest.projection.latBottomDeg).toBeCloseTo(-64.165, 3);
  });

  const maskAsset = asset('landmask', 16384);
  const bits = load(maskAsset);
  const isLand = (lon: number, lat: number): boolean => {
    const [u, v] = project(lon, lat);
    const x = Math.floor(u * maskAsset.width);
    const y = Math.floor(v * maskAsset.height);
    const i = y * maskAsset.width + x;
    return ((bits[i >> 3]! >> (i & 7)) & 1) === 1;
  };

  it('land mask: size, land fraction and known places', () => {
    expect(bits.length).toBe((maskAsset.width * maskAsset.height) / 8);
    let land = 0;
    for (const b of bits) for (let k = 0; k < 8; k++) land += (b >> k) & 1;
    const frac = land / (maskAsset.width * maskAsset.height);
    // Miller inflates high-latitude land (Greenland, Siberia). PLAN 1.2 cut natural lakes out of
    // the mask: 0.3015 → 0.2990 (−0.83% of land; lakes are ~1–2% of Earth's land area).
    expect(frac).toBeGreaterThan(0.29);
    expect(frac).toBeLessThan(0.45);
    // Natural lakes are water (PLAN 1.2), and lake islands stay land.
    const lakePts: [number, number][] = [[-87.5, 47.6], [31.5, 60.8], [33, -1], [108, 53.5], [-82.5, 44.8], [-69.4, -15.8]];
    for (const [lon, lat] of lakePts) expect(isLand(lon, lat), `lake at ${lon},${lat}`).toBe(false);
    expect(isLand(-88.9, 48), 'Isle Royale (Lake Superior)').toBe(true);
    const landPts: [number, number][] = [[2.35, 48.85], [13.4, 52.52], [37.6, 55.75], [139.7, 35.7], [-74, 40.75], [10, 25], [-60, -10], [134, -25]];
    const seaPts: [number, number][] = [[-30, 30], [-150, 0], [80, -20], [18, 35], [5, 55], [-90, 25]];
    for (const [lon, lat] of landPts) expect(isLand(lon, lat), `land at ${lon},${lat}`).toBe(true);
    for (const [lon, lat] of seaPts) expect(isLand(lon, lat), `sea at ${lon},${lat}`).toBe(false);
  });

  const e2048 = asset('elevation', 2048);
  const elev = decodeElevation(load(e2048), 2048, 1024);
  const elevAt = (lon: number, lat: number): number => {
    const [u, v] = project(lon, lat);
    return elev[Math.floor(v * 1024) * 2048 + Math.floor(u * 2048)]!;
  };

  it('elevation: known relief and agreement with the land mask', () => {
    expect(elevAt(87, 31)).toBeGreaterThan(4000); // Tibetan plateau
    expect(elevAt(-30, 30)).toBeLessThan(-3000); // central Atlantic
    expect(elevAt(142.5, 11.3)).toBeLessThan(-6000); // Mariana trench region
    expect(elevAt(10, 46.5)).toBeGreaterThan(1000); // Alps
    let agree = 0;
    let n = 0;
    for (let lat = -60; lat <= 78; lat += 1.7) {
      for (let lon = -179; lon <= 179; lon += 1.3) {
        n++;
        if (isLand(lon, lat) === elevAt(lon, lat) >= 0) agree++;
      }
    }
    expect(agree / n).toBeGreaterThan(0.93);
  });

  it('elevation pyramid levels are exact 2×2 reductions of the level above', () => {
    let prev = elev;
    let w = 2048;
    for (const lw of [1024, 512]) {
      const lvl = decodeElevation(load(asset('elevation', lw)), lw, lw / 2);
      expect(lvl).toEqual(halveElevation(prev, w, w / 2));
      prev = lvl;
      w = lw;
    }
  });
});

describe('elevation codec', () => {
  it('round-trips extremes and sign changes exactly', () => {
    const w = 7;
    const h = 3;
    const v = Int16Array.from([-11000, 9000, 0, -1, 1, 32767, -32768, 5, -5, 8848, -10990, 0, 0, 1, -32768, 32767, 100, -100, 3, 4, 5]);
    expect(decodeElevation(encodeElevation(v, w, h), w, h)).toEqual(v);
  });
});
