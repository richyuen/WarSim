import type { World } from '../../src/sim/world';

/**
 * The land of the dead (PLAN 2.16Rf): one line for every nation that does not live and is the
 * owner or the controller of a cell. Empty in a sound world.
 */
export function deadLand(world: World): string[] {
  const { owner, controller } = world.cells;
  const living = world.nations.cols.living;
  const dead = (n: number): boolean => n !== 0 && !(world.nations.has(n) && living[n] === 1);
  const owned = new Map<number, number>();
  const held = new Map<number, number>();
  for (let c = 0; c < owner.length; c++) {
    if (dead(owner[c]!)) owned.set(owner[c]!, (owned.get(owner[c]!) ?? 0) + 1);
    if (dead(controller[c]!)) held.set(controller[c]!, (held.get(controller[c]!) ?? 0) + 1);
  }
  return [...new Set([...owned.keys(), ...held.keys()])].sort((a, b) => a - b).map((n) => `nation ${n}: owner of ${owned.get(n) ?? 0} cells, controller of ${held.get(n) ?? 0}`);
}
