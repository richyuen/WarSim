import { describe, expect, it } from 'vitest';
import { THERMO_YIELD } from '../../src/shared/nuclear';
import { RUIN_AGED, ruinScale, ruinShare } from '../../src/render/fx/ruins';

// PLAN 7.11b: a struck city's ruin fades with the burst's age, to RUIN_AGED of itself at a year
// (the sim forgets a burst then, PLAN 7.6e).
describe("a ruin's darkness by its age (PLAN 7.11b)", () => {
  it('whole when fresh, RUIN_AGED at a year, falling between, never more nor less', () => {
    expect(ruinShare(0)).toBe(1);
    expect(ruinShare(365)).toBeCloseTo(RUIN_AGED, 12);
    expect(ruinShare(800)).toBeCloseTo(RUIN_AGED, 12);
    expect(ruinShare(-3)).toBe(1);
    expect(ruinShare(100)).toBeGreaterThan(ruinShare(200));
  });
});

// PLAN 7.20 (critic R8-B3: a hydrogen bomb's ruin could not be told from an atomic one's at 300 m/px):
// a ruin is as wide as its bomb's blast, the yield's cube root times a fission one's.
describe("a ruin's size by its bomb (PLAN 7.20)", () => {
  it("a fission bomb's at 1, a thermonuclear one's the cube root of THERMO_YIELD", () => {
    expect(ruinScale(1)).toBe(1);
    expect(ruinScale(2)).toBeCloseTo(Math.cbrt(THERMO_YIELD), 12);
    expect(ruinScale(2)).toBeGreaterThan(2.5);
  });
});
