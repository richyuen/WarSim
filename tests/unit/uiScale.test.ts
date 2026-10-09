import { describe, expect, it } from 'vitest';
import { appliedUiScale, LEAST_VIEW_REM, offeredUiScales, UI_SCALES } from '../../src/app/settings';

// PLAN 3.12Rh4 (ADR-220): a UI size is offered where the view is as wide as the least view at
// that size, and the size in use is the largest offered that is no larger than the one chosen.
describe('the UI sizes a view is laid out for', () => {
  it('offers a size from its least view on', () => {
    for (const s of UI_SCALES) {
      const least = Math.ceil(LEAST_VIEW_REM * 16 * s);
      expect(offeredUiScales(least), `${s} at ${least}`).toContain(s);
      // The smallest is the size of a view narrower than its own least view too (the third test).
      if (s !== UI_SCALES[0]) expect(offeredUiScales(least - 1), `${s} at ${least - 1}`).not.toContain(s);
    }
    expect(offeredUiScales(1100)).toEqual([0.85, 1]);
    expect(offeredUiScales(1200)).toEqual([0.85, 1, 1.15]);
    expect(offeredUiScales(1400)).toEqual([0.85, 1, 1.15, 1.3]);
  });

  it('uses the largest offered size that is no larger than the one chosen', () => {
    expect(appliedUiScale(1.3, 1400)).toBe(1.3);
    expect(appliedUiScale(1.3, 1200)).toBe(1.15);
    expect(appliedUiScale(1.3, 1100)).toBe(1);
    expect(appliedUiScale(1.15, 1100)).toBe(1);
    expect(appliedUiScale(0.85, 1400)).toBe(0.85);
    expect(appliedUiScale(1, 1000)).toBe(0.85);
  });

  it('has the smallest size in a view narrower than every least view', () => {
    expect(offeredUiScales(600)).toEqual([0.85]);
    expect(appliedUiScale(1.3, 600)).toBe(0.85);
    expect(appliedUiScale(0.85, 600)).toBe(0.85);
  });
});
