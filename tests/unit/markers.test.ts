import { describe, expect, it } from 'vitest';
import { markerAlpha, strengthText, T1_MAX_M, T1_MIN_M } from '../../src/render/units/markers';

// PLAN 2.1: T1 marker layer opacity and strength labels.

describe('T1 markers (PLAN 2.1)', () => {
  it('are fully visible inside 300–2000 m/px and fade smoothly outside', () => {
    expect(markerAlpha(1000)).toBe(1);
    expect(markerAlpha(T1_MIN_M)).toBe(1);
    expect(markerAlpha(T1_MAX_M)).toBe(1);
    expect(markerAlpha(100)).toBe(0); // T2/T3
    expect(markerAlpha(5000)).toBe(0); // T0
    const a = markerAlpha(T1_MAX_M * 1.15);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    // Monotone across the fades.
    for (let m = T1_MAX_M; m < T1_MAX_M * 1.4; m += 20) expect(markerAlpha(m + 20)).toBeLessThanOrEqual(markerAlpha(m));
    for (let m = T1_MIN_M * 0.6; m < T1_MIN_M; m += 5) expect(markerAlpha(m + 5)).toBeGreaterThanOrEqual(markerAlpha(m));
  });

  it('strength text: exact under 1,000, thousands with one decimal above', () => {
    expect(strengthText(0)).toBe('0');
    expect(strengthText(999)).toBe('999');
    expect(strengthText(1000)).toBe('1.0k');
    expect(strengthText(12345)).toBe('12.3k');
    expect(strengthText(12350)).toBe('12.3k'); // toFixed rounding of 12.35
  });
});
