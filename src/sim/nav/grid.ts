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
  /** A* scratch, reused across searches (derived; generation-stamped so it is never cleared). */
  scratch: { g: Float64Array; came: Int32Array; seen: Uint32Array; closed: Uint32Array; gen: number } | null;
}

/** Row scales for a Miller w×h grid (cell height in radians of latitude × R, width × cos φ). */
export function makeNavGrid(terrain: Uint8Array, w: number, h: number, wrapX: boolean): NavGrid {
  const kx = new Float64Array(h);
  const ky = new Float64Array(h);
  const kd = new Float64Array(h);
  const dLon = (2 * PI) / w;
  for (let r = 0; r < h; r++) {
    const lat0 = millerLat(Y_TOP - (r / h) * PI);
    const lat1 = millerLat(Y_TOP - ((r + 1) / h) * PI);
    const mid = millerLat(Y_TOP - ((r + 0.5) / h) * PI);
    kx[r] = EARTH_R * dLon * cos(mid);
    ky[r] = EARTH_R * (lat0 - lat1);
    kd[r] = sqrt(kx[r]! * kx[r]! + ky[r]! * ky[r]!);
  }
  return { w, h, wrapX, terrain, kx, ky, kd, component: labelComponents(terrain, w, h, wrapX), endpointMin: unimodal(kx) && unimodal(ky), scratch: null };
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
 * Cell A* from `start` to `goal` for a mobility class. `allowed(cell)` further restricts the
 * search (e.g. a province corridor). Returns null when the goal is unreachable.
 */
export function findPath(g: NavGrid, mobility: MobilityId, start: number, goal: number, allowed?: (cell: number) => boolean): PathResult | null {
  const costRow = MOVE_COST[mobility]!;
  const { w, h, wrapX, terrain, kx, ky, kd } = g;
  const passable = (c: number): boolean => Number.isFinite(costRow[terrain[c]!]!) && (allowed === undefined || allowed(c));
  if (!passable(start) || !passable(goal) || g.component[start] !== g.component[goal]) return null;
  const hScale = MIN_COST[mobility]!;
  // Typed scratch with generation stamps instead of Maps (review after PLAN 1.25: pathfinding
  // was a quarter of the tick); the search and its tie-breaking are unchanged.
  const n0 = w * h;
  if (!g.scratch || g.scratch.g.length !== n0) g.scratch = { g: new Float64Array(n0), came: new Int32Array(n0), seen: new Uint32Array(n0), closed: new Uint32Array(n0), gen: 0 };
  const sc = g.scratch;
  if (++sc.gen === 0xffffffff) {
    sc.seen.fill(0);
    sc.closed.fill(0);
    sc.gen = 1;
  }
  const gen = sc.gen;
  const { g: gs, came, seen, closed } = sc;
  const open = OPEN;
  open.clear();
  // boundKm to the goal, inlined for the common grid (row scales shrinking away from the equator).
  const gx = goal % w;
  const gy = (goal - gx) / w;
  const kxGoal = kx[gy]!;
  const kyGoal = ky[gy]!;
  const fast = g.endpointMin;
  const half = w / 2;
  gs[start] = 0;
  seen[start] = gen;
  open.push(boundKm(g, start, goal) * hScale, start);
  while (open.size > 0) {
    const c = open.pop();
    if (c === goal) break;
    if (closed[c] === gen) continue;
    closed[c] = gen;
    const cx = c % w;
    const cy = (c - cx) / w;
    const gc = gs[c]!;
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
      if (closed[n] === gen) continue;
      const cost = costRow[terrain[n]!]!;
      if (cost === Infinity || (allowed !== undefined && !allowed(n))) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbours passable.
      if (dx !== 0 && dy !== 0 && (!passable(cy * w + ((cx + dx + w) % w)) || !passable(ny * w + cx))) continue;
      // stepKm, inlined: the row scales of the upper of the two rows.
      const row = dy > 0 ? cy : ny;
      const t = gc + (dy === 0 ? kx[row]! : dx === 0 ? ky[row]! : kd[row]!) * cost;
      if (seen[n] !== gen || t < gs[n]!) {
        gs[n] = t;
        seen[n] = gen;
        came[n] = c;
        let bound: number;
        if (fast) {
          let ex = nx > gx ? nx - gx : gx - nx;
          if (wrapX && ex > half) ex = w - ex;
          ex *= kx[ny]! < kxGoal ? kx[ny]! : kxGoal;
          const ey = (ny > gy ? ny - gy : gy - ny) * (ky[ny]! < kyGoal ? ky[ny]! : kyGoal);
          bound = sqrt(ex * ex + ey * ey);
        } else bound = boundKm(g, n, goal);
        open.push(t + bound * hScale, n);
      }
    }
  }
  if (seen[goal] !== gen) return null;
  const total = gs[goal]!;
  const cells = [goal];
  for (let c = goal; c !== start; ) {
    c = came[c]!;
    cells.push(c);
  }
  cells.reverse();
  return { cells, cost: total };
}
