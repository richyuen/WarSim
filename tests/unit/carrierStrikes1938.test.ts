import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CARRIER_CYCLE, carrierStrikes } from '../../src/sim/systems/navalCombat';
import { sortieAt } from '../../src/sim/systems/sorties';
import { assets1938 } from '../helpers/earth';

// PLAN 4.12b (the critic's R5-B4): a carrier's strike is drawn as a sortie. The sim strikes at
// once, once in CARRIER_CYCLE hours (`navalCombatSystem`); `carrierStrikes` derives the flight
// that is over its target at that hour, from the carrier's fleet to the enemy's nearest fleet.
// The critic's war: seed 6131, Germany on Britain and Japan on the United States.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

describe('a carrier\'s strikes as flights (PLAN 4.12b)', () => {
  it('from its fleet to an enemy fleet of its battle, over it at a strike\'s hour, home after', () => {
    const sim = new Sim({ scenario: '1938', seed: 6131, assets: assets1938(SIZE_1938.w) });
    sim.command({ kind: 'declareWar', attacker: id('GER'), defender: id('ENG') });
    sim.command({ kind: 'declareWar', attacker: id('JAP'), defender: id('USA') });
    let flights: ReturnType<typeof carrierStrikes> = [];
    let hour = 0;
    for (; hour < 80 && flights.length === 0; hour++) sim.step(1, (w) => (flights = carrierStrikes(w)));
    expect(flights.length, 'a carrier\'s strike by hour 80').toBeGreaterThan(0);
    const w = sim.world;
    const c = w.formations.cols;
    const battle = w.seaBattles.find((b) => b.fleets.some((f) => Math.hypot(c.x[f]! - flights[0]!.sortie.bx, c.y[f]! - flights[0]!.sortie.by) < 1e-9))!;
    expect(battle, 'its base is a fleet of a sea battle').toBeDefined();
    for (const { wing, nation, sortie: s } of flights) {
      // A wing on a carrier (a fleet's base), of its nation.
      expect(w.wingBase.get(wing)!).toBeLessThan(0);
      expect(c.nation[wing]).toBe(nation);
      // Its target an enemy's fleet of the battle.
      const target = battle.fleets.find((f) => c.x[f] === s.tx && c.y[f] === s.ty)!;
      expect(target).toBeDefined();
      expect(w.wars.atWar(nation, c.nation[target]!)).toBe(true);
      // Over it at a strike's hour, and gone home before the next but one.
      const strike = s.launch + s.km / s.kmh;
      expect(Math.abs(strike - Math.round(strike))).toBeLessThan(1e-6);
      expect(Math.round(strike) % CARRIER_CYCLE).toBe(0);
      const over = sortieAt(s, strike, w.cells.w);
      expect(Math.hypot(over.x - s.tx, over.y - s.ty)).toBeLessThan(1e-6);
      expect(strike + s.km / s.kmh).toBeGreaterThanOrEqual(w.tick - 1);
    }
    console.log(`hour ${hour}: ${flights.length} flights of carriers' strikes, the first ${flights[0]!.sortie.km.toFixed(0)} km at ${flights[0]!.sortie.kmh} km/h`);
  });
});
