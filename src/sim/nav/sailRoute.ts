/**
 * The way a fleet sails from one water cell to another (PLAN 4.2c, SPEC §3.3): over the lane
 * graph, and then drawn tight.
 *
 * The lanes give the way by the zones' seeds: from the first cell to its zone's seed
 * (`LaneGraph.toSeed`), the edges of `laneRoute` between the two zones' nodes, and from the last
 * zone's seed to the last cell. That way is longer than the sea's own (PLAN 4.1b: 23 % over
 * great-circle legs from the Alboran Sea to the Red Sea), so it is drawn tight: from a cell of
 * it the way goes straight (`seaWalk`) to the furthest cell of it in a row that the straight
 * walk reaches, and on from there, until no cell more can be left out. A straight walk on the
 * map is not the shortest in km (far from the equator a cell is fewer km across, and the lanes'
 * way bends towards the pole), so the way is drawn tight a second time, with only the straight
 * walks that are no longer in km than what they replace, and the shorter of the two is taken:
 * never longer than the lanes' way. A passage is kept as it is: the way is drawn tight on each
 * side of it.
 *
 * The result is a list of cells, each a neighbour (8-way) of the one before, all zoned water,
 * no corner of land cut; but for the one step of each passage taken, between its two ends.
 * Pure and by whole numbers: the same cells for the same grid, zones and lanes.
 */
import { isLand } from '../../shared/terrain';
import { unproject } from '../data/projection';
import { stepKm, type NavGrid } from './grid';
import { greatCircleKm, laneRoute, type LaneGraph } from './lanes';
import type { SeaZones } from './seaZones';

export interface SailRoute {
  /** From the first cell to the last. */
  cells: Int32Array;
  /** The length of `cells`, step by step (`sailStepKm`). */
  km: number;
  /** The length of the way by the zones' seeds, before it was drawn tight. */
  laneKm: number;
  /** The cells of `cells` where the way turns, with its first and last and the two ends of each passage: between two in a row it is one straight walk. */
  turns: number[];
}

/** `b`'s column less `a`'s, the short way round on a map that loops. */
function columns(g: NavGrid, a: number, b: number): number {
  const dx = (b % g.w) - (a % g.w);
  if (!g.wrapX) return dx;
  return dx > g.w / 2 ? dx - g.w : dx < -g.w / 2 ? dx + g.w : dx;
}

/** Whether the cells `a` and `b` are neighbours (8-way; over the seam of a map that loops). */
export function seaNeighbours(g: NavGrid, a: number, b: number): boolean {
  const dy = Math.floor(b / g.w) - Math.floor(a / g.w);
  const dx = columns(g, a, b);
  return dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1 && (dx !== 0 || dy !== 0);
}

/**
 * The km of a step of a fleet's way: between two neighbours as a march's step is (`stepKm`);
 * between two cells that are none, the two ends of a passage, the great circle between their
 * middles.
 */
export function sailStepKm(g: NavGrid, a: number, b: number): number {
  const ay = Math.floor(a / g.w);
  const by = Math.floor(b / g.w);
  if (seaNeighbours(g, a, b)) return stepKm(g, by > ay ? ay : by, columns(g, a, b), by - ay);
  return greatCircleKm(unproject(((a % g.w) + 0.5) / g.w, (ay + 0.5) / g.h), unproject(((b % g.w) + 0.5) / g.w, (by + 0.5) / g.h));
}

/**
 * The straight walk from the cell `a` to the cell `b` (Bresenham's line, the short way round
 * on a map that loops): whether every cell of it after `a` is zoned water and no diagonal step
 * of it has land beside it. With `out`, the cells after `a` are added to it (all of them where
 * the answer is true).
 */
export function seaWalk(g: NavGrid, z: SeaZones, a: number, b: number, out?: number[]): boolean {
  return walkKm(g, z, a, b, out) >= 0;
}

