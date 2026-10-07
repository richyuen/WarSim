import { describe, expect, it } from 'vitest';
import { SMALL_FULL_PX, SMALL_NONE_PX, smallShare, SPRITE_ALPHA_MIN, spriteAlpha } from '../../src/render/units/elementSprite';

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

// PLAN 3.6e3b (ADR-165): a tank's small mark where a sprite is too small for a hull, and the hull
// as the sprite grows. The share is a matter of the sprite's size alone, so a zoom cannot pop.
describe('the share of the small mark by the size of the sprite (PLAN 3.6e3b)', () => {
  /** The side of an element sprite of the 1938 world at `m` metres a pixel, CSS px (ADR-164: 5.09 at 100 m/px, at least 5). */
  const px = (m: number): number => Math.max(5, 508.8 / m);

  it('all mark at the least size, all hull at 60 m/px, and at neither end by a hair', () => {
    for (const m of [3000, 300, 200, 150, 102, 100]) expect(smallShare(px(m)), `${m} m/px`).toBe(1);
    for (const m of [60, 40, 20, 4]) expect(smallShare(px(m)), `${m} m/px`).toBe(0);
    expect(smallShare(SMALL_FULL_PX)).toBe(1);
    expect(smallShare(SMALL_NONE_PX)).toBe(0);
    // The least size is inside the mark's end with room for the size setting's rounding, and
    // `turrets1938.spec.ts` counts whole turrets at 60 m/px (8.48 px).
    expect(SMALL_FULL_PX).toBeGreaterThan(5.2);
    expect(SMALL_NONE_PX).toBeLessThan(8.4);
  });

  it('between, it falls as the sprite grows, without a step', () => {
    let before = 1;
    for (let p = SMALL_FULL_PX; p <= SMALL_NONE_PX; p += 0.01) {
      const s = smallShare(p);
      expect(s, `${p} px`).toBeLessThanOrEqual(before);
      expect(before - s, `${p} px`).toBeLessThan(0.01);
      before = s;
    }
    expect(before).toBeLessThan(0.001);
    expect(smallShare((SMALL_FULL_PX + SMALL_NONE_PX) / 2)).toBeCloseTo(0.5, 12);
  });

  it('is of the sprite as drawn: a larger size setting has the hull sooner, a smaller one later', () => {
    // 100 m/px: 5.09 px at the default, the mark; twice the size is over the band, the hull.
    expect(smallShare(px(100) * 2)).toBe(0);
    // 60 m/px at half the size is 4.2 px: the mark.
    expect(smallShare(px(60) * 0.5)).toBe(1);
  });
});
