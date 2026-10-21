import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { ALLIANCE_COST, ALLIANCE_COST_MAX, desperationOf, EXTREME_TABOO, NUKE_FLOOR, nukeInputs, nuclearUtility } from '../../src/sim/systems/nuclear';
import { menOf } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.48 (critic R8-B1's France, ADR-581): in extreme desperation the alliance's cost weighs
// EXTREME_TABOO of itself, as the taboo does: a nation fighting for its life weighs its allies'
// displeasure at half. With the chase (ADR-580), seed 7127's France, 10 warheads, Germany's war on
// it, stood 15 days in extreme desperation with its bomber, its best place Berlin (value 0.166, the
// warhead through 0.214, 334,000 dead, desperation 1.083 on day 55), at 0.017 to 0.020 under
// NUKE_FLOOR with its three allies apart at 0.15, and lost the bomber with Paris on day 68.

const { w: W } = SIZE_1938;
const [FRA, GER, BEL, NED, LUX] = ['FRA', 'GER', 'BEL', 'NED', 'LUX'].map(nationId) as [number, number, number, number, number];

describe("in extreme desperation, the alliance's cost at half (PLAN 7.48)", () => {
  const sim = new Sim({ scenario: '1938', seed: 7127, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  sim.command({ kind: 'grantWarheads', nation: FRA, count: 10 });
  sim.command({ kind: 'declareWar', attacker: GER, defender: FRA });
  // The Low Countries join France's alliance and not its war, as on day 55 of the critic's run.
  for (const n of [BEL, NED, LUX]) sim.command({ kind: 'joinAlliance', nation: n, alliance: world.alliances.allianceOf(FRA)!.id });
  sim.step(48);
  const war = world.wars.list.find((w) => w.sides[0].includes(GER) && w.sides[1].includes(FRA))!;
  const nc = world.nations.cols;
  const berlin = (): ReturnType<typeof nukeInputs> => nukeInputs(world, FRA, war, 1, nc.capitalX[GER]!, nc.capitalY[GER]!);
  const apart = (world.alliances.allianceOf(FRA)?.members ?? []).filter((m) => m !== FRA && !war.sides[1].includes(m)).length;
  const full = Math.min(ALLIANCE_COST_MAX, ALLIANCE_COST * apart);

  it('France has three allies apart from its war: their cost whole while it is not extreme', () => {
    expect(war).toBeDefined();
    expect(apart).toBe(3);
    expect(desperationOf(world, FRA, war, 1).extreme).toBe(false);
    expect(berlin().allianceCost).toBeCloseTo(full, 9);
  });

  it("fighting to the death with half its men lost: extreme, the cost at half, and day 55's strike on Berlin over NUKE_FLOOR", () => {
    const now = war.sides[1].reduce((t, n) => t + (menOf(world).get(n) ?? 0), 0);
    const startMen = war.startMen[1];
    war.fightToDeath[1] = true;
    war.startMen[1] = 2 * now;
    try {
      expect(desperationOf(world, FRA, war, 1).extreme).toBe(true);
      const i = berlin();
      expect(i.extreme).toBe(true);
      expect(i.allianceCost).toBeCloseTo(full * EXTREME_TABOO, 9);
      // The chase's day 55 (`docs/evidence/7.48.md`): the place, the chance through, the dead and
      // the desperation as measured; the doctrine, outrage and taboo France's own here.
      const day55 = { ...i, targetValue: 0.166, through: 0.214, people: 334_000, desperation: 1.083 };
      const u = nuclearUtility(day55);
      const whole = nuclearUtility({ ...day55, allianceCost: full });
      process.stderr.write(`France on Berlin, day 55's parts: alliance's cost ${i.allianceCost} (whole ${full}), utility ${u.toFixed(4)} (whole ${whole.toFixed(4)}), floor ${NUKE_FLOOR}\n`);
      expect(whole).toBeLessThan(NUKE_FLOOR);
      expect(u).toBeGreaterThan(NUKE_FLOOR);
    } finally {
      war.fightToDeath[1] = false;
      war.startMen[1] = startMen;
    }
  });
});
