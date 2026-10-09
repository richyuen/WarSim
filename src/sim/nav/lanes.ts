/**
 * The lane graph (PLAN 4.1b, SPEC §3.3): what a ship sails on. A node for each sea zone, at its
 * seed's cell, and one for each strait (a body of crossing cells in zoned water). An edge
 * between two zones that touch, between a strait and each zone its cells are in, and for each
 * passage of the map's data (`data/maps/<map>/passages.json`): water a ship passes and the cell
 * grid closes (the Bosporus) or has as land (the Suez canal). An edge holds its length in km and
 * the water cells it runs over, so no edge crosses land but a passage, at its one jump.
 * Derived from the zones and the map's passages: never saved, rebuilt identically after a load.
 */
import { isLand, Terrain } from '../../shared/terrain';
import { nearestCellWhere } from '../data/ownership';
import { cellOf } from '../data/terrain';
import { asin, cos, PI, sin, sqrt } from '../core/dmath';
import { EARTH_R, Heap, neighbours4, stepKm, type NavGrid } from './grid';
import type { SeaZones } from './seaZones';

/** Water a ship passes between two points that the cell grid does not join. */
export interface SeaPassage {
  id: string;
  name: string;
  /** [lon, lat] of the water at each end. */
  a: readonly [number, number];
  b: readonly [number, number];
}

export const LaneNode = { zone: 0, strait: 1 } as const;
export type LaneNodeKind = (typeof LaneNode)[keyof typeof LaneNode];

export interface LaneEdge {
  /** Its nodes, `a` the lower. */
  a: number;
  b: number;
  km: number;
  /** True for a strait's edge: land units walk over the water at its end (an AoC-style crossing). */
  crossing: boolean;
  /** The passage of the list given that the edge is, or -1. */
  passage: number;
  /** The water cells from `a`'s cell to `b`'s, each a neighbour (8-way) of the one before. */
  cells: Int32Array;
  /** For a passage, the index in `cells` of the first cell beyond it (the passage itself has no cells); else -1. */
  landAt: number;
}

export interface LaneGraph {
  /** Per node. A zone's node is `zone - 1`; the straits follow, in cell order. */
  kind: Uint8Array;
  cell: Int32Array;
  zones: number;
  edges: LaneEdge[];
  /** Per node, its edges, in the order of `edges`. */
  adj: readonly number[][];
  /** Passages of the list that made no edge: an end with no zoned water within `PASSAGE_SNAP`, or both ends in one zone. */
  dropped: number[];
}

/** How far, in cells, an end of a passage looks for zoned water (as a seed does, `SEED_SNAP`). */
export const PASSAGE_SNAP = 2;

const DEG = PI / 180;

/** Great-circle distance, km, between two [lon, lat] points. */
export function greatCircleKm(a: readonly [number, number], b: readonly [number, number]): number {
  const sLat = sin(((b[1] - a[1]) * DEG) / 2);
  const sLon = sin(((b[0] - a[0]) * DEG) / 2);
  const h = sLat * sLat + cos(a[1] * DEG) * cos(b[1] * DEG) * sLon * sLon;
  return 2 * EARTH_R * asin(sqrt(h < 1 ? h : 1));
}

const DX8 = [1, -1, 0, 0, 1, 1, -1, -1];
const DY8 = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * For every cell of a zone, its distance in km over the zone's own water from the zone's seed
 * (8-way; a diagonal step only between two cells whose shared neighbours are both sea, so no
 * corner of land is cut) and the cell it is reached from. One search from all the seeds.
 */
