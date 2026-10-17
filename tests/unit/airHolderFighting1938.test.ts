import { describe, expect, it } from 'vitest';
import { AIR_CONTESTED } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airHolders } from '../../src/sim/systems/airSuperiority';
import { airOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.8 (critic run 7, aircraft 5): on day 10 of Germany's war on Poland (seed 8217) the air
// mode had Poland, the Baltic states and Ukraine "held by Yugoslavia". Yugoslavia, on Poland's
// side in another war (against Austria, Denmark and Iceland), had its wings based in Poland's air
// zone patrolling over Austria; their climbs out made it the zone's top flyer. A zone's holder is
// now one fighting there: at war with a nation that flew in the zone or holds land in it.

const { w: W, h: H } = SIZE_1938;
const [GER, POL, YUG] = ['GER', 'POL', 'YUG'].map(nationId) as [number, number, number];

describe("an air zone's holder is one fighting there (PLAN 7.8)", () => {
  const sim = new Sim({ scenario: '1938', seed: 8217, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
  sim.step(24 * 10);
  const air = airOf(world);
  const holders = airHolders(world, air.count);

  it("Warsaw's zone: not Yugoslavia, which is not at war with anyone there", () => {
    const [x, y] = cellOf(21.01, 52.23, W, H);
    const z = air.zoneOf[Math.floor(y) * W + Math.floor(x)]!;
    const flown = world.airPower.get(z);
    expect(flown?.get(YUG) ?? 0, 'Yugoslavia flew there (its climbs out)').toBeGreaterThan(0);
    process.stderr.write(`Warsaw's zone ${z}: holder ${holders[z]} (Poland ${POL}, Germany ${GER}, contested ${AIR_CONTESTED})\n`);
    expect(holders[z]).not.toBe(YUG);
    expect([POL, GER, AIR_CONTESTED]).toContain(holders[z]);
  });

  it('every holder is at war with a nation that flew in its zone or holds land there', () => {
    const land = new Map<number, Set<number>>();
    for (let c = 0; c < air.zoneOf.length; c++) {
      const z = air.zoneOf[c]!;
      if (holders[z] === 0 || world.cells.controller[c] === 0) continue;
      let s = land.get(z);
      if (!s) land.set(z, (s = new Set()));
      s.add(world.cells.controller[c]!);
    }
    let held = 0;
    for (let z = 1; z <= air.count; z++) {
      const h = holders[z]!;
      if (h === 0 || h === AIR_CONTESTED) continue;
      held++;
      const others = [...(world.airPower.get(z)?.keys() ?? []), ...(land.get(z) ?? [])];
      expect(others.some((m) => world.wars.atWar(h, m)), `zone ${z}'s holder ${h} fights there`).toBe(true);
    }
    expect(held).toBeGreaterThan(0);
  });
});
