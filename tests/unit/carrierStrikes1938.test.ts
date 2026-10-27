import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { destroyFormation } from '../../src/sim/systems/elements';
import { CARRIER_CYCLE, CARRIER_SPOT_SHARE, carrierStrikes, REACH_EPS_KM, strikeTarget } from '../../src/sim/systems/navalCombat';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
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
    // No transports (PLAN 7.49d1): a landing or a ferry under way draws the warfleets to escort it,
    // and Britain's ferry of its first days kept its carriers from the battle with the Germans.
    const w0 = sim.world;
    const tps: number[] = [];
    w0.formations.forEach((f) => {
      if (w0.isFleet(f) && ['ENG', 'JAP', 'GER', 'USA'].map(id).includes(w0.formations.cols.nation[f]!) && transportRoom(w0, f) > 0 && fleetPower(w0, f) <= 0) tps.push(f);
    });
    expect(tps.length).toBeGreaterThan(0);
    for (const f of tps) destroyFormation(w0, f);
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
      // Over it at a strike's hour, and in the air in the hour the page plays: home no sooner
      // than its start (since PLAN 7.84b, over its target till the next flight's strike).
      const strike = s.launch + s.km / s.kmh;
      expect(Math.abs(strike - Math.round(strike))).toBeLessThan(1e-6);
      expect(Math.round(strike) % CARRIER_CYCLE).toBe(0);
      const over = sortieAt(s, strike, w.cells.w);
      expect(Math.hypot(over.x - s.tx, over.y - s.ty)).toBeLessThan(1e-6);
      expect(s.over).toBeCloseTo(Math.max(0, CARRIER_CYCLE - (2 * s.km) / s.kmh), 9);
      expect(strike + s.over + s.km / s.kmh).toBeGreaterThan(w.tick - 1);
    }
    console.log(`hour ${hour}: ${flights.length} flights of carriers' strikes, the first ${flights[0]!.sortie.km.toFixed(0)} km at ${flights[0]!.sortie.kmh} km/h`);
    // PLAN 7.84b (critic run 12: a strike's row clicked showed no plane): while the carriers strike,
    // their wing is in the air at every time the page plays (the hour before the tick), not in the
    // hour or so about each strike alone: over the target the hours its flights leave of the cycle.
    let held = 0;
    let gaps = 0;
    for (let h = 0; h < 3 * CARRIER_CYCLE; h++) {
      let fl: ReturnType<typeof carrierStrikes> = [];
      let striking = false;
      sim.step(1, (w) => {
        fl = carrierStrikes(w);
        striking = w.seaBattles.some((b) => strikeTarget(w, b.fleets) !== null);
      });
      if (!striking) break;
      for (let q = 0; q <= 4; q++) {
        const t = sim.world.tick - 1 + q / 4;
        expect(fl.some((f) => sortieAt(f.sortie, t, sim.world.cells.w).leg !== Leg.Home), `a carrier's flight in the air at hour ${t}`).toBe(true);
        // The times the flights out and back alone (no hours over the target) leave empty.
        if (!fl.some((f) => sortieAt({ ...f.sortie, over: 0 }, t, sim.world.cells.w).leg !== Leg.Home)) gaps++;
      }
      held++;
    }
    expect(held, 'hours of carriers striking after the first flight').toBeGreaterThanOrEqual(2);
    expect(gaps, "times between two strikes' flights out and back among them").toBeGreaterThan(0);
  });

  it('a fleet at its reach by a sum of floats (within REACH_EPS_KM) is drawn struck, as the battle strikes it (PLAN 7.145)', () => {
    // Seed 8693 on ADR-738's history: Japan's carrier fleet stood 250.0000000000016 km from the American fleet it
    // struck; the battle's strike reads `inReach`, the flight's read `<`, and the row showed no plane.
    const sim = new Sim({ scenario: '1938', seed: 6131, assets: assets1938(SIZE_1938.w) });
    sim.command({ kind: 'declareWar', attacker: id('JAP'), defender: id('USA') });
    sim.command({ kind: 'declareWar', attacker: id('GER'), defender: id('ENG') });
    let flights: ReturnType<typeof carrierStrikes> = [];
    for (let hour = 0; hour < 200 && flights.length === 0; hour++) sim.step(1, (w) => (flights = carrierStrikes(w)));
    expect(flights.length, "a carrier's strike by hour 200").toBeGreaterThan(0);
    const w = sim.world;
    const { wing, sortie } = flights[0]!;
    const units = w.rules!.templates[w.formations.cols.template[wing]!]!.elements.map((e) => w.rules!.units[e.unit]!);
    const kept = units.map((u) => u.rangeKm);
    const reachAt = (km: number): void => units.forEach((u) => (u.rangeKm = km / CARRIER_SPOT_SHARE));
    try {
      // Its reach a hair under the km, within REACH_EPS_KM: struck, and drawn.
      reachAt(sortie.km - REACH_EPS_KM / 10);
      expect(w.seaBattles.some((b) => strikeTarget(w, b.fleets) !== null)).toBe(true);
      expect(carrierStrikes(w).some((f) => f.wing === wing)).toBe(true);
      // Beyond it: neither.
      reachAt(sortie.km - 1);
      expect(carrierStrikes(w).some((f) => f.wing === wing)).toBe(false);
    } finally {
      units.forEach((u, k) => (u.rangeKm = kept[k]!));
    }
  });
});
