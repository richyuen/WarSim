import { neighbours4 } from '../nav/grid';
import type { World } from '../world';
import { frontierOf } from './territory';

/**
 * The wars that have a land front (PLAN 7.14): a cell held by a nation of one side beside a cell
 * held by a nation of the other (4-neighbours, over the seam of a looping map). The cells are
 * those of the frontier (`frontierOf`: held by a nation at war beside a cell held by an enemy), so
 * a war whose sides meet nowhere on land, across a sea or with neutral land between them, has none;
 * a landing that holds ground has one.
 */
export function warsWithFront(world: World): Set<number> {
  const out = new Set<number>();
  if (world.wars.list.length === 0) return out;
  const { w, h, controller } = world.cells;
  const wrap = world.settings.loopingMap;
  const pairs = new Set<number>();
  const nb: number[] = [];
  for (const c of frontierOf(world)) {
    const a = controller[c]!;
    for (const k of neighbours4(c, w, h, wrap, nb)) {
      const b = controller[k]!;
      if (b !== 0 && b !== a) pairs.add(a * 65536 + b);
    }
  }
  for (const war of world.wars.list) {
    const [A, D] = war.sides;
    if (A.some((a) => D.some((d) => pairs.has(a * 65536 + d)))) out.add(war.id);
  }
  return out;
}
