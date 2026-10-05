import { describe, expect, it } from 'vitest';
import { SPRITE_ALPHA_MIN, spriteAlpha } from '../../src/render/units/elementSprite';

// PLAN 2.11g: at T2 an element is one sprite. It was drawn in full until fewer than 8 units
// were left, so a battalion at a third of its men looked whole, and at T3 has a third of its
// figures (ADR-80). The sprite's opacity is now the element's share of its size.

describe('how much of an element its sprite shows at T2 (PLAN 2.11g)', () => {
  it('whole at full strength, paler with every loss, never gone while a unit is left', () => {
    for (const size of [1, 10, 12, 500]) {
      expect(spriteAlpha(size, size), `whole, of ${size}`).toBe(1);
      let before = 1;
      for (let s = size; s >= 1; s--) {
        const a = spriteAlpha(s, size);
        expect(a, `${s} of ${size}`).toBeLessThanOrEqual(before);
        expect(a, `${s} of ${size}`).toBeGreaterThanOrEqual(SPRITE_ALPHA_MIN);
        before = a;
      }
      if (size > 1) expect(spriteAlpha(1, size), `the last unit of ${size}`).toBeLessThan(SPRITE_ALPHA_MIN + 0.3);
    }
    // The share, in a straight line from the least to 1: a battalion at a third and a battery at a third look alike.
    expect(spriteAlpha(250, 500)).toBeCloseTo((1 + SPRITE_ALPHA_MIN) / 2, 12);
    expect(spriteAlpha(4, 12)).toBeCloseTo(spriteAlpha(167, 500), 2);
    // A third of a battalion is told from a whole one at a glance: a quarter of the opacity less, and more.
    expect(spriteAlpha(500, 500) - spriteAlpha(167, 500)).toBeGreaterThan(0.25);
    // Until this task: whole down to 8 units (0.55 + 0.45 × min(1, strength ÷ 8)): 167 of 500 drew as 500.
    expect(spriteAlpha(167, 500)).toBeLessThan(0.75);
    expect(SPRITE_ALPHA_MIN).toBeGreaterThanOrEqual(0.4);
  });

  it('more than whole, or a size that is not known, is whole', () => {
    expect(spriteAlpha(600, 500)).toBe(1);
    expect(spriteAlpha(7, 0)).toBe(1);
    expect(spriteAlpha(0, 500)).toBe(SPRITE_ALPHA_MIN);
  });
});
