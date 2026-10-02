import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { equipFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';

/** Shared 1938 sim helpers for the system tests (PLAN 1.11–1.14). */

/** Nation id of a 1938 tag (1-based table id). */
export const nationId = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

export const INF_DIV = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

/** Creates a supplied formation of `template` at (x, y) (cell units) with its elements. */
export function addDivision(world: World, nation: number, x: number, y: number, template = INF_DIV): number {
  const id = world.formations.create();
  const c = world.formations.cols;
  c.nation[id] = nation;
  c.template[id] = template;
  c.x[id] = x;
  c.y[id] = y;
  c.supply[id] = 1;
  equipFormation(world, id, template);
  return id;
}
