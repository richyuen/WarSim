/** The least lightness of a sprite's tint (HSL, 0–1) for a colour of full saturation. */
export const SPRITE_LIGHT = 0.42;
/**
 * The least lightness of a grey's tint (PLAN 7.9b, critic run 7: German tanks "all one grey" on
 * the drab ground at 10 m/px). A colour with no hue is told from the ground and from another
 * nation by its lightness alone: Germany's #5d5d5d came out #6b6b6b, under a dark outline darker
 * than the ground. Measured on the critic's fight at 10 m/px (seed 7781): the pixels at the German
 * tanks' middles 79 grey, 27 under the ground and 37 from the French; at 0.62 (#9e9e9e) 90, still
 * under it; at 0.8 (#cccccc) 150, 45 over the ground and 150 from the French.
 */
export const GREY_LIGHT = 0.8;
/** Under this saturation (HSL) the least lightness rises from SPRITE_LIGHT toward GREY_LIGHT. */
export const GREY_SATURATION = 0.3;

/** The least lightness of a sprite's tint of saturation `s` (HSL, 0–1): GREY_LIGHT for a grey, SPRITE_LIGHT from GREY_SATURATION up. */
export function leastLight(s: number): number {
  return s >= GREY_SATURATION ? SPRITE_LIGHT : GREY_LIGHT + (SPRITE_LIGHT - GREY_LIGHT) * (s / GREY_SATURATION);
}

/**
 * The colour of a nation's sprites (the stand-in sprite of a formation, an element, a figure),
 * from the nation's own colour (0xRRGGBB): that colour, and a dark one made lighter up to its
 * least lightness (`leastLight`: SPRITE_LIGHT, and more for a colour near grey, PLAN 7.9b) with its
 * hue and its saturation kept.
 *
 * Until PLAN 3.11e it was every colour mixed 45% toward white, "to read against the nation's
 * fill" (the ground of T2 and T3 has been the terrain's since PLAN 2.14d): a dark red and a
 * rose came out two pale reds.
 */
export function spriteTint(own: number): number {
  const [r, g, b] = [((own >> 16) & 255) / 255, ((own >> 8) & 255) / 255, (own & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  const least = leastLight(s);
  if (light >= least) return own;
  // Its hue and saturation, at the least lightness (HSL to RGB).
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const c = (1 - Math.abs(2 * least - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = least - c / 2;
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const to = (v: number): number => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (to(r1) << 16) | (to(g1) << 8) | to(b1);
}
