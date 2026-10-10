/**
 * Sea zones (PLAN 4.1a, SPEC §3.3): every water and crossing cell of a body of water large enough
 * belongs to one zone, the one whose seed is the fewest steps away over water (4-way, a Voronoi
 * that no land is crossed by). The seeds are the map's named seas (`data/maps/<map>/seas.json`,
 * the large ones in parts); water that no seed reaches (a lake, a map with no seas file) is
 * given seeds of its own, spread as the data tool spreads a sea's. A zone of a sea that ice
 * closes (`data/maps/<map>/ice.json`, PLAN 4.2d) is `closed`: it is a zone as any other, and no
 * fleet's way enters it. Derived from static layers (terrain) and the map's data, so it is
 * rebuilt identically after a load and never saved.
 */
import { isLand } from '../../shared/terrain';
import { nearestCellWhere } from '../data/ownership';
import { cellOf } from '../data/terrain';
import { sqrt } from '../core/dmath';
import { neighbours4, type NavGrid } from './grid';

/** One seed of a named sea. `part` is 0 for a sea of one zone, else 1…k. */
export interface SeaSeed {
  name: string;
  part: number;
  lonLat: readonly [number, number];
}

export interface SeaZones {
  /** Zone per cell, 1…count (0 = none: land, or water too small for a zone). */
  zoneOf: Uint16Array;
  count: number;
  /** Per zone (index 0 unused): its seed's cell, its seed in the list given (-1: a zone no named sea has), its cells and area. */
  seedCell: Int32Array;
  seed: Int32Array;
  cells: Int32Array;
  areaKm2: Float64Array;
  /** Per zone (index 0 unused, 0): 1 where its seed's sea is one that ice closes to a fleet. */
  closed: Uint8Array;
  /** Sorted neighbour lists: zones with cells that touch (4-way). */
  adj: readonly number[][];
  /** Seeds of the list that made no zone: on land with no water within `SEED_SNAP`, or in a cell another seed has. */
  dropped: number[];
}

/** The area a zone is meant to have, km²: a sea or an unnamed water of k times this is given k seeds. */
export const ZONE_KM2 = 1_500_000;
/**
 * The length a zone is meant to have, km: a water longer than k times this is given k seeds even
 * when its area asks for fewer (the Mediterranean: one seed for it left its middle to the seeds
 * of its gulfs).
 */
export const ZONE_SPAN_KM = 1_500;
/** Water with no seed and less than this, km², has no zone (a lake of a few cells). */
export const MIN_WATER_KM2 = 10_000;
/** How far, in cells, a seed on land looks for water (a seed is a cell's middle on the M map; on a coarser one that cell can be land). */
export const SEED_SNAP = 2;
/** At most this many rounds of moving each seed of a spread to the middle of its part. */
const SPREAD_ROUNDS = 16;

/** Scratch of the searches below, one per build. */
export interface SeaScratch {
  dist: Int32Array;
  queue: Int32Array;
  nb: number[];
}

export function seaScratch(g: NavGrid): SeaScratch {
  return { dist: new Int32Array(g.w * g.h), queue: new Int32Array(g.w * g.h), nb: [] };
}

/**
 * The cell of `cells` furthest (in steps inside the region) from the region's edge: a cell with a
 * neighbour outside it, or in the map's first or last row. The region is the cells whose `mark`
 * is `id`. The first such cell in search order; `cells[0]` when the region has no edge.
 */
function deepest(g: NavGrid, s: SeaScratch, cells: ArrayLike<number>, mark: Int32Array, id: number): number {
  const { dist, queue, nb } = s;
  let tail = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const y = (c - (c % g.w)) / g.w;
    let edge = y === 0 || y === g.h - 1;
    for (const m of neighbours4(c, g.w, g.h, g.wrapX, nb)) if (mark[m] !== id) edge = true;
    dist[c] = edge ? 0 : -1;
    if (edge) queue[tail++] = c;
  }
  let best = cells[0]!;
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    if (dist[c]! > dist[best]!) best = c;
    for (const m of neighbours4(c, g.w, g.h, g.wrapX, nb)) {
      if (mark[m] !== id || dist[m] !== -1) continue;
      dist[m] = dist[c]! + 1;
      queue[tail++] = m;
    }
  }
  return best;
}

