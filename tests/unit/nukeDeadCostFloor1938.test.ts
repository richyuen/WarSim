import { describe, expect, it } from 'vitest';
import { DEAD_COST, deadCost, NUKE_FLOOR, nuclearUtility, type NukeInputs } from '../../src/sim/systems/nuclear';

// PLAN 7.45 (from PLAN 7.38e's first read, `docs/evidence/7.38/measure-e.md`). The dead's cost was
// DEAD_COST a million × (2 − doctrine): at Germany's doctrine of 1.4 it was 0.06 a million, and in
// extreme desperation under MAD Germany H-bombed 17,112 massed Soviet men for 1,334,057 dead at a
// utility of 0.060 (seed 758, day 9178; Belgium's capital, seed 756, 2,294,126 at 0.037, is a
// fission burst since PLAN 7.44). The scale is now at least 1 (ADR-572): a high doctrine does not
// ease the dead, and a low one still weighs them more.

/** A decision's inputs as `tools/diag/nukeToll.ts` read them. */
function inputs(u: Partial<NukeInputs>): NukeInputs {
  return { targetValue: 1, through: 1, people: 0, desperation: 1, doctrine: 1, retaliation: 0, allianceCost: 0, outrage: 0.1, taboo: 1, mad: false, extreme: false, retaliating: false, ...u };
}

describe('the dead not eased by a high doctrine (PLAN 7.45)', () => {
  it('758, day 9178: Germany on massed Soviet men, 1.3 million, under NUKE_FLOOR', () => {
    const i = inputs({ targetValue: 0.72, desperation: 1.724, doctrine: 1.4, retaliation: 1.2, allianceCost: 0.15, outrage: 0.399, taboo: 0.305, mad: true, extreme: true, people: 1_317_000 });
    const was = nuclearUtility({ ...i, people: 0 }) - DEAD_COST * 1.317 * (2 - 1.4);
    const u = nuclearUtility(i);
    process.stderr.write(`758 day 9178: ${was.toFixed(3)} at (2 − doctrine), ${u.toFixed(3)} now\n`);
    expect(was).toBeCloseTo(0.058, 2);
    expect(was).toBeGreaterThan(NUKE_FLOOR);
    expect(u).toBeLessThan(NUKE_FLOOR);
  });

  it('the scale is (2 − doctrine), never under 1', () => {
    for (const d of [1, 1.2, 1.4, 1.5]) expect(deadCost(1_000_000, d)).toBeCloseTo(DEAD_COST, 12);
    expect(deadCost(1_000_000, 0.65)).toBeCloseTo(DEAD_COST * 1.35, 12);
    expect(deadCost(1_000_000, 0.5)).toBeCloseTo(DEAD_COST * 1.5, 12);
    expect(deadCost(2_500_000, 1.4)).toBeCloseTo(0.25, 12);
  });

  it('the strikes back of 7.38c still over NUKE_FLOOR at the scale of 1', () => {
    // 4877, day 10612: the Soviet Union answers Germany, 2.5 million (doctrine 1.2).
    const i = inputs({ targetValue: 0.592, desperation: 0.078, doctrine: 1.2, outrage: 0.391, taboo: 0.3, mad: true, retaliating: true, retaliation: 1.4, people: 2_474_000 });
    expect(nuclearUtility(i)).toBeGreaterThan(NUKE_FLOOR);
    expect(nuclearUtility({ ...i, people: 0 }) - nuclearUtility(i)).toBeCloseTo(DEAD_COST * 2.474, 9);
  });
});
