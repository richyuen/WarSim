/**
 * Coarse navigation graph (PLAN 1.11, SPEC §4): nodes are admin-1 provinces plus one virtual node
 * per connected group of crossing cells (straits) and one per connected run of walkable land that
 * no province has, edges join nodes whose cells touch (4-way, wrapping). Long routes are planned on this graph first; cell A* then runs inside the corridor
 * of provinces on the coarse route and their neighbours. Derived from static layers (terrain,
 * province), so it is rebuilt identically after a load and never saved.
 */
import { Terrain } from '../../shared/terrain';
import { boundKm, findPath, neighbours4, MIN_COST, MOVE_COST, type MobilityId, type NavGrid, type Passage, type PathResult } from './grid';

export interface ProvinceGraph {
  /** Node per cell (0 = none: water). Every walkable cell has one. */
  nodeOf: Uint32Array;
  nodeCount: number;
  /** Representative (centroid-nearest) cell per node. */
  centre: Int32Array;
  /** Mean move cost of the node's cells per mobility. */
  meanCost: readonly Float64Array[];
  /** Sorted neighbour lists. */
  adj: readonly number[][];
}

export function buildProvinceGraph(g: NavGrid, province: Uint16Array): ProvinceGraph {
  const n = g.w * g.h;
  const nodeOf = new Uint32Array(n);
  // The highest province of any cell, land or not: a province all of whose cells are water has
  // no cell here and is a node all the same, so that no crossing and no run below takes the id
  // of a province (PLAN 3.7j: `forceRevolt` and the revival read a node below
  // `provinces.count` as a province, and 4594 was both).
  let maxProv = 0;
  for (let c = 0; c < n; c++) {
    if (province[c]! > maxProv) maxProv = province[c]!;
    if (g.terrain[c]! >= Terrain.Plains && province[c]! > 0) nodeOf[c] = province[c]!;
  }
  // Crossing components become nodes maxProv+1, maxProv+2, ... (flood fill in index order).
  let next = maxProv + 1;
  for (let c = 0; c < n; c++) {
    if (g.terrain[c] !== Terrain.Crossing || nodeOf[c] !== 0) continue;
    const id = next++;
    const stack = [c];
    nodeOf[c] = id;
    while (stack.length) {
      const k = stack.pop()!;
      for (const m of neighbours4g(g, k)) {
        if (g.terrain[m] === Terrain.Crossing && nodeOf[m] === 0) {
          nodeOf[m] = id;
          stack.push(m);
        }
      }
    }
  }
  // Walkable land that no province has (2,726 cells of the 1938 map; land of a map import) is a
  // node by connected run as well, after the crossings: a cell with no node joined nothing, and
  // two parts of one landmass that only such a cell joins were two groups (PLAN 3.7j, ADR-170).
  for (let c = 0; c < n; c++) {
    if (g.component[c] === 0 || nodeOf[c] !== 0) continue;
    const id = next++;
    const stack = [c];
    nodeOf[c] = id;
    while (stack.length) {
      const k = stack.pop()!;
      for (const m of neighbours4g(g, k)) {
        if (g.component[m] !== 0 && nodeOf[m] === 0) {
          nodeOf[m] = id;
          stack.push(m);
        }
      }
    }
  }
  const nodeCount = next;
  const sx = new Float64Array(nodeCount);
  const sy = new Float64Array(nodeCount);
  const cnt = new Float64Array(nodeCount);
  const costSum = MOVE_COST.map(() => new Float64Array(nodeCount));
  const edges = new Set<number>();
  const adjSets: Set<number>[] = Array.from({ length: nodeCount }, () => new Set<number>());
  for (let c = 0; c < n; c++) {
    const a = nodeOf[c]!;
    if (a === 0) continue;
    const x = c % g.w;
    sx[a]! += x;
    sy[a]! += (c - x) / g.w;
    cnt[a]!++;
    for (let m = 0; m < MOVE_COST.length; m++) costSum[m]![a]! += MOVE_COST[m]![g.terrain[c]!]!;
    for (const k of neighbours4g(g, c)) {
      const b = nodeOf[k]!;
      if (b !== 0 && b !== a) {
        const key = a < b ? a * nodeCount + b : b * nodeCount + a;
        if (!edges.has(key)) {
          edges.add(key);
          adjSets[a]!.add(b);
          adjSets[b]!.add(a);
        }
      }
    }
  }
  const centre = new Int32Array(nodeCount).fill(-1);
  const best = new Float64Array(nodeCount).fill(Infinity);
  for (let c = 0; c < n; c++) {
    const a = nodeOf[c]!;
    if (a === 0) continue;
    const x = c % g.w;
    const dx = x - sx[a]! / cnt[a]!;
    const dy = (c - x) / g.w - sy[a]! / cnt[a]!;
    const d = dx * dx + dy * dy;
    if (d < best[a]!) {
      best[a] = d;
      centre[a] = c;
    }
  }
  const meanCost = costSum.map((s) => s.map((v, i) => (cnt[i]! > 0 ? v / cnt[i]! : Infinity)));
  const adj = adjSets.map((s) => [...s].sort((p, q) => p - q));
  return { nodeOf, nodeCount, centre, meanCost, adj };
}

