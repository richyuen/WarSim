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
  c.org[id] = 1;
  equipFormation(world, id, template);
  return id;
}

/** Steps `ticks`, collecting every event as a [tick, kind, a, b, x, y] record (fires dropped). */
export function runEvents(s: { step(n: number, after: (w: World) => void): void }, ticks: number): number[][] {
  const out: number[][] = [];
  s.step(ticks, (w) => {
    for (let i = 0; i < w.out.events.length; i += 6) out.push(w.out.events.slice(i, i + 6));
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  return out;
}

/** [a, b] of the events of one kind. */
export const eventKinds = (ev: number[][], kind: number): number[][] => ev.filter((e) => e[1] === kind).map((e) => [e[2]!, e[3]!]);