function seedDistances(g: NavGrid, z: SeaZones): { dist: Float64Array; from: Int32Array } {
  const { w, h, terrain } = g;
  const { zoneOf } = z;
  const dist = new Float64Array(w * h).fill(Infinity);
  const from = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  const heap = new Heap();
  for (let i = 1; i <= z.count; i++) {
    dist[z.seedCell[i]!] = 0;
    heap.push(0, z.seedCell[i]!);
  }
  while (heap.size > 0) {
    const c = heap.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    const x = c % w;
    const y = (c - x) / w;
    const zone = zoneOf[c]!;
    for (let k = 0; k < 8; k++) {
      const dx = DX8[k]!;
      const dy = DY8[k]!;
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      let nx = x + dx;
      if (nx < 0 || nx >= w) {
        if (!g.wrapX) continue;
        nx = (nx + w) % w;
      }
      const m = ny * w + nx;
      if (closed[m] || zoneOf[m] !== zone) continue;
      if (dx !== 0 && dy !== 0 && (isLand(terrain[y * w + nx]!) || isLand(terrain[ny * w + x]!))) continue;
      const d = dist[c]! + stepKm(g, y, dx, dy);
      if (d < dist[m]!) {
        dist[m] = d;
        from[m] = c;
        heap.push(d, m);
      }
    }
  }
  return { dist, from };
}

export function buildLaneGraph(g: NavGrid, z: SeaZones, passages: readonly SeaPassage[]): LaneGraph {
  const { w, h, terrain } = g;
  const { zoneOf } = z;
  const n = w * h;
  const { dist, from } = seedDistances(g, z);
  const kind: number[] = [];
  const cell: number[] = [];
  for (let i = 1; i <= z.count; i++) {
    kind.push(LaneNode.zone);
    cell.push(z.seedCell[i]!);
  }
  const edges: LaneEdge[] = [];
  /** The cells from `c` to its zone's seed, `c` first. */
  const toSeed = (c: number): number[] => {
    const out: number[] = [];
    for (let k = c; k !== -1; k = from[k]!) out.push(k);
    return out;
  };

  // Zones that touch (4-way, as `SeaZones.adj`): the shortest way from seed to seed that changes
  // zone once. East and south only: each pair of cells that touch is seen once.
  const best = new Map<number, { km: number; lo: number; hi: number }>();
  for (let c = 0; c < n; c++) {
    const zc = zoneOf[c]!;
    if (zc === 0) continue;
    const x = c % w;
    const y = (c - x) / w;
    const east = x < w - 1 ? c + 1 : g.wrapX ? c - w + 1 : -1;
    const south = y < h - 1 ? c + w : -1;
    for (let k = 0; k < 2; k++) {
      const m = k === 0 ? east : south;
      const zm = m < 0 ? 0 : zoneOf[m]!;
      if (zm === 0 || zm === zc) continue;
      const km = dist[c]! + (k === 0 ? g.kx[y]! : g.ky[y]!) + dist[m]!;
      const key = zc < zm ? zc * 0x10000 + zm : zm * 0x10000 + zc;
      const b = best.get(key);
      if (b && b.km <= km) continue;
      best.set(key, { km, lo: zc < zm ? c : m, hi: zc < zm ? m : c });
    }
  }
  for (const key of [...best.keys()].sort((p, q) => p - q)) {
    const b = best.get(key)!;
    const cells = toSeed(b.lo).reverse().concat(toSeed(b.hi));
    edges.push({ a: zoneOf[b.lo]! - 1, b: zoneOf[b.hi]! - 1, km: b.km, crossing: false, passage: -1, cells: Int32Array.from(cells), landAt: -1 });
  }

  // The passages: from the seed of one end's zone to that end, the passage, and on to the other seed.
  const dropped: number[] = [];
  passages.forEach((p, i) => {
    const end = (lonLat: readonly [number, number]): number => {
      const [x, y] = cellOf(lonLat[0], lonLat[1], w, h);
      return nearestCellWhere((k) => zoneOf[k] !== 0, x, y, w, h, PASSAGE_SNAP, g.wrapX);
    };
    let ca = end(p.a);
    let cb = end(p.b);
    if (ca < 0 || cb < 0 || zoneOf[ca] === zoneOf[cb]) {
      dropped.push(i);
      return;
    }
    if (zoneOf[ca]! > zoneOf[cb]!) [ca, cb] = [cb, ca];
    const first = toSeed(ca).reverse();
    edges.push({
      a: zoneOf[ca]! - 1,
      b: zoneOf[cb]! - 1,
      km: dist[ca]! + greatCircleKm(p.a, p.b) + dist[cb]!,
      crossing: false,
      passage: i,
      cells: Int32Array.from(first.concat(toSeed(cb))),
      landAt: first.length,
    });
  });

  // The straits: each body of crossing cells (4-way) with a cell in a zone, in cell order. Its
  // node is at the middle one of its zoned cells; an edge to each zone it has a cell in, by the
  // cell that makes the way from that zone's seed to the node the shortest, then over the body.
  const seen = new Uint8Array(n);
  const nb: number[] = [];
  const step = new Float64Array(n);
  const next = new Int32Array(n);
  for (let c0 = 0; c0 < n; c0++) {
    if (seen[c0] || terrain[c0] !== Terrain.Crossing) continue;
    const body = [c0];
    seen[c0] = 1;
    for (let head = 0; head < body.length; head++) {
      for (const m of neighbours4(body[head]!, w, h, g.wrapX, nb)) {
        if (seen[m] || terrain[m] !== Terrain.Crossing) continue;
        seen[m] = 1;
        body.push(m);
      }
    }
    const zoned = body.filter((c) => zoneOf[c] !== 0).sort((p, q) => p - q);
    if (zoned.length === 0) continue;
    const at = zoned[zoned.length >> 1]!;
    // Over the body from the node's cell: the km to it and the next cell towards it.
    for (const c of body) step[c] = Infinity;
    step[at] = 0;
    next[at] = -1;
    const queue = [at];
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      const x = c % w;
      const y = (c - x) / w;
      for (const m of neighbours4(c, w, h, g.wrapX, nb)) {
        if (terrain[m] !== Terrain.Crossing || step[m] !== Infinity) continue;
        step[m] = step[c]! + (m % w === x ? g.ky[y]! : g.kx[y]!);
        next[m] = c;
        queue.push(m);
      }
    }
    const node = kind.length;
    kind.push(LaneNode.strait);
    cell.push(at);
    for (const zone of [...new Set(zoned.map((c) => zoneOf[c]!))].sort((p, q) => p - q)) {
      let via = -1;
      for (const c of zoned) {
        if (zoneOf[c] !== zone) continue;
        if (via < 0 || dist[c]! + step[c]! < dist[via]! + step[via]!) via = c;
      }
      const cells = toSeed(via).reverse();
      for (let k = next[via]!; k !== -1; k = next[k]!) cells.push(k);
      edges.push({ a: zone - 1, b: node, km: dist[via]! + step[via]!, crossing: true, passage: -1, cells: Int32Array.from(cells), landAt: -1 });
    }
  }

  const adj: number[][] = kind.map(() => []);
  edges.forEach((e, i) => {
    adj[e.a]!.push(i);
    adj[e.b]!.push(i);
  });
  return { kind: Uint8Array.from(kind), cell: Int32Array.from(cell), zones: z.count, edges, adj, dropped };
}

