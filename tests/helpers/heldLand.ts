import type { World } from '../../src/sim/world';

/**
 * Land held with no war (PLAN 3.4Rj): one line for every pair of an owner and a controller of
 * a cell that are not at war. Empty in a world whose rules alone have moved its fronts.
 */
export function heldWithNoWar(world: World): string[] {
  const { owner, controller } = world.cells;
  const pairs = new Map<number, number>();
  for (let c = 0; c < owner.length; c++) {
    const o = owner[c]!;
    const k = controller[c]!;
    if (o !== 0 && k !== 0 && o !== k && !world.wars.atWar(o, k)) pairs.set(o * 65536 + k, (pairs.get(o * 65536 + k) ?? 0) + 1);
  }
  return [...pairs].sort((a, b) => a[0] - b[0]).map(([p, n]) => `nation ${p % 65536} holds ${n} cells of nation ${Math.floor(p / 65536)}`);
}
