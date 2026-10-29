/**
 * Coarse navigation graph (PLAN 1.11, SPEC §4): nodes are admin-1 provinces plus one virtual node
 * per connected group of crossing cells (straits) and one per connected run of walkable land that
 * no province has, edges join nodes whose cells touch (4-way, wrapping). Long routes are planned on this graph first; cell A* then runs inside the corridor
 * of provinces on the coarse route and their neighbours. Derived from static layers (terrain,
 * province), so it is rebuilt identically after a load and never saved.
 */
import { Terrain } from '../../shared/terrain';
import { boundKm, findPath, neighbours4, MIN_COST, MOVE_COST, POCKET_CELLS, type JoinRuns, type MobilityId, type NavGrid, type Passage, type PathResult, type WideLinks } from './grid';

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
 * The open nodes are taken by the lowest f, of equals the first put in (PLAN 7.1g: a heap of
 * them with their f lowered in place takes them in the order of the list that was scanned).
 */
export function coarseRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, from: number, to: number, only?: Uint8Array, dear?: Uint8Array): number[] | null {
  const cost = pg.meanCost[mobility]!;
  const price = (a: number): number => (dear !== undefined && dear[a] === 1 ? SHUT_PRICE * cost[a]! : cost[a]!);
  if (!Number.isFinite(cost[from]!) || !Number.isFinite(cost[to]!)) return null;
  const h = (a: number): number => boundKm(g, pg.centre[a]!, pg.centre[to]!) * MIN_COST[mobility]!;
  let sc = COARSE_SCRATCH.get(pg);
  if (!sc) {
    const n = pg.nodeCount;
    sc = { dist: new Float64Array(n), f: new Float64Array(n), came: new Int32Array(n), first: new Int32Array(n), at: new Int32Array(n), heap: new Int32Array(n), stamp: new Uint32Array(n), gen: 0 };
    COARSE_SCRATCH.set(pg, sc);
  }
  if (++sc.gen === 0xffffffff) {
    sc.stamp.fill(0);
    sc.gen = 1;
  }
  // A node met in this call (`stamp` is `gen`) has its `dist`, `f`, `came` and `first` (the
  // order it was put in); `at` is its place in the heap, -1 once it is taken.
  const { dist, f, came, first, at, heap, stamp, gen } = sc;
  const before = (a: number, b: number): boolean => f[a]! < f[b]! || (f[a] === f[b] && first[a]! < first[b]!);
  const up = (i: number): void => {
    const a = heap[i]!;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const b = heap[p]!;
      if (!before(a, b)) break;
      heap[i] = b;
      at[b] = i;
      i = p;
    }
    heap[i] = a;
    at[a] = i;
  };
  let size = 0;
  const down = (i: number): void => {
    const a = heap[i]!;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && before(heap[c + 1]!, heap[c]!)) c++;
      const b = heap[c]!;
      if (!before(b, a)) break;
      heap[i] = b;
      at[b] = i;
      i = c;
    }
    heap[i] = a;
    at[a] = i;
  };
  let put = 0;
  stamp[from] = gen;
  dist[from] = 0;
  f[from] = h(from);
  first[from] = put++;
  heap[size++] = from;
  at[from] = 0;
  while (size > 0) {
    const a = heap[0]!;
    at[a] = -1;
    if (--size > 0) {
      heap[0] = heap[size]!;
      down(0);
    }
    if (a === to) break;
    for (const b of pg.adj[a]!) {
      const met = stamp[b] === gen;
      if ((met && at[b] === -1) || !Number.isFinite(cost[b]!) || (only !== undefined && only[b] !== 1)) continue;
      const t = dist[a]! + boundKm(g, pg.centre[a]!, pg.centre[b]!) * 0.5 * (price(a) + price(b));
      if (met && t >= dist[b]!) continue;
      dist[b] = t;
      came[b] = a;
      f[b] = t + h(b);
      if (met) up(at[b]!);
      else {
        stamp[b] = gen;
        first[b] = put++;
        heap[size] = b;
        up(size++);
      }
    }
  }
  if (stamp[to] !== gen) return null;
  const route = [to];
  for (let a = to; a !== from; ) {
    a = came[a]!;
    route.push(a);
  }
  return route.reverse();
}
/** By graph, `coarseRoute`'s arrays, kept between calls. */
const COARSE_SCRATCH = new WeakMap<ProvinceGraph, { dist: Float64Array; f: Float64Array; came: Int32Array; first: Int32Array; at: Int32Array; heap: Int32Array; stamp: Uint32Array; gen: number }>();

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
/**
 * By grid, the cells `joinWide` has walked: `stamp[c]` is `gen` for those of the walk in hand,
 * and `runOf[c]` their run where the runs are kept (made when first needed).
 */
