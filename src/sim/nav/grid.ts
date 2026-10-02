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
  /**
   * Connected land component per cell (4-connected over passable cells; 0 = impassable). Cell A*
   * cannot cut corners, so two cells are mutually reachable iff they share a component.
   */
  component: Uint32Array;
}

/** Row scales for a Miller w×h grid (cell height in radians of latitude × R, width × cos φ). */
export function makeNavGrid(terrain: Uint8Array, w: number, h: number, wrapX: boolean): NavGrid {
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
  return { w, h, wrapX, terrain, kx, ky, component: labelComponents(terrain, w, h, wrapX) };
}

/** Labels 4-connected components of land + crossing cells (water is impassable to every mobility). */
function labelComponents(terrain: Uint8Array, w: number, h: number, wrapX: boolean): Uint32Array {
  const water = MOVE_COST[0]!;
  const comp = new Uint32Array(w * h);
  let next = 1;
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (comp[s] !== 0 || !Number.isFinite(water[terrain[s]!]!)) continue;
    comp[s] = next;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % w;
      const y = (c - x) / w;
      const ns = [y > 0 ? c - w : -1, y < h - 1 ? c + w : -1, x > 0 ? c - 1 : wrapX ? c + w - 1 : -1, x < w - 1 ? c + 1 : wrapX ? c - w + 1 : -1];
      for (const n of ns) {
        if (n >= 0 && comp[n] === 0 && Number.isFinite(water[terrain[n]!]!)) {
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
  for (let r = r0; r <= r1; r++) {
    if (g.kx[r]! < kx) kx = g.kx[r]!;
    if (g.ky[r]! < ky) ky = g.ky[r]!;
  }
  const ex = dx * kx;
  const ey = dy * ky;
  return sqrt(ex * ex + ey * ey);
}

/** Binary min-heap keyed by f64, tie-broken by insertion order (deterministic). */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  private seqs: number[] = [];
  private seq = 0;
  get size(): number {
    return this.vals.length;
  }
  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    this.seqs.push(this.seq++);
    let i = this.vals.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.vals[0]!;
    const last = this.vals.length - 1;
    this.swap(0, last);
    this.keys.pop();
    this.vals.pop();
    this.seqs.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.vals.length && this.less(l, m)) m = l;
      if (r < this.vals.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
  private less(a: number, b: number): boolean {
    const ka = this.keys[a]!;
    const kb = this.keys[b]!;
    return ka < kb || (ka === kb && this.seqs[a]! < this.seqs[b]!);
  }
  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
    [this.vals[a], this.vals[b]] = [this.vals[b]!, this.vals[a]!];
    [this.seqs[a], this.seqs[b]] = [this.seqs[b]!, this.seqs[a]!];
  }
}

const DIRS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

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
  const passable = (c: number): boolean => Number.isFinite(costRow[g.terrain[c]!]!) && (allowed === undefined || allowed(c));
  if (!passable(start) || !passable(goal) || g.component[start] !== g.component[goal]) return null;
  const hScale = MIN_COST[mobility]!;
  const gScore = new Map<number, number>();
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  gScore.set(start, 0);
  open.push(boundKm(g, start, goal) * hScale, start);
  while (open.size > 0) {
    const c = open.pop();
    if (c === goal) break;
    if (closed.has(c)) continue;
    closed.add(c);
    const cx = c % g.w;
    const cy = (c - cx) / g.w;
    const gc = gScore.get(c)!;
    for (const [dx, dy] of DIRS) {
      const ny = cy + dy;
      if (ny < 0 || ny >= g.h) continue;
      let nx = cx + dx;
      if (nx < 0 || nx >= g.w) {
        if (!g.wrapX) continue;
        nx = (nx + g.w) % g.w;
      }
      const n = ny * g.w + nx;
      if (closed.has(n) || !passable(n)) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbours passable.
      if (dx !== 0 && dy !== 0) {
        const ox = (cx + dx + g.w) % g.w;
        if (!passable(cy * g.w + ox) || !passable(ny * g.w + cx)) continue;
      }
      const step = stepKm(g, dy > 0 ? cy : ny, dx, dy) * costRow[g.terrain[n]!]!;
      const t = gc + step;
      const old = gScore.get(n);
      if (old === undefined || t < old) {
        gScore.set(n, t);
        came.set(n, c);
        open.push(t + boundKm(g, n, goal) * hScale, n);
      }
    }
  }
  const total = gScore.get(goal);
  if (total === undefined) return null;
  const cells = [goal];
  for (let c = goal; c !== start; ) {
    c = came.get(c)!;
    cells.push(c);
  }
  cells.reverse();
  return { cells, cost: total };
}
