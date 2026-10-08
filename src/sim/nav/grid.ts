/**
 * Land navigation grid (PLAN 1.11, SPEC §4): true distances per cell row, terrain move costs
 * per mobility class, and cell-level A* (8-connected, no corner cutting past impassable cells).
 * Pure and deterministic: costs and heuristics use exact IEEE arithmetic only.
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { cos, PI, sqrt } from '../core/dmath';
import { millerLat, Y_TOP } from '../data/projection';

export const Mobility = { foot: 0, motor: 1, tracked: 2 } as const;
export type MobilityId = (typeof Mobility)[keyof typeof Mobility];
const MOBILITY_KEYS = ['foot', 'motor', 'tracked'] as const;

/** Move cost multiplier per [mobility][terrain]; Infinity = impassable (water). */
export const MOVE_COST: readonly Float64Array[] = MOBILITY_KEYS.map((m) =>
  Float64Array.from(terrainJson.terrain.map((t) => t.moveCost[m] ?? Infinity)),
);
/** Smallest finite cost per mobility (A* heuristic scale; keeps it admissible). */
export const MIN_COST: readonly number[] = MOVE_COST.map((row) => Math.min(...row.filter((v) => Number.isFinite(v))));

const EARTH_R = 6371.0088;

export interface NavGrid {
  w: number;
  h: number;
  wrapX: boolean;
  terrain: Uint8Array;
  /** True km per cell step, horizontally and vertically, per row. */
  kx: Float64Array;
  ky: Float64Array;
  /** True km per diagonal step, per row: sqrt(kx² + ky²), as `stepKm` computes it. */
  kd: Float64Array;
  /**
   * Connected land component per cell (4-connected over passable cells; 0 = impassable). Cell A*
   * cannot cut corners, so two cells are mutually reachable iff they share a component.
   */
  component: Uint32Array;
  /**
   * True when kx and ky never increase away from the equator row (checked at build): the minimum
   * over a row range is then the smaller endpoint, so `boundKm` needs no loop (same value).
   */
  endpointMin: boolean;
  /**
   * A* scratch, reused across searches (derived; generation-stamped so it is never cleared).
   * `stamp` is 2·gen when a cell is seen by search `gen`, 2·gen + 1 once it is closed.
   */
  scratch: { g: Float64Array; came: Int32Array; stamp: Uint32Array; gen: number } | null;
  /** The last search in a corridor that found no way on closed ground (`findRoute`). */
  barred: BarredSearch | null;
  /**
   * The pockets found on one `Passage` (`pocketOf`; derived, never saved): `id[c]` is read where
   * `stamp[c]` is `gen`, and another passage begins another `gen`.
   */
  pockets: { id: Int32Array; stamp: Uint32Array; gen: number; pass: Passage | null } | null;
}

/** Row scales for a Miller w×h grid (cell height in radians of latitude × R, width × cos φ). */
export function rowScales(w: number, h: number): { kx: Float64Array; ky: Float64Array } {
  const kx = new Float64Array(h);
  const ky = new Float64Array(h);
  const dLon = (2 * PI) / w;
  for (let r = 0; r < h; r++) {
    const lat0 = millerLat(Y_TOP - (r / h) * PI);
    const lat1 = millerLat(Y_TOP - ((r + 1) / h) * PI);
    const mid = millerLat(Y_TOP - ((r + 0.5) / h) * PI);
    kx[r] = EARTH_R * dLon * cos(mid);
    ky[r] = EARTH_R * (lat0 - lat1);
  }
  return { kx, ky };
}

/** True area of one cell per row, km² (ADR-52): a Miller cell shrinks towards the poles. */
export function cellAreaByRow(w: number, h: number): Float64Array {
  const { kx, ky } = rowScales(w, h);
  return kx.map((x, r) => x * ky[r]!);
}

