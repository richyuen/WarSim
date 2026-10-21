import { describe, expect, it } from 'vitest';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { GREY_LIGHT, hueOf, leastLight, SEA_COLOR, SEA_HUE, SEA_HUE_FAR, SEA_HUE_NEAR, SHIP_SEA_LIGHT, shipTint, SPRITE_LIGHT, spriteTint } from '../../src/render/units/tint';

// PLAN 3.11e (the critic's R3-B3: "Soviet tanks are tinted pink, near Poland's own pink",
// `critic/shots/c3j_12_tank_live_006m_2.png`): a sprite's tint was its nation's colour mixed
// 45% toward white. The Soviet Union's dark red (143, 29, 29) came out (194, 131, 131), a pale
// red beside Poland's (226, 157, 169). The tint is now the nation's colour, made lighter only
// where it is dark, with its hue and its saturation kept.

type Rgb = [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const own = (tag: string): number => parseInt(NATIONS_1938.find((n) => n.tag === tag)!.color.slice(1), 16);
const apart = (a: number, b: number): number => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));

/** Hue (degrees), saturation and lightness of a colour (HSL). */
function hsl(c: number): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(c).map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

describe('the tint of a nation\'s sprites', () => {
  it('the Soviet Union\'s keeps its hue and its saturation', () => {
    const [from, to] = [hsl(own('SOV')), hsl(spriteTint(own('SOV')))];
    expect(Math.abs(to.h - from.h)).toBeLessThan(2);
    // Before: 0.66 of the colour, 0.34 of the tint.
    expect(to.s).toBeGreaterThan(from.s - 0.03);
  });

  it('a nation light enough keeps its colour', () => {
    for (const tag of ['POL', 'ROM', 'JAP', 'FIN']) expect(spriteTint(own(tag)), tag).toBe(own(tag));
  });

  it('no nation\'s tint is darker than the least a sprite needs, and none is changed but in lightness', () => {
    for (const n of NATIONS_1938) {
      const c = parseInt(n.color.slice(1), 16);
      const [from, to] = [hsl(c), hsl(spriteTint(c))];
      expect(to.l, n.tag).toBeGreaterThan(SPRITE_LIGHT - 0.005);
      if (from.s > 0.05) expect(Math.abs(to.h - from.h), n.tag).toBeLessThan(3);
      expect(Math.abs(to.s - from.s), n.tag).toBeLessThan(0.03);
    }
  });

  it('the Soviet Union\'s and Poland\'s are further apart than they were, and Germany\'s and Poland\'s as far as before', () => {
    // Before: 56 and 61 apart in RGB.
    expect(apart(spriteTint(own('SOV')), spriteTint(own('POL')))).toBeGreaterThan(75);
    expect(apart(spriteTint(own('GER')), spriteTint(own('POL')))).toBeGreaterThan(61);
    // The Soviet red stays darker than Poland's: the lightness is half of what tells the two.
    expect(hsl(spriteTint(own('SOV'))).l).toBeLessThan(hsl(spriteTint(own('POL'))).l - 0.1);
  });

  // PLAN 7.9b (critic run 7, German tanks "all one grey"): a colour near grey is lighter, to GREY_LIGHT for a grey.
  it("a grey's tint is light: Germany's at GREY_LIGHT; a colour of full saturation as before", () => {
    expect(leastLight(0)).toBe(GREY_LIGHT);
    expect(leastLight(1)).toBe(SPRITE_LIGHT);
    expect(hsl(spriteTint(own('GER'))).l).toBeGreaterThanOrEqual(GREY_LIGHT - 0.005);
    expect(hsl(spriteTint(own('GER'))).s).toBeLessThan(0.01);
    // Germany's from Poland's and from France's by more than before (61 and the French 47 apart).
    expect(apart(spriteTint(own('GER')), spriteTint(own('FRA')))).toBeGreaterThan(120);
  });
});

// PLAN 7.41b (critic run 11, naval 7; ADR-602): at 20 m/px a ship's middle is its grey marks and its
// hull's fill mixed, and a blue hull at SPRITE_LIGHT mixed with them was the shelf sea's colour
// (France's battleship 13 from it, summed RGB). A ship of a hue near the sea's is lighter.
describe("the tint of a nation's ships", () => {
  it("the sea's hue is the map's sea", () => {
    expect(SEA_HUE).toBeCloseTo(hsl(SEA_COLOR).h, 6);
    expect(Math.round(SEA_HUE)).toBe(215);
  });

  it("France's is lighter than its sprites', to SHIP_SEA_LIGHT, its hue and saturation kept", () => {
    const [sprite, ship] = [hsl(spriteTint(own('FRA'))), hsl(shipTint(own('FRA')))];
    expect(sprite.l).toBeLessThan(SHIP_SEA_LIGHT - 0.1);
    expect(ship.l).toBeGreaterThan(SHIP_SEA_LIGHT - 0.005);
    expect(Math.abs(ship.h - sprite.h)).toBeLessThan(3);
    expect(Math.abs(ship.s - sprite.s)).toBeLessThan(0.03);
  });

  it("a hue far from the sea's and a grey are as their sprites'", () => {
    for (const tag of ['ENG', 'SOV', 'GER', 'ITA', 'JAP']) expect(shipTint(own(tag)), tag).toBe(spriteTint(own(tag)));
  });

  it("no nation's ship is darker than its sprites', and every one near the sea's hue is at least SHIP_SEA_LIGHT", () => {
    for (const n of NATIONS_1938) {
      const c = parseInt(n.color.slice(1), 16);
      const [sprite, ship] = [hsl(spriteTint(c)), hsl(shipTint(c))];
      expect(ship.l, n.tag).toBeGreaterThan(sprite.l - 0.005);
      const off = Math.abs(((hueOf(spriteTint(c)) - SEA_HUE + 540) % 360) - 180);
      if (sprite.s >= 0.3 && off <= SEA_HUE_NEAR) expect(ship.l, n.tag).toBeGreaterThan(SHIP_SEA_LIGHT - 0.005);
      if (off >= SEA_HUE_FAR) expect(shipTint(c), n.tag).toBe(spriteTint(c));
    }
  });
});
