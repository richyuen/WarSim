import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT_LOOK, parseUnitLook, UNIT_LOOKS } from '../../src/shared/unitLooks';

// PLAN 7.174a (ADR-777): the unit-look setting. Classic is the default until PLAN 7.174h.
describe('the unit-look setting', () => {
  it('is the default when nothing, or nothing it knows, is stored', () => {
    expect(DEFAULT_UNIT_LOOK).toBe('classic');
    for (const v of [null, undefined, '', 'Balls', 'squares']) expect(parseUnitLook(v), String(v)).toBe(DEFAULT_UNIT_LOOK);
  });

  it('keeps each look it offers', () => {
    expect(UNIT_LOOKS).toEqual(['balls', 'classic']);
    for (const v of UNIT_LOOKS) expect(parseUnitLook(v)).toBe(v);
  });
});
