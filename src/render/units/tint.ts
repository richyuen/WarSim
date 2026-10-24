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
/**
 * Terrain whose colour is lighter than this (luma, 0–255) is a light ground (ADR-676): plains (165),
 * grassland, hills, mountains, desert, tundra, marsh (131), urban (140), ice. A grey lifted to GREY_LIGHT is shaded to some 150 at a
 * tank's middle, 45 over a forest (109) but under a plain's drawn ground (seed 7781, day 4: 149
 * against 156). On a light ground a grey is made dark instead (`GREY_DARK`). Forest (109) is the
 * dark ground.
 */
export const LIGHT_GROUND_LUMA = 125;

/** Whether a terrain colour (0xRRGGBB) is a light ground for a grey's tint (`LIGHT_GROUND_LUMA`). */
export function isLightGround(color: number): boolean {
  return 0.2126 * ((color >> 16) & 255) + 0.7152 * ((color >> 8) & 255) + 0.0722 * (color & 255) > LIGHT_GROUND_LUMA;
}

/**
 * The lightness of a grey's tint on a light ground (ADR-676): #2e2e2e. At SPRITE_LIGHT (#6b6b6b)
 * German men at 25 m/px, mixed with the plain under them, came out 40 from the Polish (seed 6047,
 * `infantryRanks1938`, the bar 60).
 */
export const GREY_DARK = 0.18;

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
 *
 * On a light ground (`lightGround`, ADR-676) a grey is made dark, to GREY_DARK and up to
 * SPRITE_LIGHT as its saturation nears GREY_SATURATION: a light grey is told from a dark ground, a
 * dark one from a light ground. A colour of more saturation is the same on either.
 */
export function spriteTint(own: number, lightGround = false): number {
  const [r, g, b] = [((own >> 16) & 255) / 255, ((own >> 8) & 255) / 255, (own & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  const grey = lightGround && s < GREY_SATURATION;
  const least = grey ? GREY_DARK + (SPRITE_LIGHT - GREY_DARK) * (s / GREY_SATURATION) : leastLight(s);
  if (light >= least && !grey) return own;
  // Its hue and saturation, at the least lightness (HSL to RGB).
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const c = (1 - Math.abs(2 * least - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = least - c / 2;
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const to = (v: number): number => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (to(r1) << 16) | (to(g1) << 8) | to(b1);
}

/** The sea's colour on the map (palette entry 0). */
export const SEA_COLOR = 0x1d3557;
/** The sea's hue, degrees (HSL): 215. */
export const SEA_HUE = hueOf(SEA_COLOR);
/**
 * The least lightness of a ship's tint whose hue is the sea's (PLAN 7.41b, ADR-602): at 20 m/px a
 * ship is some 20 px long, its middle its grey marks and its hull's fill mixed, and a blue hull of
 * SPRITE_LIGHT mixed with them is the shelf sea's colour (France's battleship 13 from it, summed
 * RGB, the bar 40).
 */
export const SHIP_SEA_LIGHT = 0.6;
/** Within this many degrees of the sea's hue a ship's least lightness is SHIP_SEA_LIGHT… */
export const SEA_HUE_NEAR = 25;
/** …and from there it falls to SPRITE_LIGHT's at this many. */
export const SEA_HUE_FAR = 50;

/** The hue of a colour (0xRRGGBB), degrees, HSL; 0 for a grey. */
export function hueOf(c: number): number {
  const [r, g, b] = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/**
 * The colour of a nation's ships (PLAN 7.41b): its sprites' (`spriteTint`), and one of a hue near
 * the sea's made lighter, to SHIP_SEA_LIGHT within SEA_HUE_NEAR of it, its hue and saturation
 * kept. A grey is told from the sea by its hue already.
 */
export function shipTint(own: number): number {
  const t = spriteTint(own);
  const [r, g, b] = [((t >> 16) & 255) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return t;
  const light = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * light - 1));
  if (s < GREY_SATURATION) return t;
  const off = Math.abs(((hueOf(t) - SEA_HUE + 540) % 360) - 180);
  const near = Math.min(1, Math.max(0, (SEA_HUE_FAR - off) / (SEA_HUE_FAR - SEA_HUE_NEAR)));
  const least = SPRITE_LIGHT + (SHIP_SEA_LIGHT - SPRITE_LIGHT) * near;
  return light >= least ? t : withLight(t, least);
}

/** Colour `c` (0xRRGGBB) at lightness `l` (HSL), its hue and saturation kept. */
function withLight(c: number, l: number): number {
  const [r, g, b] = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  const h = hueOf(c) / 60;
  const ch = (1 - Math.abs(2 * l - 1)) * s;
  const x = ch * (1 - Math.abs((h % 2) - 1));
  const m = l - ch / 2;
  const [r1, g1, b1] = h < 1 ? [ch, x, 0] : h < 2 ? [x, ch, 0] : h < 3 ? [0, ch, x] : h < 4 ? [0, x, ch] : h < 5 ? [x, 0, ch] : [ch, 0, x];
  const to = (v: number): number => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (to(r1) << 16) | (to(g1) << 8) | to(b1);
}
