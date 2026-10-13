import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { AIR_SUPPLY } from '../../src/sim/systems/airSuperiority';
import { SUPPLY_RATE, supplySystem } from '../../src/sim/systems/supply';
import { airOf } from '../../src/sim/world';
import { addDivision, battlefield, FIELD_X as X0, FIELD_Y as Y0, nationId } from '../helpers/sim1938';

// PLAN 5.8t1: air superiority on a formation's supply. A formation fed gains SUPPLY_RATE ×
// (1 + AIR_SUPPLY × (2s − 1)) an hour, s its nation's superiority in its air zone: half the rate
// under the enemy's air, the rate at a half and where no one flew, one and a half under its own.

const SWE = nationId('SWE');
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

/** The field's holder and an enemy of it. */
const HOLDER = battlefield(Terrain.Plains, []).cells.controller[Y0 * SIZE_1938.w + X0]!;
const ENEMY = nationId('POL') === HOLDER ? nationId('GER') : nationId('POL');
/** A division of the field's holder at a quarter's supply on its own ground, at war, the air over it to `air` (0 for no one's): its supply after an hour. */
function hour(air: number): number {
  const world = battlefield(Terrain.Plains, [[HOLDER, ENEMY]]);
  const f = addDivision(world, HOLDER, X0 + 0.5, Y0 + 0.5, INF);
  if (air) world.airPower.set(airOf(world).zoneOf[Y0 * world.cells.w + X0]!, new Map([[air, 900]]));
  world.formations.cols.supply[f] = 0.25;
  supplySystem(world);
  return world.formations.cols.supply[f]!;
}

describe('air superiority on supply (PLAN 5.8t1)', () => {
  it('fed under the enemy\'s air at half the rate, under its own at one and a half, at the rate where no one or a nation outside the war flew', () => {
    expect(AIR_SUPPLY).toBe(0.5);
    expect(hour(0)).toBe(0.25 + SUPPLY_RATE);
    expect(hour(SWE)).toBe(0.25 + SUPPLY_RATE);
    expect(hour(ENEMY)).toBe(0.25 + SUPPLY_RATE / 2);
    expect(hour(HOLDER)).toBe(0.25 + 1.5 * SUPPLY_RATE);
  });
});
