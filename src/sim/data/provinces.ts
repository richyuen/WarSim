/**
 * Province raster (PLAN 0.19, SPEC §3.3): admin-1 polygons → per-cell province ids at map
 * size W×H, built at load time in the worker (and in Node for tests and tools).
 *
 * 1. Scanline-fill every province (cell centre inside → that province; later ids win the
 *    rare source overlaps).
 * 2. Provinces smaller than a cell get exactly one cell, so every source province exists:
 *    in order of decreasing area, take the label-point cell if it is free water (a 1-cell
 *    island), else search square rings around the label point (fixed scan order) in three
 *    passes: a cell of a same-country province that keeps ≥ 1 other cell; then free water
 *    (island groups such as Bermuda's parishes grow into the sea); then any donor.
 *
 * Integer and exact-float arithmetic only, so Node and every browser build identical rasters.
 */
import type { Admin1Geometry } from '../../shared/admin1';
import { rasterizePolygon } from './rasterize';

export interface ProvinceSeed {
  /** Label point, normalised Miller (u, v). */
  u: number;
  v: number;
  areaKm2: number;
  /** Country key (e.g. ISO a3); forced placement prefers same-country donor cells. */
  adm0: string;
}

export interface ProvinceRaster {
  w: number;
  h: number;
  /** Province id per cell (1-based; 0 = no province / water). */
  ids: Uint16Array;
  /** Cells per province, indexed by id (index 0 = unassigned cells). */
  cells: Uint32Array;
  /** Province ids that were placed by the sub-cell rule. */
  forced: number[];
  /** Province ids that could not be placed at all (should be empty). */
  missing: number[];
}

/** Search radius (cells) for a donor cell around a tiny province's label point. */
const MAX_RADIUS = 24;

export function buildProvinceRaster(geo: Admin1Geometry, seeds: readonly ProvinceSeed[], w: number, h: number): ProvinceRaster {
  const n = geo.provinces.length;
  if (seeds.length !== n) throw new Error(`province seeds: ${seeds.length}, geometry: ${n}`);
  if (n > 0xffff) throw new Error('too many provinces for u16 ids');
  const ids = new Uint16Array(w * h);
  const sx = w / geo.q; // exact: w and q are small multiples of powers of two
  const sy = h / geo.q;

  geo.provinces.forEach((prov, k) => {
    const id = k + 1;
    for (const poly of prov) {
      const rings = poly.map((ring) => {
        const out = new Float64Array(ring.length);
        for (let i = 0; i < ring.length; i += 2) {
          out[i] = ring[i]! * sx;
          out[i + 1] = ring[i + 1]! * sy;
        }
        return out;
      });
      rasterizePolygon(rings, w, h, (y, x0, x1) => ids.fill(id, y * w + x0, y * w + x1));
    }
  });

  const cells = new Uint32Array(n + 1);
  for (let i = 0; i < ids.length; i++) cells[ids[i]!]!++;

  // Country index per province for the same-country preference.
  const countryOf = new Int32Array(n + 1);
  const countryIds = new Map<string, number>();
  seeds.forEach((s, k) => {
    let c = countryIds.get(s.adm0);
    if (c === undefined) {
      c = countryIds.size;
      countryIds.set(s.adm0, c);
    }
    countryOf[k + 1] = c;
  });

  const tiny: number[] = [];
  for (let id = 1; id <= n; id++) if (cells[id] === 0) tiny.push(id);
  tiny.sort((a, b) => seeds[b - 1]!.areaKm2 - seeds[a - 1]!.areaKm2 || a - b);

  const locked = new Uint8Array(w * h); // cells taken by forced placement
  const forced: number[] = [];
  const missing: number[] = [];
  const take = (c: number, id: number): void => {
    cells[ids[c]!]!--; // cells[0] counts water/unassigned cells
    ids[c] = id;
    cells[id] = 1;
    locked[c] = 1;
    forced.push(id);
  };
  for (const id of tiny) {
    const s = seeds[id - 1]!;
    const cx = Math.min(w - 1, Math.max(0, Math.floor(s.u * w)));
    const cy = Math.min(h - 1, Math.max(0, Math.floor(s.v * h)));
    const c0 = cy * w + cx;
    if (ids[c0] === 0 && locked[c0] === 0) {
      take(c0, id);
      continue;
    }
    let placed = false;
    for (let pass = 0; pass < 3 && !placed; pass++) {
      for (let r = 0; r <= MAX_RADIUS && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring perimeter only
            const y = cy + dy;
            if (y < 0 || y >= h) continue;
            const x = (((cx + dx) % w) + w) % w;
            const c = y * w + x;
            const owner = ids[c]!;
            if (locked[c] === 1) continue;
            if (pass === 1) {
              if (owner !== 0) continue;
            } else if (owner === 0 || cells[owner]! < 2 || (pass === 0 && countryOf[owner] !== countryOf[id])) continue;
            take(c, id);
            placed = true;
            break;
          }
        }
      }
    }
    if (!placed) missing.push(id);
  }
  return { w, h, ids, cells, forced, missing };
}