function neighbours4g(g: NavGrid, c: number): number[] {
  return neighbours4(c, g.w, g.h, g.wrapX, []);
}

/** Coarse A* over nodes; returns the node sequence or null. */
export function coarseRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, from: number, to: number, only?: Uint8Array): number[] | null {
  const cost = pg.meanCost[mobility]!;
  if (!Number.isFinite(cost[from]!) || !Number.isFinite(cost[to]!)) return null;
  const h = (a: number): number => boundKm(g, pg.centre[a]!, pg.centre[to]!) * MIN_COST[mobility]!;
  const dist = new Float64Array(pg.nodeCount).fill(Infinity);
  const came = new Int32Array(pg.nodeCount).fill(-1);
  const done = new Uint8Array(pg.nodeCount);
  dist[from] = 0;
  // Small graph (~5k nodes): an O(V²)-free open list sorted by insertion is enough.
  const open: number[] = [from];
  const f = new Float64Array(pg.nodeCount).fill(Infinity);
  f[from] = h(from);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]!]! < f[open[bi]!]!) bi = i;
    const a = open.splice(bi, 1)[0]!;
    if (a === to) break;
    if (done[a]) continue;
    done[a] = 1;
    for (const b of pg.adj[a]!) {
      if (done[b] || !Number.isFinite(cost[b]!) || (only !== undefined && only[b] !== 1)) continue;
      const t = dist[a]! + boundKm(g, pg.centre[a]!, pg.centre[b]!) * 0.5 * (cost[a]! + cost[b]!);
      if (t < dist[b]!) {
        dist[b] = t;
        came[b] = a;
        f[b] = t + h(b);
        open.push(b);
      }
    }
  }
  if (!Number.isFinite(dist[to]!)) return null;
  const route = [to];
  for (let a = to; a !== from; ) {
    a = came[a]!;
    route.push(a);
  }
  return route.reverse();
}

/**
 * The groups of nodes joined by neighbours, among the nodes marked in `open` (numbered from 1;
 * 0 for a node that is not open).
 */
export function nodeGroups(pg: ProvinceGraph, open: Uint8Array): Int32Array {
  const group = new Int32Array(pg.nodeCount);
  const stack: number[] = [];
  let next = 0;
  for (let a = 1; a < pg.nodeCount; a++) {
    if (open[a] !== 1 || group[a] !== 0) continue;
    group[a] = ++next;
    stack.push(a);
    while (stack.length) {
      for (const b of pg.adj[stack.pop()!]!) {
        if (open[b] !== 1 || group[b] !== 0) continue;
        group[b] = next;
        stack.push(b);
      }
    }
  }
  return group;
}

