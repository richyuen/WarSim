import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blast, DEAD_COST, deadCost, NUKE_FLOOR, nuclearUtility, placeParts, restraintOf, type NukeInputs } from '../../src/sim/systems/nuclear';
import { declareWar } from '../../src/sim/systems/war';
import { DEFENDERS } from '../../src/sim/wars';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.38c (critic R10-B1: `nuclearUtility` had no term for the dead). On the critic's run 10
// (`docs/evidence/7.38/measure-a.md`) the United States H-bombed Rome for 3.7 million dead at a
// utility of 0.091 and Paris for 1.4 million at 0.073, and Germany Shanghai for 3.8 million at
// 0.025, each a near-tie of gain and costs. The people a burst is expected to kill are now a cost,
// DEAD_COST a million × (2 − doctrine); a strike back weighs them too, and its bonus is as it was.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

/** A decision's inputs as the critic's tool read them (`a-toll-*-bcbc99c.json`), its people the thermonuclear yield's. */
function inputs(u: Partial<NukeInputs>): NukeInputs {
  return { targetValue: 1, through: 1, people: 0, desperation: 1, doctrine: 1, retaliation: 0, allianceCost: 0, outrage: 0.1, taboo: 1, mad: false, extreme: false, retaliating: false, ...u };
}

describe('the dead weighed (PLAN 7.38c)', () => {
  it.each([
    // [case, inputs, the critic's utility]
    ['8693, day 9891: the United States on Rome, 3.7 million', inputs({ desperation: 1.463, doctrine: 0.65, allianceCost: 0.1, outrage: 0.16, taboo: 1, people: 3_709_000 }), 0.091],
    ['8693, day 6969: the United States on Paris, 1.4 million', inputs({ desperation: 1.255, doctrine: 0.65, allianceCost: 0.1, outrage: 0.139, taboo: 0.838, people: 1_393_000 }), 0.073],
    ['4877, day 10434: Germany on Shanghai, 3.8 million', inputs({ targetValue: 0.402, desperation: 1.067, doctrine: 1.4, allianceCost: 0.15, outrage: 0.1, taboo: 0.541, people: 3_802_000 }), 0.025],
  ] as const)('%s: was over NUKE_FLOOR, now under it', (_, i, critic) => {
    const before = nuclearUtility({ ...i, people: 0 });
    const after = nuclearUtility(i);
    process.stderr.write(`${_}: ${before.toFixed(3)} without the dead, ${after.toFixed(3)} with them\n`);
    expect(before).toBeCloseTo(critic, 2);
    expect(before).toBeGreaterThanOrEqual(NUKE_FLOOR);
    expect(after).toBeLessThan(NUKE_FLOOR);
  });

  it.each([
    ['4877, day 10612: the Soviet Union answers Germany, 2.5 million', inputs({ targetValue: 0.592, desperation: 0.078, doctrine: 1.2, outrage: 0.391, taboo: 0.3, mad: true, retaliating: true, retaliation: 1.4, people: 2_474_000 }), 0.484],
    ['8693, day 5892: the Soviet Union answers the United States, 1 million', inputs({ desperation: 0.046, doctrine: 1.2, outrage: 0.1, taboo: 0.3, mad: true, retaliating: true, retaliation: 0.65, people: 1_018_000 }), 0.776],
  ] as const)('%s: a strike back still over NUKE_FLOOR, its bonus whole', (_, i, critic) => {
    const before = nuclearUtility({ ...i, people: 0 });
    const after = nuclearUtility(i);
    process.stderr.write(`${_}: ${before.toFixed(3)} without the dead, ${after.toFixed(3)} with them\n`);
    expect(before).toBeCloseTo(critic, 2);
    expect(after).toBeGreaterThan(NUKE_FLOOR);
    expect(before - after).toBeCloseTo(deadCost(i.people, i.doctrine), 9);
  });

  it('the cost is DEAD_COST a million × (2 − doctrine), at least × 1, × the chance the warhead gets there', () => {
    expect(deadCost(1_000_000, 1)).toBeCloseTo(DEAD_COST, 12);
    expect(deadCost(1_000_000, 1.5)).toBeCloseTo(DEAD_COST, 12); // at least × 1 (PLAN 7.45, ADR-572)
    expect(deadCost(1_000_000, 0.5)).toBeCloseTo(DEAD_COST * 1.5, 12);
    const i = inputs({ people: 2_000_000, through: 0.5, targetValue: 0.5 });
    expect(nuclearUtility({ ...i, people: 0 }) - nuclearUtility(i)).toBeCloseTo(0.5 * deadCost(2_000_000, 1), 12);
  });

  it('a place\'s expected dead are the people its burst kills, and the restraint tells their cost', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
    s.step(1);
    const war = declareWar(w, GER, FRA, true)!;
    const nc = w.nations.cols;
    const [bx, by] = [nc.capitalX[GER]!, nc.capitalY[GER]!];
    const p = placeParts(w, FRA, war, DEFENDERS, bx, by);
    expect(p.yieldN).toBe(1);
    expect(p.people).toBeGreaterThan(100_000);
    const r = restraintOf(w, FRA, war, DEFENDERS);
    if (r.u > -Infinity) {
      const best = placeParts(w, FRA, war, DEFENDERS, r.x, r.y);
      expect(r.people).toBe(best.people);
      expect(r.dead).toBeCloseTo(best.through * deadCost(best.people, r.doctrine), 12);
    }
    const toll = blast(w, 1, bx, by);
    process.stderr.write(`Berlin: ${p.people} expected, ${toll.people} killed\n`);
    expect(toll.people).toBe(p.people);
  });
});
