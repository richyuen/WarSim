// Terrain derivation (PLAN 1.2): land mask + Natural Earth I land cover + ETOPO relief +
// wetland polygons → one terrain class per Miller cell. Tools only (Node).
//
// 1. One pass over NE1 (land-cover colour) and ETOPO (elevation): both are 21600×10800 grids
//    of 1′ pixels from 90°N/180°W, so the same pixel indices line up. Every land pixel (NE1
//    not pure-white ocean) is added to the M cell its centre projects into: colour sums, a
//    forest-pixel count, elevation sum and sum of squares.
// 2. Per land cell (land-mask coverage ≥ 50%):
//    - biome: the cell's mean colour is matched to the nearest labelled reference site, whose
//      colours are sampled from NE1 itself (REFERENCE_SITES, no hand-picked RGB);
//    - relief: the elevation standard deviation inside the cell gives hills and mountains;
//    - priority: ice > mountains > hills > marsh (wetland polygons, flat ground only) > biome;
//    - plausibility: no desert poleward of 52°, no ice equatorward of 58°.
//    Land cells without NE1 land pixels (tiny islands) take the most common class of their
//    classified neighbours.
// 3. S is the 2×2 mode of M (ties keep the first child in row order); land/water at S comes
//    from the land mask, so small islands survive or vanish the same way the coastline does.
import { fromFile, type GeoTIFFImage } from 'geotiff';
import { Terrain } from '../../src/shared/terrain';
import { millerLat, project, Y_TOP } from '../../src/sim/data/projection';
import { rasterizePolygon } from '../../src/shared/rasterize';

/** Labelled sites (lon, lat): their mean NE1 colour (31×31 px) is the class exemplar. */
export const REFERENCE_SITES: readonly [string, number, number, number][] = [
  // [name, terrain, lon, lat]
  ['Amazon basin', Terrain.Forest, -60, -5],
  ['Congo basin', Terrain.Forest, 22, 0],
  ['Central Siberian taiga', Terrain.Forest, 100, 60],
  ['Canadian boreal forest', Terrain.Forest, -85, 52],
  ['Appalachian forest', Terrain.Forest, -80, 38],
  ['Borneo', Terrain.Forest, 114, 1],
  ['Ukraine', Terrain.Plains, 32, 49],
  ['Paris basin', Terrain.Plains, 2, 47],
  ['Ganges plain', Terrain.Plains, 80, 26],
  ['North China plain', Terrain.Plains, 116, 37],
  ['Pampas', Terrain.Plains, -62, -35],
  ['US Corn Belt', Terrain.Plains, -92, 42],
  ['Kazakh steppe', Terrain.Grassland, 68, 48],
  ['Sahel', Terrain.Grassland, 5, 14],
  ['Mongolian steppe', Terrain.Grassland, 105, 47],
  ['High Plains', Terrain.Grassland, -103, 40],
  ['Patagonian steppe', Terrain.Grassland, -69, -45],
  ['Sahara', Terrain.Desert, 10, 24],
  ['Libyan desert', Terrain.Desert, 25, 25],
  ['Rub al Khali', Terrain.Desert, 50, 20],
  ['Taklamakan', Terrain.Desert, 83, 39],
  ['Gobi', Terrain.Desert, 105, 43],
  ['Simpson desert', Terrain.Desert, 137, -25.5],
  ['Great Victoria desert', Terrain.Desert, 128, -28.5],
  ['Gibson desert', Terrain.Desert, 124, -24],
  ['Taymyr tundra', Terrain.Tundra, 100, 73],
  ['Kolyma tundra', Terrain.Tundra, 155, 69],
  ['Canadian Barrens', Terrain.Tundra, -100, 65],
  ['Greenland ice sheet', Terrain.Ice, -40, 75],
  ['Antarctic ice sheet', Terrain.Ice, 30, -75],
];

/** Relief thresholds: elevation standard deviation (m) inside an M cell (~20 km). */
export const MOUNTAIN_STD_M = 280;
export const HILLS_STD_M = 110;
/** High plateaus (Tibet, Altiplano) are hills even when locally flat. */
export const HIGH_PLATEAU_M = 3000;
/** Climate plausibility: no desert poleward of this latitude (Arctic browns read as desert). */
export const DESERT_MAX_ABS_LAT = 52;
/** Ice only on the polar ice sheets (salt flats and high glaciers would otherwise read as ice). */
export const ICE_MIN_ABS_LAT = 58;
/** Marsh polygons only mark flat ground (std below this), so coarse outlines follow lowlands. */
export const MARSH_MAX_STD_M = 40;
/** NE1 pixels this far from the forest exemplar (RGB distance) count as forest pixels. */
const FOREST_PX_DIST = 22;

type Rgb = [number, number, number];

