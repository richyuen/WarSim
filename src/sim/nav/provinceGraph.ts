/**
 * Coarse navigation graph (PLAN 1.11, SPEC §4): nodes are admin-1 provinces plus one virtual node
 * per connected group of crossing cells (straits) and one per connected run of walkable land that
 * no province has, edges join nodes whose cells touch (4-way, wrapping). Long routes are planned on this graph first; cell A* then runs inside the corridor
 * of provinces on the coarse route and their neighbours. Derived from static layers (terrain,
 * province), so it is rebuilt identically after a load and never saved.
 */
import { Terrain } from '../../shared/terrain';
import { boundKm, findPath, neighbours4, MIN_COST, MOVE_COST, POCKET_CELLS, type MobilityId, type NavGrid, type Passage, type PathResult } from './grid';

export interface ProvinceGraph {
  /** Node per cell (0 = none: water). Every walkable cell has one. */
  nodeOf: Uint32Array;
  nodeCount: number;
  /** Representative (centroid-nearest) cell per node. */
  centre: Int32Array;
  /** Cells per node. */
  cells: Int32Array;
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
  return { nodeOf, nodeCount, centre, cells: Int32Array.from(cnt), meanCost, adj };
}

function neighbours4g(g: NavGrid, c: number): number[] {
  return neighbours4(c, g.w, g.h, g.wrapX, []);
}

/**
 * What a node with closed ground costs the coarse route, times its own cost (PLAN 3.10c2b3b,
 * ADR-194): such a province need not be open from side to side, and the route goes round it
 * where that is less than eight times as far.
 */
export const SHUT_PRICE = 8;

/**
 * Coarse A* over nodes; returns the node sequence or null. `only`: the nodes it may take (the
 * first is not asked). `dear`: the nodes that cost SHUT_PRICE times their own.
 */
