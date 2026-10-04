import { describe, expect, it } from 'vitest';
import { markerLowFade, strengthText, T1_MAX_M, T1_MIN_M } from '../../src/render/units/markers';

// PLAN 2.1: T1 marker layer opacity and strength labels. Toward T0 the opacity is the timed
// handover's (PLAN 1.45a, tests/unit/handover.test.ts): the fade by zoom over 2000–2600 m/px that
// this test used to check is gone, because a camera resting there showed both layers half-faded.

describe('T1 markers (PLAN 2.1)', () => {
  it('are fully visible from 300 m/px up and fade smoothly below, toward T2', () => {
    expect(markerLowFade(1000)).toBe(1);
    expect(markerLowFade(T1_MIN_M)).toBe(1);
    expect(markerLowFade(T1_MAX_M)).toBe(1);
    expect(markerLowFade(100)).toBe(0); // T2/T3
    // Zoom alone does not fade them toward T0 any more.
    expect(markerLowFade(T1_MAX_M * 1.15)).toBe(1);
    expect(markerLowFade(5000)).toBe(1);
    const a = markerLowFade(T1_MIN_M * 0.85);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    // Monotone across the fade.
    for (let m = T1_MIN_M * 0.6; m < T1_MIN_M; m += 5) expect(markerLowFade(m + 5)).toBeGreaterThanOrEqual(markerLowFade(m));
  });

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
