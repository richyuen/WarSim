import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { DESPERATION_MEN, desperationOf } from '../../src/sim/systems/nuclear';
import { menLost, menOf } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.6a (critic R7-B1): desperation did not count the men a nation lost. The critic's God-set
// France lost 555k → 163k men in 40 days and stayed at 0.50 to 0.61 (fighting to the death alone,
// no land lost) until the Germans came near Paris. It now counts the share of its side's men lost
// since the war was first assessed (`menLost`, the exhaustion's `lost`) at DESPERATION_MEN.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

describe('desperation counts the men lost in the war (PLAN 7.6a)', () => {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  sim.command({ kind: 'declareWar', attacker: GER, defender: FRA });
  sim.step(48);
  const war = world.wars.list.find((w) => w.sides[0].includes(GER) && w.sides[1].includes(FRA))!;

  it('no men lost when the war is first assessed', () => {
    expect(war).toBeDefined();
    expect(war.startMen[1]).toBeGreaterThan(0);
    expect(menLost(world, war, 1)).toBeCloseTo(0, 6);
  });

  it('a side that lost half its men is more desperate by DESPERATION_MEN × a half', () => {
    const before = desperationOf(world, FRA, war, 1).desperation;
    const now = war.sides[1].reduce((t, n) => t + (menOf(world).get(n) ?? 0), 0);
    const start = war.startMen[1];
    // The same men against twice as many at the start: half of them lost.
    war.startMen[1] = 2 * now;
    try {
      expect(menLost(world, war, 1)).toBeCloseTo(0.5, 9);
      const after = desperationOf(world, FRA, war, 1).desperation;
      process.stderr.write(`France's desperation ${before.toFixed(3)} → ${after.toFixed(3)} with half its men lost\n`);
      expect(after - before).toBeCloseTo(DESPERATION_MEN * 0.5, 6);
      // More men than at the start: nothing lost, not less desperate.
      war.startMen[1] = now / 2;
      expect(menLost(world, war, 1)).toBe(0);
      expect(desperationOf(world, FRA, war, 1).desperation).toBeCloseTo(before, 9);
    } finally {
      war.startMen[1] = start;
    }
  });
});
