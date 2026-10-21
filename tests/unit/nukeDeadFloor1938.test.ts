import { describe, expect, it } from 'vitest';
import { DEAD_COST, DEAD_FLOOR, deadCost, NUKE_FLOOR, nuclearUtility, strikeFloor, type NukeInputs } from '../../src/sim/systems/nuclear';

// PLAN 7.50a (critic R11-B2). On the critic's seed 1129, 14 March 1954, the Soviet Union H-bombed
// Greenock for 1,105,514 dead at a utility of 0.026: in extreme desperation under MAD its gain was
// 1.771 and its costs 1.744, the million dead 0.107 of them (`docs/evidence/7.50/measure.md`). The
// floor a strike passes now rises with the people it is expected to kill, to 0.1 at a million.

/** A decision's inputs as `tools/diag/nukeToll.ts` read them. */
function inputs(u: Partial<NukeInputs>): NukeInputs {
  return { targetValue: 1, through: 1, people: 0, desperation: 1, doctrine: 1, retaliation: 0, allianceCost: 0, outrage: 0.1, taboo: 1, mad: false, extreme: false, retaliating: false, ...u };
}

// 1129, day 5916, as weighed: the Soviet Union (doctrine 1.2, 5 or more enemy warheads at doctrine
// 1.4), by missile, the thermonuclear yield's value 1 (capped) and 1,071,000 people, the fission
// yield's 0.645 and 1,000.
const greenock = inputs({ desperation: 1.476, doctrine: 1.2, retaliation: 1.4, allianceCost: 0.025, outrage: 0.397, taboo: 0.317, mad: true, extreme: true, people: 1_071_000 });
const greenockFission = { ...greenock, targetValue: 0.645, people: 1_000 };

describe("the dead's floor (PLAN 7.50a)", () => {
  it('1129, day 5916: Greenock over NUKE_FLOOR, under the floor of its million dead, at either yield', () => {
    const u = nuclearUtility(greenock);
    const uf = nuclearUtility(greenockFission);
    process.stderr.write(`Greenock: ${u.toFixed(3)} thermonuclear (floor ${strikeFloor(greenock.people, 1)}), ${uf.toFixed(3)} fission\n`);
    expect(u).toBeCloseTo(0.026, 2);
    expect(u).toBeGreaterThan(NUKE_FLOOR);
    expect(u).toBeLessThan(strikeFloor(greenock.people, greenock.through));
    expect(uf).toBeLessThan(strikeFloor(greenockFission.people, greenockFission.through));
  });

  it('rises with the expected dead from NUKE_FLOOR to DEAD_FLOOR at a million, and no further', () => {
    expect(strikeFloor(0, 1)).toBe(NUKE_FLOOR);
    expect(strikeFloor(100_000, 1)).toBe(NUKE_FLOOR);
    expect(strikeFloor(500_000, 1)).toBeCloseTo(0.05, 12);
    expect(strikeFloor(1_000_000, 1)).toBeCloseTo(DEAD_FLOOR, 12);
    expect(strikeFloor(3_000_000, 1)).toBeCloseTo(DEAD_FLOOR, 12);
    // The dead are expected as the warhead gets there: × the chance through.
    expect(strikeFloor(1_000_000, 0.5)).toBeCloseTo(0.05, 12);
    expect(DEAD_FLOOR).toBe(0.1);
  });

  it("the strike back ADR-572 kept still passes: 2.5 million at 0.237, the dead's cost in it", () => {
    // 4877, day 10612: the Soviet Union answers Germany (PLAN 7.38c, `nukeDeadCostFloor1938.test.ts`).
    const i = inputs({ targetValue: 0.592, desperation: 0.078, doctrine: 1.2, outrage: 0.391, taboo: 0.3, mad: true, retaliating: true, retaliation: 1.4, people: 2_474_000 });
    const u = nuclearUtility(i);
    expect(u).toBeGreaterThan(strikeFloor(i.people, i.through));
    // A floor of the dead's whole cost again would have sunk it.
    expect(u).toBeLessThan(deadCost(i.people, i.doctrine));
    expect(deadCost(1_000_000, 1)).toBeCloseTo(DEAD_COST, 12);
  });
});
