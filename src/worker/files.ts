/**
 * Formations of one nation at one place, apart (PLAN 7.4f38). The elements of a block not in
 * contact stand on its formation's place (`blockPose`, `slotPlace`): two formations of one
 * template marching from one point drew their columns' elements in the same places (seen on seed
 * 1212, day 6: Soviet formations 52 and 57). Of the land formations of seed 1938 three weeks into
 * Germany's war on Poland, 93 pairs of one nation, not in contact, had blocks half or more in each
 * other (91 of them marching, 36 at one point). The blocks of a stack in contact were parted in
 * the sim (PLAN 3.11c1); these are parted where they are drawn: a file abreast.
 *
 * A group is the formations of one nation, on land and not in contact, whose blocks lie in each
 * other (centres nearer than OVERLAP × the sum of their reaches), joined through each other. Its
 * lowest id keeps its place; the others stand to its side, across its facing, right and left by
 * turns, the widest block's width and DEPLOY_GAP apart. Not state: what the worker sends the
 * page, and where the page's click and camera find the block.
 */
import { cos, sin } from '../sim/core/dmath';
import { blockReach, SLOT_SPACING, slotGrid } from '../sim/core/pose';
import { DEPLOY_GAP, elementIndex, slotCount } from '../sim/systems/elements';
import type { World } from '../sim/world';

/** Centres nearer than this share of the sum of two blocks' reaches: they lie in each other. */
export const OVERLAP = 0.75;

/** Where each parted formation's block stands off its place, cells, by id (none: on its place). */
export function fileOffsets(world: World): Map<number, [number, number]> {
  // A world without templates (the toy world, or rules made by hand in a test) has no blocks to part.
  if (!world.rules?.templates) return new Map();
  const c = world.formations.cols;
  const idx = elementIndex(world);
  const spacing = world.atSize(SLOT_SPACING);
  const gap = world.atSize(DEPLOY_GAP);
  const ids: number[] = [];
  const reach = new Map<number, number>();
  const width = new Map<number, number>();
  world.formations.forEach((f) => {
    if (c.engaged[f] === 1 || world.offLand(f)) return;
    const n = slotCount(world, f, idx.get(f)?.length ?? 0);
    if (n <= 0) return;
    ids.push(f);
    reach.set(f, blockReach(n, spacing));
    width.set(f, slotGrid(n).cols * spacing);
  });
  // By squares of a cell (a block reaches under a third of one): a pair is in one square or two
  // next to each other.
  const key = (x: number, y: number): number => Math.floor(y) * 65536 + Math.floor(x);
  const squares = new Map<number, number[]>();
  for (const f of ids) {
    const k = key(c.x[f]!, c.y[f]!);
    const list = squares.get(k);
    if (list) list.push(f);
    else squares.set(k, [f]);
  }
  // Groups, joined through each other (union by the lower id).
  const parent = new Map<number, number>();
  const root = (f: number): number => {
    let r = f;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const f of ids) {
    const fx = c.x[f]!;
    const fy = c.y[f]!;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const g of squares.get(key(fx + dx, fy + dy)) ?? []) {
          if (g <= f || c.nation[g] !== c.nation[f]) continue;
          const d = Math.hypot(c.x[g]! - fx, c.y[g]! - fy);
          if (d >= OVERLAP * (reach.get(f)! + reach.get(g)!)) continue;
          const a = root(f);
          const b = root(g);
          if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
        }
  }
  const groups = new Map<number, number[]>();
  for (const f of ids) {
    if (!parent.has(f)) continue;
    const r = root(f);
    const list = groups.get(r);
    if (list) list.push(f);
    else groups.set(r, [r, f]);
  }
  const out = new Map<number, [number, number]>();
  for (const members of groups.values()) {
    const list = [...new Set(members)].sort((a, b) => a - b);
    const lead = list[0]!;
    const apart = Math.max(...list.map((f) => width.get(f)!)) + gap;
    // Across the lead's facing, to its right (x east, y south).
    const fa = c.facing[lead]!;
    const rx = -sin(fa);
    const ry = cos(fa);
    for (let k = 1; k < list.length; k++) {
      const side = Math.ceil(k / 2) * (k % 2 === 1 ? 1 : -1);
      // Each stands off the lead's place, not off its own: a file of blocks side by side.
      const f = list[k]!;
      out.set(f, [c.x[lead]! - c.x[f]! + rx * side * apart, c.y[lead]! - c.y[f]! + ry * side * apart]);
    }
  }
  return out;
}
