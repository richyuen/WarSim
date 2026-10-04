import { describe, expect, it } from 'vitest';
import { strengthText } from '../../src/render/units/markers';

// PLAN 2.1: the T1 markers' strength labels. The layer's opacity is the business of the two
// handovers at its edges (PLAN 1.45a toward T0, PLAN 2.7b toward T2: tests/unit/handover.test.ts).
// The fades by zoom that this file used to check are gone: a camera resting inside one showed
// two layers half-faded.

describe('T1 markers (PLAN 2.1)', () => {
  it('strength text: exact under 1,000, thousands with one decimal above', () => {
    expect(strengthText(0)).toBe('0');
    expect(strengthText(999)).toBe('999');
    expect(strengthText(1000)).toBe('1.0k');
    expect(strengthText(12345)).toBe('12.3k');
    expect(strengthText(12350)).toBe('12.3k'); // toFixed rounding of 12.35
    // From a million on: millions with two decimals (a folded counter over Europe holds 1.5 M men).
    expect(strengthText(999_949)).toBe('999.9k');
    expect(strengthText(999_950)).toBe('1.00M');
    expect(strengthText(1_476_400)).toBe('1.48M');
    expect(strengthText(24_726_000)).toBe('24.73M');
  });
});
