/**
 * T2: how much of an element its sprite shows (PLAN 2.11g).
 *
 * An element is one sprite at T2, whatever it has lost. Its opacity is its share of its size,
 * in a straight line from SPRITE_ALPHA_MIN to 1: a battalion at a third of its men is paler
 * than a whole one, as at T3 it has a third of its figures (ADR-80), and it is never gone
 * while it has a unit. (Until this task a sprite was whole down to 8 units.)
 */

/**
 * The small mark's band (PLAN 3.6e3b, ADR-165), by the side of a sprite as it is drawn, CSS px:
 * at SMALL_FULL_PX and under, a frame that has a small one (`smallFrameOf`: a tank's hull) is
 * that; at SMALL_NONE_PX and over it is itself; between, the two are mixed. At the default size
 * setting that is from about 92 to 64 m/px: the least size (5 px, from 102 m/px outward) is all
 * mark, and at 60 m/px (8.5 px) a hull is all hull.
 */
export const SMALL_FULL_PX = 5.5;
export const SMALL_NONE_PX = 8;

/** The small frame's share of a sprite drawn `px` CSS px wide, 0–1: a matter of the zoom alone, not of time. */
export function smallShare(px: number): number {
  const p = Math.min(1, Math.max(0, (SMALL_NONE_PX - px) / (SMALL_NONE_PX - SMALL_FULL_PX)));
  return p * p * (3 - 2 * p);
}

/** The opacity of the sprite of an element that has all but nothing left. */
export const SPRITE_ALPHA_MIN = 0.45;

/** The opacity of the sprite of an element that has `strength` of the `size` units it has when whole. */
export function spriteAlpha(strength: number, size: number): number {
  if (size <= 0) return 1; // a size that is not known: as a whole one
  const share = Math.min(1, Math.max(0, strength / size));
  return SPRITE_ALPHA_MIN + (1 - SPRITE_ALPHA_MIN) * share;
}