export interface LaneRoute {
  km: number;
  /** The nodes from the first to the last, and the edge taken after each but the last. */
  nodes: number[];
  edges: number[];
}

/** The shortest way over the lanes between two nodes (the lower node on a tie), or null with none. */
export function laneRoute(lanes: LaneGraph, start: number, goal: number): LaneRoute | null {
  const n = lanes.kind.length;
  const km = new Float64Array(n).fill(Infinity);
  const by = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  km[start] = 0;
  for (;;) {
    let c = -1;
    for (let i = 0; i < n; i++) if (!closed[i] && km[i]! < Infinity && (c < 0 || km[i]! < km[c]!)) c = i;
    if (c < 0) return null;
    if (c === goal) break;
    closed[c] = 1;
    for (const e of lanes.adj[c]!) {
      const edge = lanes.edges[e]!;
      const m = edge.a === c ? edge.b : edge.a;
      const d = km[c]! + edge.km;
      if (d < km[m]!) {
        km[m] = d;
        by[m] = e;
      }
    }
  }
  const nodes = [goal];
  const edges: number[] = [];
  for (let c = goal; c !== start; ) {
    const edge = lanes.edges[by[c]!]!;
    edges.push(by[c]!);
    c = edge.a === c ? edge.b : edge.a;
    nodes.push(c);
  }
  return { km: km[goal]!, nodes: nodes.reverse(), edges: edges.reverse() };
}
