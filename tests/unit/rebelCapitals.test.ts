import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt } from '../../src/sim/systems/revolts';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 2.15e (found in PLAN 2.12a): a rebel nation whose area has no city took the middle of
// the area as its capital. The middle of a crescent, of a strip of coast or of a group of
// islands is not the nation's land, and is often the sea.
//
// A capital that is a city is in the city's cell (`cities.cell`), which need not be the cell
// of its coordinates: a city on the shore has those in a sea cell of the coarse grid (63 of the
// 406 capitals below). That is how every city is held, and no defect.

const sim1938 = (seed = 5): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });

/** A revolt forced in every province of the 1938 start; the id of the first nation founded. */
function revoltEverywhere(world: World): number {
  const first = world.nations.highWater;
  for (let p = 1; p < world.provinces.count; p++) forceRevolt(world, p);
  return first;
}

/** The cell of every capital that is a city, by nation. */
function capitalCities(world: World): Map<number, number> {
  const cc = world.cities.cols;
  const cells = new Map<number, number>();
  world.cities.forEach((ci) => {
    if (cc.capitalOf[ci] !== 0) cells.set(cc.capitalOf[ci]!, cc.cell[ci]!);
  });
  return cells;
}

describe('where a rebel nation starts (PLAN 2.15e)', () => {
  it('a revolt forced in every province of the 1938 start: every capital is on its own land', () => {
    const world = sim1938().world;
    const first = revoltEverywhere(world);
    const nc = world.nations.cols; // after the revolts: the table has grown (PLAN 2.12a)
    const { owner, w } = world.cells;
    const cities = capitalCities(world);
    let founded = 0;
    let field = 0;
    const abroad: number[] = [];
    for (let id = first; id < world.nations.highWater; id++) {
      founded++;
      if (!cities.has(id)) field++;
      const cell = cities.get(id) ?? Math.floor(nc.capitalY[id]!) * w + Math.floor(nc.capitalX[id]!);
      if (owner[cell] !== id) abroad.push(id);
    }
    console.log(`forced revolts: ${founded} nations founded, ${field} without a city, ${abroad.length} with the capital off their land`);
    expect(founded).toBeGreaterThan(300);
    expect(field).toBeGreaterThan(20);
    expect(abroad, 'nations with the capital on a cell that is not theirs').toEqual([]);
  }, 300_000);
});
