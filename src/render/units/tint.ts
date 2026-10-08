/** The least lightness of a sprite's tint (HSL, 0–1; no more than a half: see `spriteTint`). */
export const SPRITE_LIGHT = 0.42;

/**
 * The colour of a nation's sprites (the stand-in sprite of a formation, an element, a figure),
 * from the nation's own colour (0xRRGGBB): that colour, and a dark one made lighter up to
 * `SPRITE_LIGHT` with its hue and its saturation kept. Up to a lightness of a half that is
 * every channel times one factor.
 *
 * Until PLAN 3.11e it was every colour mixed 45% toward white, "to read against the nation's
 * fill" (the ground of T2 and T3 has been the terrain's since PLAN 2.14d): a dark red and a
 * rose came out two pale reds.
 */
export function spriteTint(own: number): number {
  const [r, g, b] = [(own >> 16) & 255, (own >> 8) & 255, own & 255];
  const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
  if (light >= SPRITE_LIGHT) return own;
  // Black has no hue to keep: a grey of that lightness.
  if (light === 0) return Math.round(SPRITE_LIGHT * 255) * 0x010101;
  const k = SPRITE_LIGHT / light;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}
