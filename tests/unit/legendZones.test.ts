import { describe, expect, it } from 'vitest';
import { zonesOf } from '../../src/ui/legendText';

// PLAN 7.8 (critic run 7): the air mode's legend said "Germany: 1 zones".
describe("the sea and air legends' zone counts (PLAN 7.8)", () => {
  it('one zone is "1 zone", more are "zones"', () => {
    expect(zonesOf('Germany', 1)).toBe('Germany: 1 zone');
    expect(zonesOf('Germany', 7)).toBe('Germany: 7 zones');
    expect(zonesOf(null, 1)).toBe('Contested: 1 zone');
    expect(zonesOf(null, 3)).toBe('Contested: 3 zones');
  });
});