export function makeNavGrid(terrain: Uint8Array, w: number, h: number, wrapX: boolean): NavGrid {
  const { kx, ky } = rowScales(w, h);
  const kd = kx.map((x, r) => sqrt(x * x + ky[r]! * ky[r]!));
  return { w, h, wrapX, terrain, kx, ky, kd, component: labelComponents(terrain, w, h, wrapX), endpointMin: unimodal(kx) && unimodal(ky), scratch: null, barred: null, pockets: null };
}

/** Whether `a` rises to a single maximum and falls after it (non-strict): its range minima lie at the ends. */
function unimodal(a: Float64Array): boolean {
  let i = 1;
  while (i < a.length && a[i]! >= a[i - 1]!) i++;
  while (i < a.length && a[i]! <= a[i - 1]!) i++;
  return i >= a.length;
}

/**
 * The 4-neighbours of cell `c` on a w×h grid (north, south, west, east; x wraps when `wrapX`),
 * written into `out` (reused to avoid allocation) and returned.
 */
export function neighbours4(c: number, w: number, h: number, wrapX: boolean, out: number[]): number[] {
  const x = c % w;
  const y = (c - x) / w;
  out.length = 0;
  if (y > 0) out.push(c - w);
  if (y < h - 1) out.push(c + w);
  if (x > 0) out.push(c - 1);
  else if (wrapX) out.push(c + w - 1);
  if (x < w - 1) out.push(c + 1);
  else if (wrapX) out.push(c - w + 1);
  return out;
}

/** Labels 4-connected components of land + crossing cells (water is impassable to every mobility). */
function labelComponents(terrain: Uint8Array, w: number, h: number, wrapX: boolean): Uint32Array {
  const water = MOVE_COST[0]!;
  const comp = new Uint32Array(w * h);
  let next = 1;
  const stack: number[] = [];
  const nb: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (comp[s] !== 0 || !Number.isFinite(water[terrain[s]!]!)) continue;
    comp[s] = next;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop()!;
      for (const n of neighbours4(c, w, h, wrapX, nb)) {
        if (comp[n] === 0 && Number.isFinite(water[terrain[n]!]!)) {
          comp[n] = next;
          stack.push(n);
        }
      }
    }
    next++;
  }
  return comp;
}

/** True km between the centres of two neighbouring cells (dx, dy ∈ {-1, 0, 1}). */
export function stepKm(g: NavGrid, row: number, dx: number, dy: number): number {
  const ax = dx === 0 ? 0 : g.kx[row]!;
  const ay = dy === 0 ? 0 : g.ky[row]!;
  return dx !== 0 && dy !== 0 ? sqrt(ax * ax + ay * ay) : ax + ay;
}

/** Straight-line lower bound (km) between two cells, used by A*. */
export function boundKm(g: NavGrid, a: number, b: number): number {
  const ax = a % g.w;
  const ay = (a - ax) / g.w;
  const bx = b % g.w;
  const by = (b - bx) / g.w;
  let dx = Math.abs(ax - bx);
  if (g.wrapX && dx > g.w / 2) dx = g.w - dx;
  const dy = Math.abs(ay - by);
  // Smallest row scales on the way bound the true distance from below.
  const r0 = Math.min(ay, by);
  const r1 = Math.max(ay, by);
  let kx = Infinity;
  let ky = Infinity;
  if (g.endpointMin) {
    kx = Math.min(g.kx[r0]!, g.kx[r1]!);
    ky = Math.min(g.ky[r0]!, g.ky[r1]!);
  } else {
    for (let r = r0; r <= r1; r++) {
      if (g.kx[r]! < kx) kx = g.kx[r]!;
      if (g.ky[r]! < ky) ky = g.ky[r]!;
    }
  }
  const ex = dx * kx;
  const ey = dy * ky;
  return sqrt(ex * ex + ey * ey);
}

