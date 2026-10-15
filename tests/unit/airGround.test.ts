import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { AIR_SUPERIORITY, airFactor, combatSystem } from '../../src/sim/systems/combat';
import { airOf, FIRE_STRIDE, type World } from '../../src/sim/world';
import { addDivision, battlefield, FIELD_X as X0, FIELD_Y as Y0, nationId } from '../helpers/sim1938';

// PLAN 5.4a, the AT of 5.4: a battle with air superiority has a better outcome by the expected
// margin. A formation's fire × (1 + AIR_SUPERIORITY × (2s − 1)), s its nation's superiority in
// its air zone: the same battle with the air to one side, to the other and to no one.

const [GER, POL, SWE] = ['GER', 'POL', 'SWE'].map(nationId) as [number, number, number];
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

/** Two infantry divisions a cell apart on plains, the air over them to `air` (0 for no one's). */
function battle(air: number): { world: World; ger: number; pol: number } {
  const world = battlefield(Terrain.Plains, [[GER, POL]]);
  const ger = addDivision(world, GER, X0 + 0.5, Y0 + 0.5, INF);
  const pol = addDivision(world, POL, X0 + 1.5, Y0 + 0.5, INF);
  if (air) {
    const zone = airOf(world).zoneOf[Y0 * world.cells.w + X0]!;
    expect(airOf(world).zoneOf[Y0 * world.cells.w + X0 + 1]).toBe(zone);
    world.airPower.set(zone, new Map([[air, 900]]));
  }
  return { world, ger, pol };
}
/** The first hour's damage done by the formation of each side, in target units. */
function firstHour(air: number): { ger: number; pol: number } {
  const { world, ger } = battle(air);
  combatSystem(world);
  const fr = world.out.fires.slice();
  const out = { ger: 0, pol: 0 };
  for (let i = 0; i < fr.length; i += FIRE_STRIDE) out[world.elements.cols.formation[fr[i + 2]!] === ger ? 'ger' : 'pol'] += fr[i + 5]!;
  return out;
}
/** Men each side lost in `hours`. */
function losses(air: number, hours: number): { ger: number; pol: number } {
  const { world, ger, pol } = battle(air);
  const c = world.formations.cols;
  const [g0, p0] = [c.strength[ger]!, c.strength[pol]!];
  for (let h = 0; h < hours; h++) {
    combatSystem(world);
    world.tick++;
    world.out.fires.length = 0;
  }
  const left = (id: number): number => (world.formations.has(id) ? c.strength[id]! : 0);
  return { ger: g0 - left(ger), pol: p0 - left(pol) };
}

describe('air superiority in ground combat (PLAN 5.4a)', () => {
  it('the factor: 1 + 0.2 at full superiority, 1 − 0.2 at none, 1 at a half and where no one flew', () => {
    expect(AIR_SUPERIORITY).toBe(0.2);
    const { world, ger, pol } = battle(GER);
    expect(airFactor(world, ger)).toBeCloseTo(1.2, 12);
    expect(airFactor(world, pol)).toBeCloseTo(0.8, 12);
    const none = battle(0);
    expect(airFactor(none.world, none.ger)).toBe(1);
    // A nation outside the war flew there: a half for both, no change.
    const out = battle(SWE);
    expect(airFactor(out.world, out.ger)).toBe(1);
    expect(airFactor(out.world, out.pol)).toBe(1);
  });

  it('the AT: the first hour\'s fire of each side by exactly its factor; over two days the side with the air loses less and takes more', () => {
    const base = firstHour(0);
    const air = firstHour(GER);
    expect(base.ger).toBeGreaterThan(0);
    expect(air.ger / base.ger).toBeCloseTo(1.2, 9);
    expect(air.pol / base.pol).toBeCloseTo(0.8, 9);
    const other = firstHour(POL);
    expect(other.pol / base.pol).toBeCloseTo(1.2, 9);
    expect(other.ger / base.ger).toBeCloseTo(0.8, 9);
    const l0 = losses(0, 48);
    const lg = losses(GER, 48);
    const lp = losses(POL, 48);
    console.log(`48 h, men lost GER/POL: no air ${l0.ger}/${l0.pol}, German air ${lg.ger}/${lg.pol}, Polish air ${lp.ger}/${lp.pol}`);
    // The exchange of the side with the air: better by more than its factor's ratio, 1.2 ÷ 0.8.
    const ratio = (l: { ger: number; pol: number }): number => l.pol / l.ger;
    expect(ratio(lg) / ratio(l0)).toBeGreaterThan(1.4);
    expect(ratio(l0) / ratio(lp)).toBeGreaterThan(1.4);
    expect(lg.ger).toBeLessThan(l0.ger);
    expect(lg.pol).toBeGreaterThan(l0.pol);
  });
});