const JOIN_SCRATCH = new WeakMap<NavGrid, { stamp: Uint32Array; gen: number; stack: number[]; runOf?: Int32Array }>();
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
  let joined = pass.joined;
  if (!joined) {
    const keep = pass.keep;
    const walked = joinWide(g, pg, pass, keep !== undefined);
    pass.joined = joined = walked.joined;
    if (keep) {
      keep.joined = joined;
      keep.runs = walked.runs;
    }
    JOIN_PROBE.walk?.(pass, joined);
  }
  return joined[a] === joined[b];
}

/**
 * `wideJoined`'s answer for one pair, walking no more than it needs (PLAN 7.129): from the
 * passage's `joined` where it has one; else the runs of open cells that `joinWide` walks are
 * walked outwards from the two grounds' groups, each run once a passage (`Passage.link`; kept for
 * the passages after it on the same parts while no cell goes between an open and a closed holder,
 * `passageWith`, PLAN 7.157), until the two are joined or one of them has no group left to walk from. The same answer as
 * `joinWide`'s: a run that meets a group has a cell next to a cell of it, in a node next to one of
 * the group's nodes (`adjacent8`, diagonals too), and the open cells of every such node are walked.
 * A run is of `joinWide`'s only if one of its cells is in a node of open and closed ground (where
 * `joinWide`'s runs start), and only such a run joins groups here. `joined` is not made.
 */
export function wideLinked(g: NavGrid, pg: ProvinceGraph, pass: Passage, a: number, b: number): boolean {
  if (a === b) return true;
  if (pass.joined) return pass.joined[a] === pass.joined[b];
  const sc = linkScratch(g);
  let st = pass.link;
  if (!st || st.epoch !== sc.epoch) {
    pass.link = st = makeLinks(pg, pass, sc);
    if (pass.keep) pass.keep.link = st;
  }
  const ga = st.group[a]!;
  const gb = st.group[b]!;
  // `joined` is 0 for a node of no group, and a group's root otherwise.
  if (ga === 0 || gb === 0) return ga === gb;
  for (;;) {
    const ra = linkRoot(st.parent, ga);
    const rb = linkRoot(st.parent, gb);
    if (ra === rb) return true;
    const pa = (st.pending[ra] ??= [ra]);
    const pb = (st.pending[rb] ??= [rb]);
    if (pa.length === 0 || pb.length === 0) return false;
    walkGroup(g, pg, pass, st, sc, (pa.length <= pb.length ? pa : pb).pop()!);
  }
}

interface LinkScratch {
  stamp: Uint32Array;
  gen: number;
  epoch: number;
  stack: number[];
}

/** By grid, `wideLinked`'s cell stamps; `epoch` moves when they are cleared. */
const LINK_SCRATCH = new WeakMap<NavGrid, LinkScratch>();

function linkScratch(g: NavGrid): LinkScratch {
  let sc = LINK_SCRATCH.get(g);
  if (!sc || sc.stamp.length !== g.w * g.h) LINK_SCRATCH.set(g, (sc = { stamp: new Uint32Array(g.w * g.h), gen: 0, epoch: 0, stack: [] }));
  return sc;
}

function makeLinks(pg: ProvinceGraph, pass: Passage, sc: LinkScratch): WideLinks {
  if (++sc.gen === 0xffffffff) {
    sc.stamp.fill(0);
    sc.gen = 1;
    sc.epoch++;
  }
  const open = pass.open!;
  const shut = pass.shut!;
  const { nodeCount } = pg;
  const clear = new Uint8Array(nodeCount);
  for (let a = 1; a < nodeCount; a++) if (open[a] === 1 && shut[a] !== 1) clear[a] = 1;
  const group = nodeGroups(pg, clear);
  let groups = 0;
  for (let a = 1; a < nodeCount; a++) if (group[a]! > groups) groups = group[a]!;
  const start = new Int32Array(groups + 2);
  for (let a = 1; a < nodeCount; a++) if (group[a] !== 0) start[group[a]! + 1]!++;
  for (let k = 0; k <= groups; k++) start[k + 1]! += start[k]!;
  const nodes = new Int32Array(start[groups + 1]!);
  const at = start.slice();
  for (let a = 1; a < nodeCount; a++) if (group[a] !== 0) nodes[at[group[a]!]!++] = a;
  const parent = new Int32Array(groups + 1);
  for (let k = 0; k <= groups; k++) parent[k] = k;
  return { group, start, nodes, parent, pending: [], walked: new Uint8Array(nodeCount), gen: sc.gen, epoch: sc.epoch };
}

