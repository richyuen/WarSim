import { describe, expect, it } from 'vitest';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import { Terrain, TERRAIN_IDS } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { RULES_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { formationPath, movementSystem, orderMove } from '../../src/sim/systems/movement';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 3.3b: the ground on the march, by mobility class (`moveCost` of `data/terrain.json`, in
// since PLAN 1.11) and by unit type (`terrainMods.speed` of `data/units/land.json`, read by
// nothing before this task): a template crosses a cell at the least `speed` of its manoeuvre
// elements for that ground.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const HOURS = 6;
/** Cells of the march, east along one row. */
const CELLS = 10;

/** Cells a division of `id` goes in an hour over a row of one ground, at home and fed. */
function pace(terrain: number, id: string): number {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const world = s.world;
  world.formations.ids().forEach((f) => destroyFormation(world, f));
  const home = world.cells.controller[Y0 * W + X0]!;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= CELLS + 4; dx++) {
      const c = (Y0 + dy) * W + X0 + dx;
      world.cells.terrain[c] = terrain;
      world.cells.controller[c] = home;
    }
  }
  const f = addDivision(world, home, X0 + 0.5, Y0 + 0.5, template(id));
  expect(orderMove(world, f, X0 + CELLS + 0.5, Y0 + 0.5)).toBe(true);
  // One row, a cell at a time: every step is as long as the next, so the pace is one number.
  expect([...formationPath(world, f)!]).toEqual(Array.from({ length: CELLS + 1 }, (_, i) => Y0 * W + X0 + i));
  for (let h = 0; h < HOURS; h++) {
    movementSystem(world);
    world.tick++;
  }
  const c = world.formations.cols;
  expect(c.moving[f]).toBe(1);
  return (c.pathStep[f]! + c.stepFrac[f]!) / HOURS;
}

const cost = (terrain: number, mobility: 'foot' | 'motor' | 'tracked'): number => terrainJson.terrain[terrain]!.moveCost[mobility]!;

describe('the ground on the march, by unit type (PLAN 3.3b)', () => {
  it('a template has the least speed of its manoeuvre elements for each ground, 1 where they have none', () => {
    const speed = (id: string, terrain: number): number => RULES_1938.templates[template(id)]!.terrainSpeed[terrain]!;
    expect(RULES_1938.templates[template('infantry_div')]!.terrainSpeed).toEqual(TERRAIN_IDS.map(() => 1));
    expect(speed('cavalry_div', Terrain.Forest)).toBe(0.8);
    expect(speed('cavalry_div', Terrain.Mountains)).toBe(0.7);
    expect(speed('cavalry_div', Terrain.Plains)).toBe(1);
    expect(speed('heavy_panzer_div', Terrain.Marsh)).toBe(0.7);
    // The panzer division of 1938 has motorised infantry: its lorries set the pace in a marsh.
    expect(speed('panzer_div', Terrain.Marsh)).toBe(0.6);
    expect(speed('panzer_div', Terrain.Forest)).toBe(1);
    // The guns are support: the infantry division's AT gun and the rifle division's tanks do not set it.
    expect(speed('motorised_div', Terrain.Mountains)).toBe(0.6);
  });

  it('a cavalry division crosses a forest at 0.8 of the pace the move cost gives it, and plains at its own', () => {
    const plains = pace(Terrain.Plains, 'cavalry_div');
    const forest = pace(Terrain.Forest, 'cavalry_div');
    expect(forest / plains).toBeCloseTo(0.8 / cost(Terrain.Forest, 'foot'), 9);
    // Plains: the infantry beside it has no figure for any ground, and goes at 4 km/h for its 7.
    expect(plains / pace(Terrain.Plains, 'infantry_div')).toBeCloseTo(7 / 4, 9);
    expect(forest / pace(Terrain.Forest, 'infantry_div')).toBeCloseTo((7 / 4) * 0.8, 9);
  });

  it('a heavy panzer division crosses a marsh at 0.7 of it', () => {
    expect(pace(Terrain.Marsh, 'heavy_panzer_div') / pace(Terrain.Plains, 'heavy_panzer_div')).toBeCloseTo(0.7 / cost(Terrain.Marsh, 'tracked'), 9);
  });

  it('a panzer division crosses a forest at the half of the table, as before', () => {
    expect(cost(Terrain.Forest, 'tracked')).toBe(2);
    expect(pace(Terrain.Forest, 'panzer_div') / pace(Terrain.Plains, 'panzer_div')).toBeCloseTo(1 / 2, 9);
  });

  it('infantry crosses a forest by the move cost alone, as before', () => {
    expect(pace(Terrain.Forest, 'infantry_div') / pace(Terrain.Plains, 'infantry_div')).toBeCloseTo(1 / cost(Terrain.Forest, 'foot'), 9);
  });
});