async function sampleSite(img: GeoTIFFImage, lon: number, lat: number): Promise<Rgb> {
  const x = Math.round((lon + 180) * 60);
  const y = Math.round((90 - lat) * 60);
  const R = 15;
  const r = (await img.readRasters({ window: [x - R, y - R, x + R + 1, y + R + 1], interleave: true })) as unknown as Uint8Array;
  const s: Rgb = [0, 0, 0];
  const n = r.length / 3;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[c]! += r[i * 3 + c]!;
  return [s[0] / n, s[1] / n, s[2] / n];
}

export interface TerrainBuild {
  /** M-size classes (w×h). */
  terrain: Uint8Array;
  w: number;
  h: number;
  /** Per-class exemplar colours actually used (for the log). */
  exemplars: { name: string; terrain: number; rgb: Rgb }[];
}

export interface TerrainInputs {
  ne1Path: string;
  etopoPath: string;
  /** Land mask bitset (maskW×maskH, LSB-first), lakes already cut out. */
  landBits: Uint8Array;
  maskW: number;
  maskH: number;
  /** Wetland polygons, rings in lon/lat. */
  wetlands: number[][][][];
}

export async function buildTerrain(w: number, h: number, inp: TerrainInputs): Promise<TerrainBuild> {
  const ne1 = await (await fromFile(inp.ne1Path)).getImage();
  const etopo = await (await fromFile(inp.etopoPath)).getImage();
  const sw = ne1.getWidth();
  const sh = ne1.getHeight();
  if (sw !== 21600 || sh !== 10800 || etopo.getWidth() !== sw || etopo.getHeight() !== sh) throw new Error('NE1/ETOPO grids differ');

  const exemplars: TerrainBuild['exemplars'] = [];
  for (const [name, t, lon, lat] of REFERENCE_SITES) exemplars.push({ name, terrain: t, rgb: await sampleSite(ne1, lon, lat) });
  const forestRgb = exemplars.filter((e) => e.terrain === Terrain.Forest).reduce<Rgb>((a, e, _, all) => [a[0] + e.rgb[0] / all.length, a[1] + e.rgb[1] / all.length, a[2] + e.rgb[2] / all.length], [0, 0, 0]);

  const n = w * h;
  const cnt = new Float64Array(n);
  const sr = new Float64Array(n);
  const sg = new Float64Array(n);
  const sb = new Float64Array(n);
  const forestPx = new Float64Array(n);
  const se = new Float64Array(n);
  const se2 = new Float64Array(n);
  const colOf = new Int32Array(sw);
  for (let x = 0; x < sw; x++) colOf[x] = Math.min(w - 1, Math.floor(((x + 0.5) / sw) * w));

  const BLOCK = 60;
  for (let y0 = 0; y0 < sh; y0 += BLOCK) {
    const y1 = Math.min(sh, y0 + BLOCK);
    // Skip blocks entirely outside the Miller crop.
    const vTop = project(0, 90 - (y0 + 0.5) / 60)[1];
    const vBot = project(0, 90 - (y1 - 0.5) / 60)[1];
    if (vBot < 0 || vTop >= 1) continue;
    const rgb = (await ne1.readRasters({ window: [0, y0, sw, y1], interleave: true })) as unknown as Uint8Array;
    const el = (await etopo.readRasters({ window: [0, y0, sw, y1], samples: [0], interleave: true })) as unknown as Float32Array;
    for (let y = y0; y < y1; y++) {
      const v = project(0, 90 - (y + 0.5) / 60)[1];
      if (v < 0 || v >= 1) continue;
      const row = Math.floor(v * h) * w;
      const base = (y - y0) * sw;
      for (let x = 0; x < sw; x++) {
        const p = (base + x) * 3;
        const r = rgb[p]!;
        const g = rgb[p + 1]!;
        const b = rgb[p + 2]!;
        if (r === 255 && g === 255 && b === 255) continue; // ocean
        const c = row + colOf[x]!;
        cnt[c]!++;
        sr[c]! += r;
        sg[c]! += g;
        sb[c]! += b;
        const dr = r - forestRgb[0];
        const dg = g - forestRgb[1];
        const db = b - forestRgb[2];
        if (dr * dr + dg * dg + db * db < FOREST_PX_DIST * FOREST_PX_DIST) forestPx[c]!++;
        const e = Math.max(0, el[base + x]!);
        se[c]! += e;
        se2[c]! += e * e;
      }
    }
    process.stdout.write(`\r  terrain ${w}×${h}: ${Math.round((y1 / sh) * 100)}%`);
  }
  process.stdout.write('\n');

  const marsh = new Uint8Array(n);
  for (const poly of inp.wetlands) {
    const rings = poly.map((ring) => {
      const out = new Float64Array(ring.length * 2);
      ring.forEach((p, i) => {
        const [u, v] = project(p[0]!, p[1]!);
        out[2 * i] = u * w;
        out[2 * i + 1] = v * h;
      });
      return out;
    });
    rasterizePolygon(rings, w, h, (y, x0, x1) => marsh.fill(1, y * w + x0, y * w + x1));
  }

  const land = landFraction(inp.landBits, inp.maskW, inp.maskH, w, h);
  const rowLat = new Float64Array(h);
  for (let r = 0; r < h; r++) rowLat[r] = millerLat(Y_TOP - ((r + 0.5) / h) * Math.PI) * (180 / Math.PI);
  const UNSET = 255;
  const terrain = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    if (land[c]! < 0.5) {
      terrain[c] = Terrain.Water;
      continue;
    }
    const k = cnt[c]!;
    if (k === 0) {
      terrain[c] = UNSET;
      continue;
    }
    const mr = sr[c]! / k;
    const mg = sg[c]! / k;
    const mb = sb[c]! / k;
    const mean = se[c]! / k;
    const std = Math.sqrt(Math.max(0, se2[c]! / k - mean * mean));
    const absLat = Math.abs(rowLat[Math.floor(c / w)]!);
    let best = Terrain.Plains as number;
    let bestD = Infinity;
    for (const e of exemplars) {
      if (e.terrain === Terrain.Desert && absLat > DESERT_MAX_ABS_LAT) continue;
      if (e.terrain === Terrain.Ice && absLat < ICE_MIN_ABS_LAT) continue;
      const d = (mr - e.rgb[0]) ** 2 + (mg - e.rgb[1]) ** 2 + (mb - e.rgb[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e.terrain;
      }
    }
    // Mixed cells average to a pale colour; a forest-pixel majority still reads as forest.
    if ((best === Terrain.Plains || best === Terrain.Grassland) && forestPx[c]! / k >= 0.5) best = Terrain.Forest;
    if (best === Terrain.Ice) terrain[c] = Terrain.Ice;
    else if (std >= MOUNTAIN_STD_M) terrain[c] = Terrain.Mountains;
    else if (std >= HILLS_STD_M || mean >= HIGH_PLATEAU_M) terrain[c] = Terrain.Hills;
    else if (marsh[c] && std < MARSH_MAX_STD_M && best !== Terrain.Desert) terrain[c] = Terrain.Marsh;
    else terrain[c] = best;
  }
  fillUnset(terrain, w, h, UNSET);
  return { terrain, w, h, exemplars };
}

