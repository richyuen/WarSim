/**
 * Scenario ownership raster (PLAN 1.3, SPEC §3.2): owner/controller per cell from the province
 * raster and `data/scenarios/<id>/ownership.json`.
 *
 * 1. Each admin-1 province gets `byProvince[adm1] ?? byCountry[adm0]` (null = unowned).
 * 2. Land cells (terrain ≥ Plains) take their province's owner; water and crossings are 0.
 *    Land cells without a province (coastline mismatch between NE land and admin-1) take the
 *    most common owner of their land neighbours.
 * 3. Regions are applied in order: land cells inside the ring whose current owner is in
 *    `onlyFrom` change hands. The guard lets a coarse ring follow a border only on one side.
 * 4. controller = owner, then occupation rings set the controller of `owner`'s cells.
 *
 * Pure and deterministic (dmath projection, integer rasterization): the worker and Node agree.
 */
import { Terrain } from '../../shared/terrain';
import { project } from './projection';
import { rasterizePolygon } from '../../shared/rasterize';

type LonLat = readonly [number, number];

export interface OwnershipRules {
  byCountry: Readonly<Record<string, string | null>>;
  byProvince: Readonly<Record<string, string>>;
  regions: readonly { id: string; owner: string; onlyFrom: readonly string[]; ring: readonly LonLat[] }[];
  occupation: readonly { id: string; controller: string; owner: string; ring: readonly LonLat[] }[];
}

export interface OwnershipInput {
  w: number;
  h: number;
  /** Province id per cell (0 = none); id = index into `provinces` + 1. */
  provinceIds: Uint16Array;
  provinces: readonly { adm0: string; adm1: string }[];
  terrain: Uint8Array;
  /** Nation tags; nation id = index + 1. */
  tags: readonly string[];
  rules: OwnershipRules;
}

export interface OwnershipResult {
  owner: Uint16Array;
  controller: Uint16Array;
  /** adm0 codes present in the province data but missing from `byCountry`. */
  unmappedCountries: string[];
  /** byProvince keys that match no province. */
  unknownProvinces: string[];
  /** Cells changed per region / occupation id (diagnostics and tests). */
  regionCells: Record<string, number>;
}

const UNSET = 0xffff;

/**
 * Small island territories (Malta, Bermuda, Maldives, …) are sub-cell, so the land mask leaves
 * them as water even though the province raster placed them. Each admin-0 unit that has province
 * cells but no land cell gets exactly one land cell (Plains): the first of its provinces whose
 * label point falls in one of its own water cells. Inland micro-states, whose label points lie in
 * a neighbour's land, are left alone. Mutates `terrain`; returns the adm0 codes given a cell.
 */
export function reconcileIslands(
  terrain: Uint8Array,
  provinceIds: Uint16Array,
  provinces: readonly { adm0: string; u: number; v: number }[],
  w: number,
  h: number,
): string[] {
  const hasLand = new Set<string>();
  for (let c = 0; c < w * h; c++) {
    const pid = provinceIds[c]!;
    if (pid !== 0 && terrain[c]! >= Terrain.Plains) hasLand.add(provinces[pid - 1]!.adm0);
  }
  const done = new Set<string>();
  provinces.forEach((p) => {
    if (hasLand.has(p.adm0) || done.has(p.adm0)) return;
    const x = Math.min(w - 1, Math.floor(p.u * w));
    const y = Math.min(h - 1, Math.floor(p.v * h));
    const c = y * w + x;
    const pid = provinceIds[c]!;
    if (pid === 0 || provinces[pid - 1]!.adm0 !== p.adm0 || terrain[c]! >= Terrain.Plains) return;
    terrain[c] = Terrain.Plains;
    done.add(p.adm0);
  });
  return [...done].sort();
}

/** Calls `fn(cell)` for every cell whose centre lies inside the lon/lat ring. */
export function forEachCellInRing(ring: readonly LonLat[], w: number, h: number, fn: (cell: number) => void): void {
  const pts = new Float64Array(ring.length * 2);
  ring.forEach(([lon, lat], i) => {
    const [u, v] = project(lon, lat);
    pts[2 * i] = u * w;
    pts[2 * i + 1] = v * h;
  });
  rasterizePolygon([pts], w, h, (y, x0, x1) => {
    for (let x = x0; x < x1; x++) fn(y * w + x);
  });
}

