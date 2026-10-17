import { describe, expect, it } from 'vitest';
import { RUIN_AGED, ruinShare } from '../../src/render/fx/ruins';

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