/**
 * What `findRoute` asks before any search: the two cells are of one landmass, and, from a start
 * on open ground, of one group of provinces with open ground (`Passage.group`). False: there is
 * no route. True: there may be one. Who allots formations to places asks this first (the
 * operational AI, PLAN 3.5b).
 * Written twice: `planNation` (`ai/operational.ts`, where it fills `reached`) reads the landmass
 * and the two groups itself, per class of formations and not per formation. A change of this
 * test is a change of that one.
 */
export function mayReach(g: NavGrid, pg: ProvinceGraph, start: number, goal: number, pass?: Passage): boolean {
  if (g.component[start] === 0 || g.component[start] !== g.component[goal]) return false;
  // Who stands on closed ground walks on it and out of it: the provinces are not asked.
  if (pass?.group === undefined || pass.ok[pass.holder[start]!] !== 1) return true;
  const a = pg.nodeOf[start]!;
  const b = pg.nodeOf[goal]!;
  return a === 0 || b === 0 || pass.group[a] === pass.group[b];
}

/** Above this straight-line distance (km) routes are planned on the province graph first. */
export const COARSE_ABOVE_KM = 500;

/**
 * Land route for a mobility class: direct cell A* for short trips; for long ones, cell A*
 * restricted to the coarse route's provinces and their neighbours, with an unrestricted search
 * as the fallback if the corridor is too tight. `pass` keeps the route off closed ground. From
 * a start on open ground the two ends must lie in one group of provinces with open ground
 * (`Passage.group`), asked first and with no search; the route, long or short (PLAN 3.10c1c,
 * ADR-189), is planned over such provinces, and one that is not found in their corridor is
 * refused: a province with some open ground need not be open from side to side, and the search
 * beyond the corridor then walked all the ground the formation could reach (76,000 cells of
 * Africa, every day; it found a way 24 times in two years of seed 99, PLAN 3.4Rl).
 */
export function findRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, start: number, goal: number, pass?: Passage): PathResult | null {
  if (!mayReach(g, pg, start, goal, pass)) return null; // O(1) unreachable
  const a = pg.nodeOf[start]!;
  const b = pg.nodeOf[goal]!;
  // Who stands on closed ground walks on it and out of it: the provinces are not asked.
  const open = pass !== undefined && pass.ok[pass.holder[start]!] === 1 ? pass.open : undefined;
  // Over open ground a short route is held to the provinces too (two ends in one province: to
  // it and its neighbours): the search for a way that the cells do not give walked all the
  // formation could reach, 30 ms an order.
  if (a !== 0 && b !== 0 && (open !== undefined || (a !== b && boundKm(g, start, goal) > COARSE_ABOVE_KM))) {
    const was = g.barred;
    if (open !== undefined && was && was.goal === goal && was.from === a && was.mobility === mobility && was.ok === pass!.ok && g.scratch!.stamp[start] === was.closed) return null;
    const route = a === b ? [a] : coarseRoute(g, pg, mobility, a, b, open);
    if (!route) return null;
    const corridor = new Uint8Array(pg.nodeCount);
    for (const node of route) {
      corridor[node] = 1;
      for (const nb of pg.adj[node]!) corridor[nb] = 1;
    }
    const before = g.scratch?.gen;
    const inCorridor = findPath(g, mobility, start, goal, { nodeOf: pg.nodeOf, on: corridor }, pass);
    // (A search that was refused at once has no stamps of its own.)
    if (!inCorridor && open !== undefined && g.scratch && g.scratch.gen !== before) g.barred = { closed: 2 * g.scratch.gen + 1, from: a, goal, mobility, ok: pass!.ok };
    if (inCorridor || open !== undefined) return inCorridor;
  }
  return findPath(g, mobility, start, goal, undefined, pass);
}