export function coarseRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, from: number, to: number, only?: Uint8Array, dear?: Uint8Array): number[] | null {
  const cost = pg.meanCost[mobility]!;
  const price = (a: number): number => (dear !== undefined && dear[a] === 1 ? SHUT_PRICE * cost[a]! : cost[a]!);
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
      const t = dist[a]! + boundKm(g, pg.centre[a]!, pg.centre[b]!) * 0.5 * (price(a) + price(b));
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
 * The wide ground a node lies in (PLAN 3.10c2b, ADR-192), or 0 for a node in none: the node has
 * no closed ground, and with the nodes of no closed ground it is joined to by neighbours it has
 * more than POCKET_CELLS cells. Those nodes are one wide ground, and its number is that of the
 * node it was first asked for (PLAN 3.10c2b3a, ADR-193: there is more than one, and the cells of
 * two need not meet). Who stands in such a node stands in no pocket (`pocketOf`), and the cells
 * are not walked to find that out: most formations of most nations stand in one. The nodes are
 * walked from this one, and the answer is kept for all of them.
 */
export function wideNode(pg: ProvinceGraph, pass: Passage, node: number): number {
  const { open, shut } = pass;
  if (!open || !shut) return 0;
  const memo = (pass.wide ??= new Int32Array(pg.nodeCount));
  if (memo[node] !== 0) return Math.max(0, memo[node]!);
  const clear = (a: number): boolean => open[a] === 1 && shut[a] !== 1;
  if (!clear(node)) {
    memo[node] = -1;
    return 0;
  }
  // In hand: marked -2.
  const walked = [node];
  memo[node] = -2;
  let cells = 0;
  for (let at = 0; at < walked.length; at++) {
    const a = walked[at]!;
    cells += pg.cells[a]!;
    for (const b of pg.adj[a]!) {
      if (memo[b] !== 0 || !clear(b)) continue;
      memo[b] = -2;
      walked.push(b);
    }
  }
  const ground = cells > POCKET_CELLS ? node : -1;
  for (const a of walked) memo[a] = ground;
  return Math.max(0, ground);
}

/** The cells of each node, ascending: those of node `a` are `list[start[a]]` to `list[start[a + 1] - 1]`. */
function cellsByNode(pg: ProvinceGraph): { start: Int32Array; list: Int32Array } {
  let made = CELLS_BY_NODE.get(pg);
  if (!made) {
    const { nodeOf, nodeCount } = pg;
    const start = new Int32Array(nodeCount + 1);
    for (let c = 0; c < nodeOf.length; c++) if (nodeOf[c] !== 0) start[nodeOf[c]! + 1]!++;
    for (let a = 0; a < nodeCount; a++) start[a + 1]! += start[a]!;
    const list = new Int32Array(start[nodeCount]!);
    const at = start.slice();
    for (let c = 0; c < nodeOf.length; c++) if (nodeOf[c] !== 0) list[at[nodeOf[c]!]!++] = c;
    CELLS_BY_NODE.set(pg, (made = { start, list }));
  }
  return made;
}
const CELLS_BY_NODE = new WeakMap<ProvinceGraph, { start: Int32Array; list: Int32Array }>();
/** By grid, the cells `joinWide` has walked: `stamp[c]` is `gen` for those of the walk in hand. */
const JOIN_SCRATCH = new WeakMap<NavGrid, { stamp: Uint32Array; gen: number; stack: number[] }>();
const STEP_X = [1, -1, 0, 0, 1, 1, -1, -1];
const STEP_Y = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * Whether the cells join two wide grounds (`wideNode`'s numbers) on a passage (PLAN 3.10c2b3a,
 * ADR-193): a route over open ground comes from the one to the other. Two wide grounds are apart
 * by the nodes, so what joins them is open ground of nodes that have closed ground too. Worked
 * out once a passage, when it is first asked, and kept (`Passage.joined`).
 */
export function wideJoined(g: NavGrid, pg: ProvinceGraph, pass: Passage, a: number, b: number): boolean {
  if (a === b) return true;
  const joined = (pass.joined ??= joinWide(g, pg, pass));
  return joined[a] === joined[b];
}

/**
 * By node with no closed ground: a number that two such nodes share when a route over open
 * ground comes from the one to the other (0 for every other node). The groups of such nodes
 * (`nodeGroups`: the cells of neighbours meet) are joined where a run of open cells in the
 * nodes that have closed ground touches two of them. Only those cells are walked (`findPath`'s
 * steps, as `pocketOf` walks them): 30,000 of the 1938 map's 204,000 in a fifth year, 18,000 of
 * them open.
 */
function joinWide(g: NavGrid, pg: ProvinceGraph, pass: Passage): Int32Array {
  const open = pass.open!;
  const shut = pass.shut!;
  const { nodeOf, nodeCount } = pg;
  const clear = new Uint8Array(nodeCount);
  for (let a = 1; a < nodeCount; a++) if (open[a] === 1 && shut[a] !== 1) clear[a] = 1;
  const group = nodeGroups(pg, clear);
  // Union-find over the groups (by their numbers) and, after them, the runs of open cells.
  const parent: number[] = [0];
  for (let a = 1; a < nodeCount; a++) while (parent.length <= group[a]!) parent.push(parent.length);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
    return x;
  };
  const { w, h, wrapX, component } = g;
  const { ok, holder } = pass;
  let sc = JOIN_SCRATCH.get(g);
  if (!sc || sc.stamp.length !== w * h) JOIN_SCRATCH.set(g, (sc = { stamp: new Uint32Array(w * h), gen: 0, stack: [] }));
  if (++sc.gen === 0xffffffff) {
    sc.stamp.fill(0);
    sc.gen = 1;
  }
  const { stamp, gen, stack } = sc;
  const { start, list } = cellsByNode(pg);
  for (let a = 1; a < nodeCount; a++) {
    if (open[a] !== 1 || shut[a] !== 1) continue;
    for (let i = start[a]!; i < start[a + 1]!; i++) {
      const first = list[i]!;
      if (stamp[first] === gen || component[first] === 0 || ok[holder[first]!] !== 1) continue;
      const run = parent.length;
      parent.push(run);
      stamp[first] = gen;
      stack.push(first);
      while (stack.length > 0) {
        const c = stack.pop()!;
        const cx = c % w;
        const cy = (c - cx) / w;
        for (let k = 0; k < 8; k++) {
          const dx = STEP_X[k]!;
          const dy = STEP_Y[k]!;
          const ny = cy + dy;
          if (ny < 0 || ny >= h) continue;
          let nx = cx + dx;
          if (nx < 0 || nx >= w) {
            if (!wrapX) continue;
            nx = (nx + w) % w;
          }
          const n = ny * w + nx;
          if (component[n] === 0 || ok[holder[n]!] !== 1) continue;
          // No corner cutting, as in `findPath`: by the terrain, whoever holds the two cells.
          if (dx !== 0 && dy !== 0 && (component[cy * w + nx] === 0 || component[ny * w + cx] === 0)) continue;
          const met = group[nodeOf[n]!]!;
          if (met !== 0) {
            parent[find(run)] = find(met);
            continue;
          }
          if (stamp[n] === gen) continue;
          stamp[n] = gen;
          stack.push(n);
        }
      }
    }
  }
  const joined = new Int32Array(nodeCount);
  for (let a = 1; a < nodeCount; a++) if (group[a] !== 0) joined[a] = find(group[a]!);
  return joined;
}

/**
 * What `findRoute` asks before any search: the two cells are of one landmass, and, from a start
 * on open ground, of one group of provinces with open ground (`Passage.group`). False: there is
 * no route. True: there may be one. Who allots formations to places asks this first (the
 * operational AI, PLAN 3.5b).
 * Written twice: `planNation` (`ai/operational.ts`, where it fills `reached`) reads the landmass
 * and the two groups itself, per class of formations and not per formation. A change of this
 * test is a change of that one. It asks two things more, which this test does not: whether the
 * start and the goal are in one pocket of open ground or in none (`pocketOf`; PLAN 3.10c2b,
 * ADR-192), and whether two wide grounds are joined (`wideJoined`; PLAN 3.10c2b3a, ADR-193).
 * Here that is left to the search, which finds no way.
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
 * Africa, every day; it found a way 24 times in two years of seed 99, PLAN 3.4Rl). For the same
 * reason the plan over the provinces takes one that has closed ground too at SHUT_PRICE times
 * its cost (PLAN 3.10c2b3b, ADR-194): the way by the cells went round such a province through
 * provinces that were no neighbours of the route's, and the corridor did not hold it.
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
    const route = a === b ? [a] : coarseRoute(g, pg, mobility, a, b, open, open !== undefined ? pass!.shut : undefined);
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