function linkRoot(parent: Int32Array, x: number): number {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
  return x;
}

/** Joins two groups' sets, and their groups still to walk from. */
function linkUnion(st: WideLinks, x: number, y: number): void {
  let rx = linkRoot(st.parent, x);
  let ry = linkRoot(st.parent, y);
  if (rx === ry) return;
  let px = (st.pending[rx] ??= [rx]);
  let py = (st.pending[ry] ??= [ry]);
  if (px.length < py.length) {
    [rx, ry] = [ry, rx];
    [px, py] = [py, px];
  }
  st.parent[ry] = rx;
  for (const k of py) px.push(k);
  st.pending[ry] = undefined;
}

/** Walks the runs of open cells in the nodes of no group next to group `k`'s nodes. */
function walkGroup(g: NavGrid, pg: ProvinceGraph, pass: Passage, st: WideLinks, sc: LinkScratch, k: number): void {
  const { w, h, wrapX, component } = g;
  const { ok, holder } = pass;
  const open = pass.open!;
  const shut = pass.shut!;
  const { nodeOf } = pg;
  const { group, walked } = st;
  const { stamp, stack } = sc;
  const gen = st.gen;
  const adj = adjacent8(g, pg);
  const cells = cellsByNode(pg);
  const met: number[] = [];
  for (let j = st.start[k]!; j < st.start[k + 1]!; j++) {
    const v = st.nodes[j]!;
    for (let e = adj.start[v]!; e < adj.start[v + 1]!; e++) {
      const u = adj.list[e]!;
      if (group[u] !== 0 || walked[u] === 1) continue;
      walked[u] = 1;
      for (let i = cells.start[u]!; i < cells.start[u + 1]!; i++) {
        const first = cells.list[i]!;
        if (stamp[first] === gen || component[first] === 0 || ok[holder[first]!] !== 1) continue;
        // One run, as `joinWide` walks it: the groups it meets, and whether it is one of `joinWide`'s.
        met.length = 0;
        let mixed = false;
        stamp[first] = gen;
        stack.push(first);
        while (stack.length > 0) {
          const c = stack.pop()!;
          const node = nodeOf[c]!;
          if (open[node] === 1 && shut[node] === 1) mixed = true;
          const cx = c % w;
          const cy = (c - cx) / w;
          for (let d = 0; d < 8; d++) {
            const dx = STEP_X[d]!;
            const dy = STEP_Y[d]!;
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
            const m = group[nodeOf[n]!]!;
            if (m !== 0) {
              met.push(m);
              continue;
            }
            if (stamp[n] === gen) continue;
            stamp[n] = gen;
            stack.push(n);
          }
        }
        if (mixed) for (let q = 1; q < met.length; q++) linkUnion(st, met[0]!, met[q]!);
      }
    }
  }
}

/** By node, the nodes that one of its cells is next to, diagonals too (`adjacent8`). */
const ADJ8 = new WeakMap<ProvinceGraph, { start: Int32Array; list: Int32Array }>();

/** The province graph's nodes by cells next to each other, diagonals too (`wideLinked`): built once a graph. */
export function adjacent8(g: NavGrid, pg: ProvinceGraph): { start: Int32Array; list: Int32Array } {
  let made = ADJ8.get(pg);
  if (made) return made;
  const { w, h, wrapX } = g;
  const { nodeOf, nodeCount } = pg;
  const near: Set<number>[] = Array.from({ length: nodeCount }, () => new Set<number>());
  for (let c = 0; c < w * h; c++) {
    const a = nodeOf[c]!;
    if (a === 0) continue;
    const cx = c % w;
    const cy = (c - cx) / w;
    for (let d = 0; d < 8; d++) {
      const ny = cy + STEP_Y[d]!;
      if (ny < 0 || ny >= h) continue;
      let nx = cx + STEP_X[d]!;
      if (nx < 0 || nx >= w) {
        if (!wrapX) continue;
        nx = (nx + w) % w;
      }
      const b = nodeOf[ny * w + nx]!;
      if (b !== 0 && b !== a) near[a]!.add(b);
    }
  }
  const start = new Int32Array(nodeCount + 1);
  for (let a = 0; a < nodeCount; a++) start[a + 1] = start[a]! + near[a]!.size;
  const list = new Int32Array(start[nodeCount]!);
  for (let a = 0; a < nodeCount; a++) list.set([...near[a]!].sort((x, y) => x - y), start[a]!);
  ADJ8.set(pg, (made = { start, list }));
  return made;
}

