import { describe, expect, it } from 'vitest';
import { SEA_DEEP, SEA_DEPTH_FULL, SEA_SHALLOW, seaShade } from '../../src/render/map/ground';

// PLAN 4.7f: the sea at T2 and T3 by its depth: lighter over shallows, darker over the deep.

describe('the sea by its depth (PLAN 4.7f)', () => {
  it('from the shallows\' light to the deep\'s dark, never lighter for deeper water', () => {
    expect(seaShade(0)).toBe(SEA_SHALLOW);
    expect(seaShade(-50)).toBe(SEA_SHALLOW); // land, or a polder below the sea: none deeper than 0
    expect(seaShade(SEA_DEPTH_FULL)).toBeCloseTo(SEA_DEEP, 12);
    expect(seaShade(11_000)).toBeCloseTo(SEA_DEEP, 12);
    let last = Infinity;
    for (let d = 0; d <= 8000; d += 10) {
      expect(seaShade(d)).toBeLessThanOrEqual(last);
      last = seaShade(d);
    }
    // A shelf (40 m) reads lighter than the sea's colour, an ocean basin (4,000 m) darker.
    expect(seaShade(40)).toBeGreaterThan(1.1);
    expect(seaShade(4000)).toBeLessThan(0.8);
  });
});
