import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation, equipFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from './earth';

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

/** The middle cell of `battlefield`'s ground (30° E, 50° N). */
export const [FIELD_X, FIELD_Y] = cellOf(30.0, 50.0, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];

/**
 * The 1938 world (seed 5) with no formation in it, the pairs of `wars` at war, and seven cells
 * square of `terrain` around (FIELD_X, FIELD_Y): the ground of the combat tests' battles.
 */
export function battlefield(terrain: number, wars: [number, number][]): World {
  const w = SIZE_1938.w;
  const world = new Sim({ scenario: '1938', seed: 5, assets: assets1938(w) }).world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  for (const [a, b] of wars) world.wars.set(a, b, true);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) world.cells.terrain[(FIELD_Y + dy) * w + FIELD_X + dx] = terrain;
  return world;
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