/**
 * Gives each cell of the region the index of the nearest of `seeds` (steps inside the region; the
 * earlier seed on a tie) in `part`, as `base + index`, and returns the cell reached last, its
 * steps in `s.dist`. The region is in one piece.
 */
function partition(g: NavGrid, s: SeaScratch, cells: ArrayLike<number>, mark: Int32Array, id: number, seeds: readonly number[], part: Int32Array, base: number): number {
  const { queue, nb } = s;
  for (let i = 0; i < cells.length; i++) part[cells[i]!] = -1;
  const { dist } = s;
  let tail = 0;
  seeds.forEach((c, i) => {
    part[c] = base + i;
    dist[c] = 0;
    queue[tail++] = c;
  });
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    for (const m of neighbours4(c, g.w, g.h, g.wrapX, nb)) {
      if (mark[m] !== id || part[m] !== -1) continue;
      part[m] = part[c]!;
      dist[m] = dist[c]! + 1;
      queue[tail++] = m;
    }
  }
  return queue[tail - 1]!;
}

/**
 * Seeds for the region of `cells` (those whose `mark` is `id`; in one piece), spread over it, as
 * many as its area or its length asks for (`ZONE_KM2`, `ZONE_SPAN_KM`; the length is twice the
 * steps from its deepest cell to its furthest, a step the side of a square of a cell's mean area):
 * the deepest cell, then each time the cell furthest from the seeds so far, then, until none
 * moves or `SPREAD_ROUNDS` times, each seed to the cell of its part nearest to the part's middle
 * (its cells weighed by their area, so that a part near a pole is not a small one). In cell
 * order. `part` is scratch the size of the map, with no value from `base` up in it outside the
 * region.
 */
export function spreadSeeds(g: NavGrid, s: SeaScratch, cells: ArrayLike<number>, mark: Int32Array, id: number, part: Int32Array, base: number): number[] {
  const seeds = [deepest(g, s, cells, mark, id)];
  const area = areaOf(g, cells);
  const span = 2 * s.dist[partition(g, s, cells, mark, id, seeds, part, base)]! * sqrt(area / cells.length);
  const k = Math.max(1, Math.round(area / ZONE_KM2), Math.round(span / ZONE_SPAN_KM));
  while (seeds.length < k) {
    const far = partition(g, s, cells, mark, id, seeds, part, base);
    if (seeds.includes(far)) break;
    seeds.push(far);
  }
  const { w } = g;
  const sx = new Float64Array(k);
  const sy = new Float64Array(k);
  const sw = new Float64Array(k);
  const near = new Float64Array(k);
  // A cell's x as its seed sees it: the short way round a map that loops.
  const dxOf = (c: number, seed: number): number => {
    const d = (c % w) - (seed % w);
    return !g.wrapX ? d : d > w / 2 ? d - w : d < -w / 2 ? d + w : d;
  };
  for (let round = 0; round < SPREAD_ROUNDS && seeds.length > 1; round++) {
    partition(g, s, cells, mark, id, seeds, part, base);
    sx.fill(0);
    sy.fill(0);
    sw.fill(0);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const p = part[c]! - base;
      const y = (c - (c % w)) / w;
      const a = g.kx[y]! * g.ky[y]!;
      sx[p]! += a * dxOf(c, seeds[p]!);
      sy[p]! += a * y;
      sw[p]! += a;
    }
    const next = seeds.slice();
    near.fill(Infinity);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const p = part[c]! - base;
      const ddx = dxOf(c, seeds[p]!) - sx[p]! / sw[p]!;
      const ddy = (c - (c % w)) / w - sy[p]! / sw[p]!;
      const d = ddx * ddx + ddy * ddy;
      if (d < near[p]!) {
        near[p] = d;
        next[p] = c;
      }
    }
    if (next.every((c, i) => c === seeds[i])) break;
    for (let i = 0; i < seeds.length; i++) seeds[i] = next[i]!;
  }
  for (let i = 0; i < cells.length; i++) part[cells[i]!] = -1;
  return seeds.sort((a, b) => a - b);
}

/** The area of `cells`, km². */
export function areaOf(g: NavGrid, cells: ArrayLike<number>): number {
  let a = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const y = (c - (c % g.w)) / g.w;
    a += g.kx[y]! * g.ky[y]!;
  }
  return a;
}