/** Fraction of land-mask bits inside each w×h cell (mask dimensions are multiples of w, h). */
export function landFraction(bits: Uint8Array, mw: number, mh: number, w: number, h: number): Float32Array {
  const fx = mw / w;
  const fy = mh / h;
  const out = new Float32Array(w * h);
  for (let y = 0; y < mh; y++) {
    const row = Math.floor(y / fy) * w;
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      if ((bits[i >> 3]! >> (i & 7)) & 1) out[row + Math.floor(x / fx)]! += 1;
    }
  }
  for (let c = 0; c < out.length; c++) out[c]! /= fx * fy;
  return out;
}

/** Gives every `unset` cell the most common class among its classified 8-neighbours, repeatedly. */
function fillUnset(t: Uint8Array, w: number, h: number, unset: number): void {
  for (let pass = 0; pass < 64; pass++) {
    const todo: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = y * w + x;
        if (t[c] !== unset) continue;
        const votes = new Uint16Array(16);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h || (dx === 0 && dy === 0)) continue;
            const v = t[yy * w + ((x + dx + w) % w)]!;
            if (v !== unset && v >= Terrain.Plains) votes[v]!++;
          }
        }
        let best = -1;
        for (let k = Terrain.Plains; k < 16; k++) if (votes[k]! > 0 && (best < 0 || votes[k]! > votes[best]!)) best = k;
        if (best >= 0) todo.push([c, best]);
      }
    }
    for (const [c, v] of todo) t[c] = v;
    if (todo.length === 0) break;
  }
  for (let c = 0; c < t.length; c++) if (t[c] === unset) t[c] = Terrain.Plains; // isolated islets
}

/** Halves a terrain raster: land/water from `landFrac` (target size), land class = 2×2 mode. */
export function halveTerrain(src: Uint8Array, w: number, h: number, landFrac: Float32Array): Uint8Array {
  const hw = w / 2;
  const hh = h / 2;
  const out = new Uint8Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const c = y * hw + x;
      if (landFrac[c]! < 0.5) continue; // Water = 0
      const kids = [src[2 * y * w + 2 * x]!, src[2 * y * w + 2 * x + 1]!, src[(2 * y + 1) * w + 2 * x]!, src[(2 * y + 1) * w + 2 * x + 1]!];
      let best = -1;
      let bestN = 0;
      for (const k of kids) {
        if (k < Terrain.Plains) continue;
        let m = 0;
        for (const j of kids) if (j === k) m++;
        if (m > bestN) {
          bestN = m;
          best = k;
        }
      }
      out[c] = best < 0 ? 255 : best;
    }
  }
  fillUnset(out, hw, hh, 255);
  return out;
}

/** Terrain classes as RGB (from data/terrain.json colours) for previews. */
export function terrainPreview(t: Uint8Array, colors: readonly string[]): Uint8Array {
  const rgb = colors.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  const out = new Uint8Array(t.length * 3);
  for (let i = 0; i < t.length; i++) out.set(rgb[t[i]!] ?? [255, 0, 255], i * 3);
  return out;
}
