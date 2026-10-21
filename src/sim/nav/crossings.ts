/**
 * The shores of the crossings (PLAN 7.49b1, ADR-588): each body of crossing cells (4-connected
 * `Terrain.Crossing`, the walkable lanes of `straits.json`) joins the land cells next to it (its
 * shores: land, not crossing, 8-adjacent to a cell of the body, the cells a march steps onto from
 * it). The territory system counts the shores of one body as neighbours of each other: a crossing
 * has no province and no holder, and without it no front stepped over a strait (an army on the
 * crossing waited before the far shore's cell for a flip that no held cell next to it could make).
 *
 * The exits of a crossing (PLAN 7.49b2, ADR-589): the land cells 4-adjacent to its body, the ways
 * off it of the planner's 4-connected walk of open ground (`pocketOf`; `exitsOf`).
 *
 * Derived from the terrain alone, built once a grid (`acrossOf`, `exitsOf`); never saved.
 */
import { Terrain } from '../../shared/terrain';
import type { NavGrid } from './grid';

/** By shore cell, the other shore cells of its body (ascending); shores of two bodies have both. */
export type Across = ReadonlyMap<number, Int32Array>;

/** By crossing cell, the land cells 4-adjacent to its body (ascending). */
export type Exits = ReadonlyMap<number, Int32Array>;

const BUILT = new WeakMap<NavGrid, { across: Across; exits: Exits }>();

function built(grid: NavGrid): { across: Across; exits: Exits } {
  let b = BUILT.get(grid);
  if (!b) BUILT.set(grid, (b = build(grid)));
  return b;
}

/** The shores of `grid`'s crossings (`Across`), built on first use. */
export function acrossOf(grid: NavGrid): Across {
  return built(grid).across;
}

/** The exits of `grid`'s crossings (`Exits`), built on first use. */
export function exitsOf(grid: NavGrid): Exits {
  return built(grid).exits;
}

function build(grid: NavGrid): { across: Across; exits: Exits } {
  const { w, h, wrapX, terrain, component } = grid;
  const seen = new Uint8Array(w * h);
  const sets = new Map<number, Set<number>>();
  const exits = new Map<number, Int32Array>();
  const body: number[] = [];
  const stack: number[] = [];
  /** The cell at (x, y) on the grid, x over the seam where the map wraps; -1 off it. */
  const at = (x: number, y: number): number => {
    if (y < 0 || y >= h) return -1;
    if (x < 0 || x >= w) {
      if (!wrapX) return -1;
      x = (x + w) % w;
    }
    return y * w + x;
  };
  for (let c0 = 0; c0 < w * h; c0++) {
    if (seen[c0] || terrain[c0] !== Terrain.Crossing) continue;
    body.length = 0;
    seen[c0] = 1;
    stack.push(c0);
    while (stack.length > 0) {
      const c = stack.pop()!;
      body.push(c);
      const x = c % w;
      const y = (c - x) / w;
      for (const k of [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)]) {
        if (k < 0 || seen[k] || terrain[k] !== Terrain.Crossing) continue;
        seen[k] = 1;
        stack.push(k);
      }
    }
    const shores = new Set<number>();
    const four = new Set<number>();
    for (const c of body) {
      const x = c % w;
      const y = (c - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = at(x + dx, y + dy);
          if (k < 0 || component[k] === 0 || terrain[k] === Terrain.Crossing) continue;
          shores.add(k);
          if (dx === 0 || dy === 0) four.add(k);
        }
      }
    }
    const out = Int32Array.from(four).sort();
    for (const c of body) exits.set(c, out);
    for (const s of shores) {
      let set = sets.get(s);
      if (!set) sets.set(s, (set = new Set()));
      for (const o of shores) if (o !== s) set.add(o);
    }
  }
  const across = new Map<number, Int32Array>();
  for (const s of [...sets.keys()].sort((a, b) => a - b)) {
    const others = Int32Array.from(sets.get(s)!).sort();
    if (others.length > 0) across.set(s, others);
  }
  return { across, exits };
}