/**
 * PLAN 7.30c's measure (`tools/diag/joinWalks.ts`): told of each walk of `joinWide`, and of each
 * passage whose `joined` was kept across flips judged by `joinedKept` (`passageWith`, PLAN
 * 7.30c2). Unset, nothing is told.
 */
export const JOIN_PROBE: { walk?: (pass: Passage, joined: Int32Array) => void; kept?: (pass: Passage) => void } = {};

/** `joinWide`'s answer walked afresh, nothing kept (the check of PLAN 7.30c2's rule, `joinWalks.ts`). */
export function joinWideAfresh(g: NavGrid, pg: ProvinceGraph, pass: Passage): Int32Array {
  return joinWide(g, pg, pass, false).joined;
}

/**
 * The most `JoinRuns` a grid keeps live (PLAN 7.30c2, ADR-524): past it, the oldest is dropped,
 * and its answer is undone by the next flip between an open and a closed holder, as before.
 */
export const JOIN_RUNS_KEPT = 16;
const RUNS_HELD = new WeakMap<NavGrid, JoinRuns[]>();

/** Drops what a `JoinRuns` holds: it judges no flip after this. */
export function dropRuns(runs: JoinRuns): void {
  runs.dropped = true;
  runs.cells = runs.run = runs.group = new Int32Array(0);
  runs.since.clear();
  runs.parent = [];
  runs.cls = [];
  runs.met = [];
  runs.two = [];
}

function holdRuns(g: NavGrid, runs: JoinRuns): void {
  let held = RUNS_HELD.get(g);
  if (!held) RUNS_HELD.set(g, (held = []));
  let n = 0;
  for (const r of held) if (!r.dropped) held[n++] = r;
  held.length = n;
  if (n >= JOIN_RUNS_KEPT) dropRuns(held.shift()!);
  held.push(runs);
}

/** The element of `parent` that is the root of `x`'s set. */
function rootOf(parent: number[], x: number): number {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
  return x;
}