/**
 * Octile lower bound (km) between two cells: the cheapest 8-neighbour walk with `boundKm`'s row
 * scales, min(dx, dy) diagonal steps and the rest straight. Never below `boundKm` (a diagonal
 * step of √(kx² + ky²) against the straight line's share), so A* expands fewer ties; the A*
 * heuristic only (ADR-56). `boundKm` stays the distance of the province graph.
 */
export function octileKm(g: NavGrid, a: number, b: number): number {
  const ax = a % g.w;
  const ay = (a - ax) / g.w;
  const bx = b % g.w;
  const by = (b - bx) / g.w;
  let dx = Math.abs(ax - bx);
  if (g.wrapX && dx > g.w / 2) dx = g.w - dx;
  const dy = Math.abs(ay - by);
  const r0 = Math.min(ay, by);
  const r1 = Math.max(ay, by);
  let kx = Infinity;
  let ky = Infinity;
  if (g.endpointMin) {
    kx = Math.min(g.kx[r0]!, g.kx[r1]!);
    ky = Math.min(g.ky[r0]!, g.ky[r1]!);
  } else {
    for (let r = r0; r <= r1; r++) {
      if (g.kx[r]! < kx) kx = g.kx[r]!;
      if (g.ky[r]! < ky) ky = g.ky[r]!;
    }
  }
  const d = dx < dy ? dx : dy;
  return d * sqrt(kx * kx + ky * ky) + (dx - d) * kx + (dy - d) * ky;
}

/**
 * Binary min-heap keyed by f64, tie-broken by insertion order (deterministic: keys with their
 * sequence numbers are a total order, so the pop order does not depend on the heap's layout).
 * Typed arrays, reused across searches (PLAN 1.42a: the array-of-numbers heap and its swaps were
 * half of a search).
 */
class Heap {
  private keys = new Float64Array(1024);
  private vals = new Int32Array(1024);
  private seqs = new Float64Array(1024);
  private seq = 0;
  size = 0;
  clear(): void {
    this.size = 0;
    this.seq = 0;
  }
  push(key: number, val: number): void {
    if (this.size === this.vals.length) this.grow();
    const { keys, vals, seqs } = this;
    const seq = this.seq++;
    // Sift the hole up; a new entry has the largest sequence, so it stops at an equal key.
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      keys[i] = keys[p]!;
      vals[i] = vals[p]!;
      seqs[i] = seqs[p]!;
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
    seqs[i] = seq;
  }
  pop(): number {
    const { keys, vals, seqs } = this;
    const top = vals[0]!;
    const n = --this.size;
    if (n === 0) return top;
    const key = keys[n]!;
    const val = vals[n]!;
    const seq = seqs[n]!;
    let i = 0;
    for (;;) {
      let m = 2 * i + 1;
      if (m >= n) break;
      const r = m + 1;
      if (r < n && (keys[r]! < keys[m]! || (keys[r] === keys[m] && seqs[r]! < seqs[m]!))) m = r;
      if (!(keys[m]! < key || (keys[m] === key && seqs[m]! < seq))) break;
      keys[i] = keys[m]!;
      vals[i] = vals[m]!;
      seqs[i] = seqs[m]!;
      i = m;
    }
    keys[i] = key;
    vals[i] = val;
    seqs[i] = seq;
    return top;
  }
  private grow(): void {
    const n = this.vals.length * 2;
    const keys = new Float64Array(n);
    const vals = new Int32Array(n);
    const seqs = new Float64Array(n);
    keys.set(this.keys);
    vals.set(this.vals);
    seqs.set(this.seqs);
    this.keys = keys;
    this.vals = vals;
    this.seqs = seqs;
  }
}
const OPEN = new Heap();

/** The 8 steps in search order (it decides ties between equal routes: do not reorder). */
const DIR_X = [1, -1, 0, 0, 1, 1, -1, -1];
const DIR_Y = [0, 0, 1, -1, 1, -1, 1, -1];

export interface PathResult {
  /** Cells from start to goal inclusive. */
  cells: number[];
  /** Total cost in km × terrain cost (divide by speed for hours). */
  cost: number;
}

