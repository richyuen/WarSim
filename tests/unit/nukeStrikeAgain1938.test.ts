import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.6d (critic R7-B1): the critic's God-set France (`critic/scripts/c7_f_ainuke.mjs`, seed
// 2604): 6 warheads and missiles, Germany buffed and at efficiency 2 against France at 0.5, both
// sides fighting to the death from day 2. Its army fell from 555k to 88k men; it struck Berlin once
// (day 41) and held its 5 other warheads. With desperation counting the men lost (PLAN 7.6a,
// ADR-461) a France that keeps losing strikes again within 60 days (days 39, 41 and 90; without
// it, days 41 and 90: the critic's 49 days and more of holding).

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

describe('a nation fighting for its life that struck once strikes again (PLAN 7.6d)', () => {
  it("the critic's France: a second strike within 60 days, while the war goes on", () => {
    const sim = new Sim({ scenario: '1938', seed: 2604, assets: assets1938(W) });
    const world = sim.world;
    const decided: number[] = [];
    const watch = (w: typeof world): void => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === FRA) decided.push(ev[i]!);
      w.out.events.length = 0;
      w.out.fires.length = 0;
    };
    sim.command({ kind: 'grantWarheads', nation: FRA, count: 6 });
    sim.command({ kind: 'grantTech', nation: FRA, tech: 'ballistic_missiles' });
    sim.command({ kind: 'declareWar', attacker: GER, defender: FRA });
    sim.step(2, watch);
    const war = world.wars.list.find((w) => w.sides[0].includes(GER) && w.sides[1].includes(FRA))!;
    expect(war).toBeDefined();
    for (const b of ['attack', 'defense', 'speed'] as const) sim.command({ kind: 'grantBuff', targetKind: 'nation', target: GER, buff: b, magnitude: 0.6, hours: 24 * 200, nameKey: 'god.buff' });
    sim.command({ kind: 'setEfficiency', nation: GER, value: 2 });
    sim.command({ kind: 'setEfficiency', nation: FRA, value: 0.5 });
    for (let d = 1; d <= 90; d++) {
      if (d === 2) {
        sim.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
        sim.command({ kind: 'setWarFightToDeath', war: war.id, side: 0, value: true });
      }
      sim.step(24, watch);
    }
    process.stderr.write(`France's strike decisions on days ${decided.map((t) => Math.floor(t / 24)).join(', ')}\n`);
    expect(decided.filter((t) => t < 24 * 60).length, 'strikes in the first 60 days').toBeGreaterThanOrEqual(2);
    // The war it struck in is still on: the later strikes are of a France that keeps losing.
    expect(world.wars.list.includes(war)).toBe(true);
  });
});