/** The km of the straight walk from `a` to `b` (`seaWalk`), or -1 where it is not clear. */
function walkKm(g: NavGrid, z: SeaZones, a: number, b: number, out?: number[]): number {
  const { w, terrain } = g;
  const { zoneOf } = z;
  const dx = columns(g, a, b);
  const dy = Math.floor(b / w) - Math.floor(a / w);
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const adx = dx * sx;
  const ady = dy * sy;
  let x = a % w;
  let y = (a - x) / w;
  let err = adx - ady;
  let km = 0;
  for (let left = adx > ady ? adx : ady; left > 0; left--) {
    const e2 = 2 * err;
    let mx = 0;
    let my = 0;
    if (e2 > -ady) {
      err -= ady;
      mx = sx;
    }
    if (e2 < adx) {
      err += adx;
      my = sy;
    }
    const nx = (x + mx + w) % w;
    const ny = y + my;
    if (zoneOf[ny * w + nx] === 0) return -1;
    // A diagonal step: water on both sides of it (a crossing counts as water, as in the lanes).
    if (mx !== 0 && my !== 0 && (isLand(terrain[y * w + nx]!) || isLand(terrain[ny * w + x]!))) return -1;
    km += stepKm(g, my > 0 ? y : ny, mx, my);
    x = nx;
    y = ny;
    out?.push(y * w + x);
  }
  return km;
}

/**
 * A way of neighbours over water, drawn tight (see the head of the file): the points it turns
 * at, its first and last with them, and its km. `never`: no straight walk that is longer in km
 * than what it replaces.
 */
function tighten(g: NavGrid, z: SeaZones, way: number[], never: boolean): { pts: number[]; km: number } {
  let pts = way;
  // The km from each point to the next: a step at first, then the straight walk between them.
  let legs = way.slice(1).map((c, k) => sailStepKm(g, way[k]!, c));
  for (;;) {
    const next = [pts[0]!];
    const nextLegs: number[] = [];
    for (let i = 0; i < pts.length - 1; ) {
      let j = i + 1;
      let km = legs[i]!;
      let along = km;
      while (j + 1 < pts.length) {
        along += legs[j]!;
        const straight = walkKm(g, z, pts[i]!, pts[j + 1]!);
        if (straight < 0 || (never && straight > along + 1e-9)) break;
        km = along = straight;
        j++;
      }
      next.push(pts[j]!);
      nextLegs.push(km);
      i = j;
    }
    if (next.length === pts.length) break;
    pts = next;
    legs = nextLegs;
  }
  return { pts, km: legs.reduce((sum, km) => sum + km, 0) };
}

/** The way of a fleet from the water cell `from` to the water cell `to`; null where one of them has no zone or no lane joins their zones. */
export function sailRoute(g: NavGrid, z: SeaZones, lanes: LaneGraph, from: number, to: number): SailRoute | null {
  const zs = z.zoneOf[from]!;
  const zt = z.zoneOf[to]!;
  if (zs === 0 || zt === 0) return null;
  // The parts of the way, one more than the passages taken: each a row of neighbours.
  const parts: number[][] = [[]];
  let part = parts[0]!;
  for (let c = from; c !== -1; c = lanes.toSeed[c]!) part.push(c);
  if (zs !== zt) {
    const r = laneRoute(lanes, zs - 1, zt - 1);
    if (!r) return null;
    r.edges.forEach((e, i) => {
      const edge = lanes.edges[e]!;
      const on = edge.a === r.nodes[i];
      const n = edge.cells.length;
      // The first cell of an edge is the last of the way so far.
      for (let k = 1; k < n; k++) {
        if (edge.landAt >= 0 && k === (on ? edge.landAt : n - edge.landAt)) parts.push((part = []));
        part.push(edge.cells[on ? k : n - 1 - k]!);
      }
    });
  }
  const down: number[] = [];
  for (let c = to; c !== -1; c = lanes.toSeed[c]!) down.push(c);
  for (let k = down.length - 2; k >= 0; k--) part.push(down[k]!);

  const length = (list: readonly number[][]): number => {
    let km = 0;
    let last = -1;
    for (const p of list) {
      for (const c of p) {
        if (last >= 0) km += sailStepKm(g, last, c);
        last = c;
      }
    }
    return km;
  };
  const turns: number[] = [];
  const tight = parts.map((p) => {
    const any = tighten(g, z, p, false);
    const sure = tighten(g, z, p, true);
    const pts = (any.km < sure.km ? any : sure).pts;
    turns.push(...pts);
    const out = [pts[0]!];
    // Each walk between two turns was asked and is clear.
    for (let i = 1; i < pts.length; i++) seaWalk(g, z, pts[i - 1]!, pts[i]!, out);
    return out;
  });
  return { cells: Int32Array.from(tight.flat()), km: length(tight), laneKm: length(parts), turns };
}