/**
 * A search that found no way closed every cell its start reaches, and their stamps say so until
 * a later search writes over them. A start with that stamp reaches no more than the first did:
 * the same goal by the same corridor (`from`, its first node) on the same ground (`ok`, the
 * `Passage` array itself, made for one hour) is refused to it with no search. A front that an
 * army cannot reach is asked for by each of its formations in turn (PLAN 3.4Rl).
 */
export interface BarredSearch {
  closed: number;
  from: number;
  goal: number;
  mobility: MobilityId;
  ok: Uint8Array;
}

/** Restricts a search to the cells whose node (`nodeOf`) is marked in `on` (a province corridor). */
export interface Corridor {
  nodeOf: Uint32Array;
  on: Uint8Array;
}

/**
 * Whose ground a route may enter (PLAN 3.4Rl, ADR-149): `ok[n]` is 1 for a holder whose cells
 * are open (index 0, nobody, included). A cell of any other holder is entered only from a cell
 * of that same holder: who stands on such ground may walk on it and out of it, and nobody
 * walks in.
 */
export interface Passage {
  ok: Uint8Array;
  holder: Uint16Array;
  /**
   * By node of the province graph, for a start on open ground: whether the node has open
   * ground, and the group of such nodes it is joined to by neighbours (0 = none). A route runs
   * inside one group; `findRoute` asks this before any search, and plans a long route over
   * such nodes.
   */
  open?: Uint8Array;
  group?: Int32Array;
  /** By node: whether it has closed ground. */
  shut?: Uint8Array;
  /**
   * By node, what `wideNode` (nav/provinceGraph.ts) has answered: the number of the node's wide
   * ground, -1 for a node in none, 0 not asked.
   */
  wide?: Int32Array;
  /** By node of a wide ground, the wide grounds the cells join it to (`wideJoined`), once asked. */
  joined?: Int32Array;
}

/** The most cells of open ground that are a pocket (`pocketOf`). */
export const POCKET_CELLS = 4096;
/** `pocketOf`'s mark of a cell of the walk in hand (no pocket and no wide ground has the number). */
const IN_HAND = -0x7fffffff;

/**
 * The pocket a cell of open ground lies in (PLAN 3.10c2b, ADR-192): when the cells a route may
 * come to from it (`findPath`'s steps, over ground open in `pass`; by the terrain a formation on
 * foot enters) are no more than POCKET_CELLS, the pocket's number (that of the cell it was
 * first asked for, and 1). Below 0: wider ground whose cells come to a wide ground (PLAN
 * 3.10c2b3a, ADR-193), minus that ground's number. 0: wider ground that was not walked to its
 * end and came to none, or a cell of closed ground. A pocket
 * is walked once a passage: every cell of it is marked, and so are the cells walked of wider
 * ground. `wide`: by cell, the number of the wide ground it is known to lie in (`wideNode`; 0:
 * none), where the walk ends.
 */
export function pocketOf(g: NavGrid, pass: Passage, start: number, wide?: (cell: number) => number): number {
  const { w, h, wrapX, component } = g;
  const { ok, holder } = pass;
  if (component[start] === 0 || ok[holder[start]!] !== 1) return 0;
  if (!g.pockets || g.pockets.id.length !== w * h) g.pockets = { id: new Int32Array(w * h), stamp: new Uint32Array(w * h), gen: 0, pass: null };
  const p = g.pockets;
  if (p.pass !== pass) {
    p.pass = pass;
    if (++p.gen === 0xffffffff) {
      p.stamp.fill(0);
      p.gen = 1;
    }
  }
  const { id, stamp, gen } = p;
  if (stamp[start] === gen) return id[start]!;
  // In hand: marked. Ground that an earlier walk found wider is wider from here too, and comes
  // to the wide ground that walk came to.
  const walked = [start];
  stamp[start] = gen;
  id[start] = IN_HAND;
  let far = false;
  let ground = 0;
  for (let at = 0; at < walked.length && !far; at++) {
    const c = walked[at]!;
    const cx = c % w;
    const cy = (c - cx) / w;
    for (let k = 0; k < 8; k++) {
      const dx = DIR_X[k]!;
      const dy = DIR_Y[k]!;
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
      if (stamp[n] === gen) {
        const was = id[n]!;
        if (was <= 0 && was !== IN_HAND) {
          far = true;
          if (ground === 0) ground = was;
        }
        continue;
      }
      stamp[n] = gen;
      id[n] = IN_HAND;
      walked.push(n);
      const met = wide === undefined ? 0 : wide(n);
      if (met !== 0) {
        far = true;
        if (ground === 0) ground = -met;
      }
    }
    if (walked.length > POCKET_CELLS) far = true;
  }
  const pocket = far ? ground : start + 1;
  for (const c of walked) id[c] = pocket;
  return pocket;
}