/** `ice`: the names of the seas whose zones are closed to a fleet (PLAN 4.2d). */
export function buildSeaZones(g: NavGrid, seeds: readonly SeaSeed[], ice: ReadonlySet<string> = new Set()): SeaZones {
  const { w, h, terrain } = g;
  const n = w * h;
  const s = seaScratch(g);
  const nb: number[] = [];
  const zoneOf = new Uint16Array(n);
  const seedCell: number[] = [0];
  const seedIdx: number[] = [-1];
  const dropped: number[] = [];
  const sea = (c: number): boolean => !isLand(terrain[c]!);

  seeds.forEach((sd, i) => {
    const [x, y] = cellOf(sd.lonLat[0], sd.lonLat[1], w, h);
    const c = nearestCellWhere((k) => sea(k) && zoneOf[k] === 0, x, y, w, h, SEED_SNAP, g.wrapX);
    if (c < 0) {
      dropped.push(i);
      return;
    }
    zoneOf[c] = seedCell.length;
    seedCell.push(c);
    seedIdx.push(i);
  });

  // The bodies of water (4-way) with no seed in them: one large enough is given seeds of its own.
  const body = new Int32Array(n).fill(-1);
  const part = new Int32Array(n).fill(-1);
  for (let c0 = 0; c0 < n; c0++) {
    if (body[c0] !== -1 || !sea(c0)) continue;
    const cells: number[] = [c0];
    body[c0] = c0;
    let seeded = zoneOf[c0] !== 0;
    for (let head = 0; head < cells.length; head++) {
      for (const m of neighbours4(cells[head]!, w, h, g.wrapX, nb)) {
        if (body[m] !== -1 || !sea(m)) continue;
        body[m] = c0;
        if (zoneOf[m] !== 0) seeded = true;
        cells.push(m);
      }
    }
    if (seeded) continue;
    const area = areaOf(g, cells);
    if (area < MIN_WATER_KM2) continue;
    cells.sort((a, b) => a - b);
    for (const c of spreadSeeds(g, s, cells, body, c0, part, 0)) {
      zoneOf[c] = seedCell.length;
      seedCell.push(c);
      seedIdx.push(-1);
    }
  }
  const count = seedCell.length - 1;
  if (count > 0xffff) throw new Error(`sea zones: ${count} is more than a u16 holds`);

  // The Voronoi: one search from every seed at once, the seeds in the order of their zones.
  const queue = s.queue;
  let tail = 0;
  for (let z = 1; z <= count; z++) queue[tail++] = seedCell[z]!;
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    const z = zoneOf[c]!;
    for (const m of neighbours4(c, w, h, g.wrapX, nb)) {
      if (zoneOf[m] !== 0 || !sea(m)) continue;
      zoneOf[m] = z;
      queue[tail++] = m;
    }
  }

  const cells = new Int32Array(count + 1);
  const areaKm2 = new Float64Array(count + 1);
  const adjSets: Set<number>[] = Array.from({ length: count + 1 }, () => new Set<number>());
  for (let c = 0; c < n; c++) {
    const z = zoneOf[c]!;
    if (z === 0) continue;
    const x = c % w;
    const y = (c - x) / w;
    cells[z]!++;
    areaKm2[z]! += g.kx[y]! * g.ky[y]!;
    // East and south only: each pair of cells that touch is seen once.
    const east = x < w - 1 ? c + 1 : g.wrapX ? c - w + 1 : -1;
    const south = y < h - 1 ? c + w : -1;
    for (const m of [east, south]) {
      const zm = m < 0 ? 0 : zoneOf[m]!;
      if (zm === 0 || zm === z) continue;
      adjSets[z]!.add(zm);
      adjSets[zm]!.add(z);
    }
  }
  return {
    zoneOf,
    count,
    seedCell: Int32Array.from(seedCell),
    seed: Int32Array.from(seedIdx),
    cells,
    areaKm2,
    closed: Uint8Array.from(seedIdx, (i) => (i >= 0 && ice.has(seeds[i]!.name) ? 1 : 0)),
    adj: adjSets.map((set) => [...set].sort((a, b) => a - b)),
    dropped,
  };
}