/** The index of `cell` in the ascending `cells`, or -1. */
function indexOf(cells: Int32Array, cell: number): number {
  let lo = 0;
  let hi = cells.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cells[mid]!;
    if (c === cell) return mid;
    if (c < cell) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/**
 * Whether `joinWide`'s answer `joined` holds after a cell's flip between an open and a closed
 * holder (`opens`: from closed to open), given the flips since the walk judged before it in their
 * order (PLAN 7.30c2, ADR-524; `docs/evidence/7.30/measure-c.md` §2.3). `open` and `shut` are
 * those of the walk (`passageWith` keeps `joined` only while they are). The answer is of the clear
 * nodes' groups and of the runs of open cells of the mixed nodes that meet them; the runs, and
 * the cells opened since, are sets that the openings join (`JoinRuns.parent`), each with the
 * groups it has met. So:
 * - a cell of no land, which the walk never reads: holds;
 * - a cell of no node, or of a node that is not mixed: undone (the walk's own cells then);
 * - a closing: holds if the cell's set met one group or none (split, it joins nothing it did
 *   not), or if the cell touches no clear ground and its open neighbours are joined by steps
 *   among themselves (no way through it is lost: `aroundJoined`); else undone;
 * - an opening: undone if its open neighbours (`findPath`'s steps, as the walk takes them) are of
 *   two classes that hold groups; else their sets are joined through it, and it holds.
 * The state of a neighbour is the walk's and the flips judged before (`since`), not the cell's
 * holder now. A set only grows, so it holds every cell its cells are joined to, and more. False
 * also leaves `runs` part-written: the caller drops it.
 */
export function joinedKept(g: NavGrid, pg: ProvinceGraph, open: Uint8Array, shut: Uint8Array, joined: Int32Array, runs: JoinRuns, cell: number, opens: boolean): boolean {
  if (g.component[cell] === 0) return true;
  const node = pg.nodeOf[cell]!;
  if (node === 0 || open[node] !== 1 || shut[node] !== 1) return false;
  const { since, parent, cls, met, two, group } = runs;
  const at = elementOf(runs, cell);
  if (!opens) {
    if (at < 0) return false;
    if (two[rootOf(parent, at)] === 1 && !aroundJoined(g, pg, open, shut, runs, cell)) return false;
    since.set(cell, -1);
    return true;
  }
  if (at >= 0) return false;
  const e = parent.length;
  parent.push(e);
  cls.push(0);
  met.push(0);
  two.push(0);
  for (let k = 0; k < 8; k++) {
    const n = stepOf(g, cell, k);
    if (n < 0) continue;
    const nn = pg.nodeOf[n]!;
    if (nn === 0) return false;
    if (open[nn] !== 1) continue;
    const r = rootOf(parent, e);
    if (shut[nn] !== 1) {
      // A cell of a clear node: open, of its group and its group's class.
      const v = joined[nn]!;
      if (cls[r] === 0) cls[r] = v;
      else if (cls[r] !== v) return false;
      const m = group[nn]!;
      if (met[r] === 0) met[r] = m;
      else if (met[r] !== m) two[r] = 1;
      continue;
    }
    const el = elementOf(runs, n);
    if (el < 0) continue;
    const q = rootOf(parent, el);
    if (q === r) continue;
    const ca = cls[r]!;
    const cb = cls[q]!;
    if (ca !== 0 && cb !== 0 && ca !== cb) return false;
    parent[r] = q;
    if (cb === 0) cls[q] = ca;
    const ma = met[r]!;
    const mb = met[q]!;
    if (two[r] === 1 || (ma !== 0 && mb !== 0 && ma !== mb)) two[q] = 1;
    if (mb === 0) met[q] = ma;
  }
  since.set(cell, e);
  return true;
}

/** A cell's element of `JoinRuns.parent` as the walk and the flips judged since leave it, or -1: closed. */
function elementOf(runs: JoinRuns, cell: number): number {
  const s = runs.since.get(cell);
  if (s !== undefined) return s;
  const i = indexOf(runs.cells, cell);
  return i < 0 ? -1 : runs.run[i]!;
}

/** The neighbour of `cell` by `findPath`'s step k (as `joinWide` takes it: on land, no corner cut), or -1. */
function stepOf(g: NavGrid, cell: number, k: number): number {
  const { w, h, wrapX, component } = g;
  const dx = STEP_X[k]!;
  const dy = STEP_Y[k]!;
  const cx = cell % w;
  const cy = (cell - cx) / w;
  const ny = cy + dy;
  if (ny < 0 || ny >= h) return -1;
  let nx = cx + dx;
  if (nx < 0 || nx >= w) {
    if (!wrapX) return -1;
    nx = (nx + w) % w;
  }
  const n = ny * w + nx;
  if (component[n] === 0) return -1;
  if (dx !== 0 && dy !== 0 && (component[cy * w + nx] === 0 || component[ny * w + cx] === 0)) return -1;
  return n;
}

/**
 * Whether a cell's closing loses no way between other cells (PLAN 7.30c2): it touches no cell of
 * a clear node (whose group it may be all that meets), and its open neighbours are joined by
 * steps among themselves, so a way through it goes round it. By the state of `elementOf`.
 */
function aroundJoined(g: NavGrid, pg: ProvinceGraph, open: Uint8Array, shut: Uint8Array, runs: JoinRuns, cell: number): boolean {
  const ring: number[] = [];
  for (let k = 0; k < 8; k++) {
    const n = stepOf(g, cell, k);
    if (n < 0) continue;
    const nn = pg.nodeOf[n]!;
    if (nn === 0) return false;
    if (open[nn] !== 1) continue;
    if (shut[nn] !== 1) return false;
    if (elementOf(runs, n) >= 0) ring.push(n);
  }
  if (ring.length <= 1) return true;
  let seen = 1;
  const stack = [0];
  while (stack.length > 0) {
    const p = ring[stack.pop()!]!;
    for (let k = 0; k < 8; k++) {
      const q = stepOf(g, p, k);
      if (q < 0) continue;
      const j = ring.indexOf(q);
      if (j < 0 || (seen & (1 << j)) !== 0) continue;
      seen |= 1 << j;
      stack.push(j);
    }
  }
  return seen === (1 << ring.length) - 1;
}

/** How many times the cells of a grid were walked for `wideJoined` (the tests count them). */
export function joinWalks(g: NavGrid): number {
  return JOIN_SCRATCH.get(g)?.gen ?? 0;
}

/**
 * By node with no closed ground: a number that two such nodes share when a route over open
 * ground comes from the one to the other (0 for every other node). The groups of such nodes
 * (`nodeGroups`: the cells of neighbours meet) are joined where a run of open cells in the
 * nodes that have closed ground touches two of them. Only those cells are walked (`findPath`'s
 * steps, as `pocketOf` walks them): 30,000 of the 1938 map's 204,000 in a fifth year, 18,000 of
 * them open. What it reads: `open` and `shut`, and of the cells which are open (`ok` of their
 * holder); the rest is of the map. `passageOf` keeps the answer on that (PLAN 7.1i).
 */
function joinWide(g: NavGrid, pg: ProvinceGraph, pass: Passage, keepRuns: boolean): { joined: Int32Array; runs?: JoinRuns } {
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
  const runOf = keepRuns ? (sc.runOf ??= new Int32Array(w * h)) : undefined;
  const { start, list } = cellsByNode(pg);
  // The runs (PLAN 7.30c2), when kept: each cell walked (`runOf` its run), the first group each
  // run met, and whether it met another.
  const runCells: number[] = [];
  const firstMet: number[] = [];
  const metTwo: number[] = [];
  const groups = parent.length;
  for (let a = 1; a < nodeCount; a++) {
    if (open[a] !== 1 || shut[a] !== 1) continue;
    for (let i = start[a]!; i < start[a + 1]!; i++) {
      const first = list[i]!;
      if (stamp[first] === gen || component[first] === 0 || ok[holder[first]!] !== 1) continue;
      const run = parent.length;
      parent.push(run);
      if (keepRuns) {
        firstMet.push(0);
        metTwo.push(0);
      }
      stamp[first] = gen;
      stack.push(first);
      while (stack.length > 0) {
        const c = stack.pop()!;
        if (runOf) {
          runCells.push(c);
          runOf[c] = run - groups;
        }
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
            if (keepRuns) {
              const r = run - groups;
              if (firstMet[r] === 0) firstMet[r] = met;
              else if (firstMet[r] !== met) metTwo[r] = 1;
            }
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
  if (!runOf) return { joined };
  // Each cell is walked once, so by cell alone (PLAN 7.105: a sort of the packed numbers was half
  // the walk in a late world).
  const cells = sortCells(runCells, w * h);
  const run = new Int32Array(cells.length);
  for (let i = 0; i < cells.length; i++) run[i] = runOf[cells[i]!]!;
  const runs: JoinRuns = {
    cells,
    run,
    group,
    since: new Map(),
    parent: Array.from({ length: firstMet.length }, (_, r) => r),
    cls: firstMet.map((m) => (m === 0 ? 0 : find(m))),
    met: firstMet,
    two: metTwo,
    dropped: false,
  };
  holdRuns(g, runs);
  return { joined, runs };
}
/** The bits of a digit of `sortCells`. */
const SORT_BITS = 11;

/**
 * `cells` (distinct, each below `size`) ascending: a sort by digits of SORT_BITS bits, the lowest
 * first, as many as `size` needs.
 */
export function sortCells(cells: readonly number[], size: number): Int32Array {
  const n = cells.length;
  let from = Int32Array.from(cells);
  if (n < 2) return from;
  let to = new Int32Array(n);
  const count = new Int32Array(1 << SORT_BITS);
  const mask = (1 << SORT_BITS) - 1;
  // The digits `size` needs (a shift of 32 or more would be read modulo 32).
  const bits = 32 - Math.clz32(size - 1);
  for (let shift = 0; shift < bits; shift += SORT_BITS) {
    count.fill(0);
    for (let i = 0; i < n; i++) count[(from[i]! >>> shift) & mask]!++;
    let sum = 0;
    for (let d = 0; d <= mask; d++) {
      const k = count[d]!;
      count[d] = sum;
      sum += k;
    }
    for (let i = 0; i < n; i++) to[count[(from[i]! >>> shift) & mask]!++] = from[i]!;
    const t = from;
    from = to;
    to = t;
  }
  return from;
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
 * A route asked again on the same passage is the one found the first time (`Passage.routes`).
 */
export function findRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, start: number, goal: number, pass?: Passage): PathResult | null {
  // With no limit no route is 'long'.
  if (!pass) return searchRoute(g, pg, mobility, start, goal) as PathResult | null;
  const key = (mobility * g.w * g.h + start) * g.w * g.h + goal;
  const routes = (pass.routes ??= new Map());
  const known = routes.get(key);
  if (known !== undefined) return known;
  const route = searchRoute(g, pg, mobility, start, goal, pass) as PathResult | null;
  routes.set(key, route);
  return route;
}

/**
 * A coarse route over its provinces is held to be longer than the cells' way when it is longer than
 * this times the limit (`findDirectRoute`): a way by the provinces' centres zigzags where the cells
 * cut across. Seed 99's first 20 days: the coarse way over the cells' 0.90 to 2.80 times (255
 * ways; median 1.07, 2.19 at the 99th hundredth).
 */
export const COARSE_SLACK = 3;

/**
 * `findRoute` held to a length (PLAN 1.42h, ADR-422): 'long' where the way is longer than `longest`
 * steps of cells, or its coarse route by the provinces' centres longer than COARSE_SLACK times that
 * (then no cell is searched: the long ways of ADR-414 f were searches of 8 to 14 ms). A route found
 * is kept by the passage as `findRoute` keeps it; a coarse route found too long is not, and
 * `findRoute` asked for the same then searches.
 */
export function findDirectRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, start: number, goal: number, pass: Passage, longest: number): PathResult | null | 'long' {
  const key = (mobility * g.w * g.h + start) * g.w * g.h + goal;
  const routes = (pass.routes ??= new Map());
  let route = routes.get(key);
  if (route === undefined) {
    const found = searchRoute(g, pg, mobility, start, goal, pass, longest);
    if (found === 'long') return 'long';
    routes.set(key, (route = found));
  }
  return route !== null && route.cells.length - 1 > longest ? 'long' : route;
}

/** Steps of cells from one cell to another, a step to any of eight: over the seam where the map loops. */
function steps(g: NavGrid, a: number, b: number): number {
  let dx = Math.abs((a % g.w) - (b % g.w));
  if (g.wrapX && dx > g.w / 2) dx = g.w - dx;
  return Math.max(dx, Math.abs(Math.floor(a / g.w) - Math.floor(b / g.w)));
}

/**
 * What a refusal by the cells of a corridor read (PLAN 7.30b): the corridor's nodes (`on`), and the
 * passage's `open` and `shut` that the route over the nodes was planned on. A search from open
 * ground in a corridor enters open cells only, and reads the holders of the corridor's cells
 * alone; the route is of `open` and `shut` alone. So it is refused again while the route over the
 * nodes is the same (`route`: kept while `open` and `shut` are, else planned again, PLAN 7.124), its
 * start is open, and no cell of the corridor's nodes has gone from a closed holder to an open one
 * (`corridorHolds`, ai/operational.ts).
 */
export interface CorridorRefusal {
  on: Uint8Array;
  open: Uint8Array;
  shut: Uint8Array;
  route: readonly number[];
}

/**
 * The searches (`searchRoute`) made, and the last that was refused by the cells of a corridor
 * over open ground: its number among them (`at`) and what it read (`CorridorRefusal`). Read by
 * `askMove` (ai/operational.ts) right after one order. Not state.
 */
export const CORRIDOR_REFUSAL: { searches: number; at: number; read: CorridorRefusal | undefined } = { searches: 0, at: -1, read: undefined };

/**
 * The route over the nodes that `searchRoute` plans for a start on open ground (PLAN 7.124): null where
 * it plans none (no route: refused with no search), undefined where it plans no corridor (an end on no
 * node, or the start on closed ground). Read by `corridorHolds` (ai/operational.ts) when the passage's
 * `open` or `shut` has changed since a corridor's refusal: the same route, the same corridor searched.
 */
export function openRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, start: number, goal: number, pass: Passage): readonly number[] | null | undefined {
  if (!mayReach(g, pg, start, goal, pass)) return null;
  const a = pg.nodeOf[start]!;
  const b = pg.nodeOf[goal]!;
  if (pass.ok[pass.holder[start]!] !== 1 || pass.open === undefined || a === 0 || b === 0) return undefined;
  return routeOver(g, pg, mobility, a, b, pass.open, pass);
}

/** The route over the nodes from `a` to `b` for a start on open ground (`open`: the passage's), as `searchRoute` plans it. */
function routeOver(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, a: number, b: number, open: Uint8Array | undefined, pass: Passage | undefined): number[] | null {
  if (a === b) return [a];
  if (open === undefined || pass!.keep === undefined) return coarseRoute(g, pg, mobility, a, b, open, open !== undefined ? pass!.shut : undefined);
  // Of the open and shut nodes alone: kept with them (PLAN 1.42h, `Passage.keep`).
  const coarse = (pass!.keep.coarse ??= new Map());
  const key = (mobility * pg.nodeCount + a) * pg.nodeCount + b;
  let route = coarse.get(key) ?? null;
  if (!coarse.has(key)) coarse.set(key, (route = coarseRoute(g, pg, mobility, a, b, open, pass!.shut)));
  return route;
}

/**
 * The regions of searches in a corridor over open ground that found no way (PLAN 7.124): every cell a
 * refused search reached, by the nodes of its ends, its mobility and its passage's `ok`. Kept only while
 * `keepRegions(true)` (the operational AI's plans, while no cell changes hands), at most MAX_REGIONS, the
 * oldest dropped. The cells a search reaches from open ground are open (it enters closed ground only from
 * its own holder's), and a step between open cells is allowed both ways: from any cell of such a region the
 * same corridor's search reaches the same cells, and a goal outside them is refused again. Not state.
 */
let regions: { a: number; b: number; mobility: MobilityId; ok: Uint8Array; cells: Int32Array }[] | null = null;
const MAX_REGIONS = 16;
/** Refusals answered by a region (`keepRegions`), for the tools. Not state. */
export const REGION_REFUSALS = { n: 0 };

/** Keeps the regions of refused searches (`searchRoute`) from now on, or stops and forgets them. */
export function keepRegions(on: boolean): void {
  regions = on ? [] : null;
}

function keepRegion(a: number, b: number, mobility: MobilityId, ok: Uint8Array, closed: number[]): void {
  const cells = Int32Array.from(closed).sort();
  regions!.push({ a, b, mobility, ok, cells });
  if (regions!.length > MAX_REGIONS) regions!.shift();
}

function hasCell(cells: Int32Array, c: number): boolean {
  let lo = 0;
  let hi = cells.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const v = cells[m]!;
    if (v === c) return true;
    if (v < c) lo = m + 1;
    else hi = m - 1;
  }
  return false;
}

/** Whether a kept region of the same ends' nodes, mobility and passage holds `start` and not `goal`. */
function refusedIn(a: number, b: number, mobility: MobilityId, ok: Uint8Array, start: number, goal: number): boolean {
  for (const r of regions!) if (r.a === a && r.b === b && r.mobility === mobility && r.ok === ok && hasCell(r.cells, start) && !hasCell(r.cells, goal)) return true;
  return false;
}

/** `longest`: of `findDirectRoute`, 'long' where the coarse route is longer than COARSE_SLACK times it. */
function searchRoute(g: NavGrid, pg: ProvinceGraph, mobility: MobilityId, start: number, goal: number, pass?: Passage, longest = Infinity): PathResult | null | 'long' {
  const search = ++CORRIDOR_REFUSAL.searches;
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
    const route = routeOver(g, pg, mobility, a, b, open, pass);
    if (!route) return null;
    if (longest < Infinity && route.length > 2) {
      let way = steps(g, start, pg.centre[route[1]!]!) + steps(g, pg.centre[route[route.length - 2]!]!, goal);
      for (let i = 2; i < route.length - 1; i++) way += steps(g, pg.centre[route[i - 1]!]!, pg.centre[route[i]!]!);
      if (way > COARSE_SLACK * longest) return 'long';
    }
    const corridor = new Uint8Array(pg.nodeCount);
    for (const node of route) {
      corridor[node] = 1;
      for (const nb of pg.adj[node]!) corridor[nb] = 1;
    }
    // A region a search of this plan found no way out of (PLAN 7.124): from it to a goal outside it,
    // with the same ends' nodes, the same corridor is searched and refused again.
    if (open !== undefined && regions !== null && refusedIn(a, b, mobility, pass!.ok, start, goal)) {
      CORRIDOR_REFUSAL.at = search;
      CORRIDOR_REFUSAL.read = { on: corridor, open, shut: pass!.shut!, route };
      REGION_REFUSALS.n++;
      return null;
    }
    const before = g.scratch?.gen;
    const closed = open !== undefined && regions !== null ? [] : undefined;
    const inCorridor = findPath(g, mobility, start, goal, { nodeOf: pg.nodeOf, on: corridor }, pass, undefined, closed);
    if (!inCorridor && closed !== undefined && closed.length > 0) keepRegion(a, b, mobility, pass!.ok, closed);
    // (A search that was refused at once has no stamps of its own.)
    if (!inCorridor && open !== undefined && g.scratch && g.scratch.gen !== before) g.barred = { closed: 2 * g.scratch.gen + 1, from: a, goal, mobility, ok: pass!.ok };
    if (!inCorridor && open !== undefined) {
      CORRIDOR_REFUSAL.at = search;
      CORRIDOR_REFUSAL.read = { on: corridor, open, shut: pass!.shut!, route };
    }
    if (inCorridor || open !== undefined) return inCorridor;
  }
  return findPath(g, mobility, start, goal, undefined, pass);
}