/** A search between two cells further apart than this (the larger of dx and dy) is a long one. */
export const LONG_SEARCH_CELLS = 120;
/** And further apart than this, a far one. */
export const FAR_SEARCH_CELLS = 300;
export const LONG_SEARCH_WEIGHT = 1.5;
export const FAR_SEARCH_WEIGHT = 2;

/**
 * What `findPath` multiplies its bound by, from how far apart the two ends are in cells (PLAN
 * 3.10c2d1b, ADR-195). 1 is the cheapest way. Above it the search runs at the goal and closes
 * fewer cells, and the way it finds costs at most that many times the cheapest way there is in
 * the ground searched (the corridor, if there is one): on the map 1.04 times in the mean over
 * 120 cells and 1.10 over 300, 1.24 at the most (PLAN 3.10c2d1a). A search between two ends
 * 530 to 595 cells apart closed 57,000 to 85,500 cells unscaled, 12 to 17 ms each.
 */
export function boundWeight(cells: number): number {
  return cells > FAR_SEARCH_CELLS ? FAR_SEARCH_WEIGHT : cells > LONG_SEARCH_CELLS ? LONG_SEARCH_WEIGHT : 1;
}

/**
 * Cell A* from `start` to `goal` for a mobility class. `corridor` further restricts the search,
 * and `pass` the ground by its holder. Returns null when the goal is unreachable. The bound is
 * scaled by `boundWeight` of the distance between the two ends, or by `weight` when one is given
 * (the tests ask for 1, the cheapest way).
 */
