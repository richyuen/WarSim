/**
 * T2: how much of an element its sprite shows (PLAN 2.11g).
 *
 * An element is one sprite at T2, whatever it has lost. Its opacity is its share of its size,
 * in a straight line from SPRITE_ALPHA_MIN to 1: a battalion at a third of its men is paler
 * than a whole one, as at T3 it has a third of its figures (ADR-80), and it is never gone
 * while it has a unit. (Until this task a sprite was whole down to 8 units.)
 */

/** The opacity of the sprite of an element that has all but nothing left. */
export const SPRITE_ALPHA_MIN = 0.45;

/** The opacity of the sprite of an element that has `strength` of the `size` units it has when whole. */
export function spriteAlpha(strength: number, size: number): number {
  if (size <= 0) return 1; // a size that is not known: as a whole one
  const share = Math.min(1, Math.max(0, strength / size));
  return SPRITE_ALPHA_MIN + (1 - SPRITE_ALPHA_MIN) * share;
}