export function buildOwnership(inp: OwnershipInput): OwnershipResult {
  const { w, h, provinceIds, provinces, terrain, tags, rules } = inp;
  const n = w * h;
  const idOf = new Map<string, number>();
  tags.forEach((t, i) => idOf.set(t, i + 1));
  const nation = (t: string | null): number => (t === null ? 0 : (idOf.get(t) ?? 0));

  const unmapped = new Set<string>();
  const usedProvinceKeys = new Set<string>();
  const provOwner = new Uint16Array(provinces.length + 1);
  provinces.forEach((p, i) => {
    const byP = rules.byProvince[p.adm1];
    if (byP !== undefined) {
      usedProvinceKeys.add(p.adm1);
      provOwner[i + 1] = nation(byP);
    } else if (p.adm0 in rules.byCountry) {
      provOwner[i + 1] = nation(rules.byCountry[p.adm0]!);
    } else {
      unmapped.add(p.adm0);
    }
  });

  const owner = new Uint16Array(n);
  for (let c = 0; c < n; c++) {
    if (terrain[c]! < Terrain.Plains) continue;
    const pid = provinceIds[c]!;
    owner[c] = pid === 0 ? UNSET : provOwner[pid]!;
  }
  fillFromNeighbours(owner, terrain, w, h);

  const regionCells: Record<string, number> = {};
  for (const r of rules.regions) {
    const from = new Set(r.onlyFrom.map((t) => nation(t)));
    const to = nation(r.owner);
    let changed = 0;
    forEachCellInRing(r.ring, w, h, (c) => {
      if (terrain[c]! >= Terrain.Plains && from.has(owner[c]!) && owner[c] !== to) {
        owner[c] = to;
        changed++;
      }
    });
    regionCells[r.id] = changed;
  }

  const controller = new Uint16Array(owner);
  for (const o of rules.occupation) {
    const of = nation(o.owner);
    const by = nation(o.controller);
    let changed = 0;
    forEachCellInRing(o.ring, w, h, (c) => {
      if (owner[c] === of && of !== 0) {
        controller[c] = by;
        changed++;
      }
    });
    regionCells[o.id] = changed;
  }

  const unknownProvinces = Object.keys(rules.byProvince)
    .filter((k) => !usedProvinceKeys.has(k))
    .sort();
  return { owner, controller, unmappedCountries: [...unmapped].sort(), unknownProvinces, regionCells };
}

/**
 * The cell nearest to (x, y) (cell units) whose owner satisfies `pred`, within `maxR` cells
 * (Chebyshev rings; nearest centre inside a ring, first in row-major order on ties), or -1.
 */
export function nearestCellWhere(owner: Uint16Array, pred: (o: number) => boolean, x: number, y: number, w: number, h: number, maxR: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let r = 0; r <= maxR; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      const yy = cy + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = yy * w + ((cx + dx + w) % w);
        if (!pred(owner[c]!)) continue;
        const ddx = cx + dx + 0.5 - x;
        const ddy = yy + 0.5 - y;
        const d = ddx * ddx + ddy * ddy;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** The cell owned by `nation` nearest to (x, y) within `maxR` cells, or -1 (coastal capitals). */
export function nearestOwnedCell(owner: Uint16Array, nation: number, x: number, y: number, w: number, h: number, maxR: number): number {
  return nearestCellWhere(owner, (o) => o === nation, x, y, w, h, maxR);
}

/** Land cells marked UNSET take the most common owner among their resolved land neighbours. */
function fillFromNeighbours(owner: Uint16Array, terrain: Uint8Array, w: number, h: number): void {
  for (let pass = 0; pass < 64; pass++) {
    const todo: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = y * w + x;
        if (owner[c] !== UNSET) continue;
        // Up to 8 neighbours: tally in small parallel arrays (no Map: deterministic, alloc-free).
        const ids = [0, 0, 0, 0, 0, 0, 0, 0];
        const cnt = [0, 0, 0, 0, 0, 0, 0, 0];
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = yy * w + ((x + dx + w) % w);
            if (terrain[nc]! < Terrain.Plains || owner[nc] === UNSET) continue;
            const v = owner[nc]!;
            let j = 0;
            while (j < k && ids[j] !== v) j++;
            if (j === k) {
              ids[k] = v;
              k++;
            }
            cnt[j]!++;
          }
        }
        if (k === 0) continue;
        let best = 0;
        for (let j = 1; j < k; j++) if (cnt[j]! > cnt[best]! || (cnt[j] === cnt[best] && ids[j]! < ids[best]!)) best = j;
        todo.push(c, ids[best]!);
      }
    }
    for (let i = 0; i < todo.length; i += 2) owner[todo[i]!] = todo[i + 1]!;
    if (todo.length === 0) break;
  }
  for (let c = 0; c < owner.length; c++) if (owner[c] === UNSET) owner[c] = 0;
}