export function findPath(g: NavGrid, mobility: MobilityId, start: number, goal: number, corridor?: Corridor, pass?: Passage, weight?: number): PathResult | null {
  const costRow = MOVE_COST[mobility]!;
  const { w, h, wrapX, terrain, kx, ky, kd } = g;
  // The corridor as two typed arrays read in the loop (PLAN 1.42f: a callback per neighbour and
  // two more per diagonal step were a share of every long search). Same test as before.
  const nodeOf = corridor?.nodeOf;
  const on = corridor?.on;
  const passable = (c: number): boolean => Number.isFinite(costRow[terrain[c]!]!) && (on === undefined || on[nodeOf![c]!] === 1);
  if (!passable(start) || !passable(goal) || g.component[start] !== g.component[goal]) return null;
  const ok = pass?.ok;
  const holder = pass?.holder;
  // Closed ground is entered from its own holder's cells only, so a route that ends on it began
  // on it: no search for a goal on another's.
  if (ok !== undefined && ok[holder![goal]!] !== 1 && holder![goal] !== holder![start]) return null;
  // The bound, scaled for a long search: the way is then at most the weight times the cheapest
  // in the ground searched, as far as the bound is a lower one (a closed cell is not opened
  // again; the octile walk is no strict lower bound where a way swings poleward, ADR-56).
  let far = Math.abs((start % w) - (goal % w));
  if (wrapX && far > w / 2) far = w - far;
  far = Math.max(far, Math.abs(Math.floor(start / w) - Math.floor(goal / w)));
  const hScale = MIN_COST[mobility]! * (weight ?? boundWeight(far));
  // Typed scratch with generation stamps instead of Maps (review after PLAN 1.25: pathfinding
  // was a quarter of the tick); the search and its tie-breaking are unchanged.
  const n0 = w * h;
  // One stamp array for seen and closed (PLAN 1.42f: one fewer random read per neighbour in a
  // 2 M-cell grid).
  if (!g.scratch || g.scratch.g.length !== n0) g.scratch = { g: new Float64Array(n0), came: new Int32Array(n0), stamp: new Uint32Array(n0), gen: 0 };
  const sc = g.scratch;
  if (++sc.gen === 0x7fffffff) {
    sc.stamp.fill(0);
    sc.gen = 1;
  }
  const SEEN = 2 * sc.gen;
  const CLOSED = SEEN + 1;
  const { g: gs, came, stamp } = sc;
  const open = OPEN;
  open.clear();
  // octileKm to the goal, inlined for the common grid (row scales shrinking away from the equator).
  const gx = goal % w;
  const gy = (goal - gx) / w;
  const kxGoal = kx[gy]!;
  const kyGoal = ky[gy]!;
  const fast = g.endpointMin;
  const half = w / 2;
  gs[start] = 0;
  stamp[start] = SEEN;
  open.push(octileKm(g, start, goal) * hScale, start);
  while (open.size > 0) {
    const c = open.pop();
    if (c === goal) break;
    if (stamp[c] === CLOSED) continue;
    stamp[c] = CLOSED;
    const cx = c % w;
    const cy = (c - cx) / w;
    const gc = gs[c]!;
    const hc = holder === undefined ? 0 : holder[c]!;
    for (let k = 0; k < 8; k++) {
      const dx = DIR_X[k]!;
      const dy = DIR_Y[k]!;
      const ny = cy + dy;
      if (ny < 0 || ny >= h) continue;
      let nx = cx + dx;
      if (nx < 0 || nx >= w) {
        if (!wrapX) continue;
        nx = (nx + w) % w;
      }
      const n = ny * w + nx;
      const sn = stamp[n]!;
      if (sn === CLOSED) continue;
      const cost = costRow[terrain[n]!]!;
      if (cost === Infinity || (on !== undefined && on[nodeOf![n]!] !== 1)) continue;
      if (ok !== undefined && ok[holder![n]!] !== 1 && holder![n] !== hc) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbours passable.
      if (dx !== 0 && dy !== 0 && (!passable(cy * w + ((cx + dx + w) % w)) || !passable(ny * w + cx))) continue;
      // stepKm, inlined: the row scales of the upper of the two rows.
      const row = dy > 0 ? cy : ny;
      const t = gc + (dy === 0 ? kx[row]! : dx === 0 ? ky[row]! : kd[row]!) * cost;
      if (sn !== SEEN || t < gs[n]!) {
        gs[n] = t;
        stamp[n] = SEEN;
        came[n] = c;
        let bound: number;
        if (fast) {
          let ex = nx > gx ? nx - gx : gx - nx;
          if (wrapX && ex > half) ex = w - ex;
          const ax = kx[ny]! < kxGoal ? kx[ny]! : kxGoal;
          const ay = ky[ny]! < kyGoal ? ky[ny]! : kyGoal;
          const ey = ny > gy ? ny - gy : gy - ny;
          const d = ex < ey ? ex : ey;
          bound = d * sqrt(ax * ax + ay * ay) + (ex - d) * ax + (ey - d) * ay;
        } else bound = octileKm(g, n, goal);
        open.push(t + bound * hScale, n);
      }
    }
  }
  if (stamp[goal]! < SEEN) return null;
  const total = gs[goal]!;
  const cells = [goal];
  for (let c = goal; c !== start; ) {
    c = came[c]!;
    cells.push(c);
  }
  cells.reverse();
  return { cells, cost: total };
}
