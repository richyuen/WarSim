import { describe, expect, it } from 'vitest';
import { BORDER_BAND, BORDER_CAST, GROUND, GROUND_CAST, GROUND_CLASSES, groundReach, groundUniform, HATCH_AT_GROUND, OCCUPIED_CAST } from '../../src/render/map/ground';
import { Terrain } from '../../src/shared/terrain';

// PLAN 2.8b: the ground of each terrain class at T2 and T3 (how the map pass's noise is laid on
// a fill).
describe('the ground by terrain class (PLAN 2.8b)', () => {
  it('every terrain class has a ground, and the shader gets them in the order of their numbers', () => {
    const ids = Object.values(Terrain);
    expect(ids.length).toBe(GROUND_CLASSES);
    for (const t of ids) expect(GROUND[t], `terrain class ${t}`).toBeDefined();
    const u = groundUniform();
    expect(u.length).toBe(GROUND_CLASSES * 3);
    for (const t of ids) expect([u[t * 3], u[t * 3 + 1], u[t * 3 + 2]]).toEqual([GROUND[t]!.bump, GROUND[t]!.grain, GROUND[t]!.shade].map(Math.fround));
  });

  it('the small relief is large in mountains, less in hills, faint on plains; water is level', () => {
    const bump = (t: number): number => GROUND[t]!.bump;
    expect(bump(Terrain.Mountains)).toBe(1);
    expect(bump(Terrain.Hills)).toBeLessThan(bump(Terrain.Mountains));
    expect(bump(Terrain.Forest)).toBeLessThan(bump(Terrain.Hills));
    for (const flat of [Terrain.Plains, Terrain.Grassland, Terrain.Marsh, Terrain.Urban]) expect(bump(flat), `class ${flat}`).toBeLessThan(0.2);
    expect(bump(Terrain.Water)).toBeLessThanOrEqual(bump(Terrain.Plains));
  });

  it('a fill keeps its colour: no ground darkens or lightens it by more than a tenth, or varies it by more than an eighth', () => {
    for (const t of Object.values(Terrain)) {
      const g = GROUND[t]!;
      expect(g.shade, `class ${t}`).toBeGreaterThanOrEqual(0.9);
      expect(g.shade, `class ${t}`).toBeLessThanOrEqual(1.1);
      expect(g.grain, `class ${t}`).toBeGreaterThan(0);
      expect(g.grain, `class ${t}`).toBeLessThanOrEqual(0.125);
      expect(g.bump, `class ${t}`).toBeGreaterThan(0);
    }
  });
});

// PLAN 2.11l: leaving T2 the ground's share is a matter of time (220 ms in full, then a fade of
// 250 ms), while the camera can be far out within a tenth of a second. The ground and what
// stands on it are made for T2 and T3: beyond the zoom at which T2 is left they go with the zoom.
describe('how far out the ground reaches (PLAN 2.11l)', () => {
  it('all of it up to the zoom at which T2 is left, none an octave beyond, and smoothly between', () => {
    const OUT = 345;
    for (const m of [1, 30, 300, 344.9, 345]) expect(groundReach(m, OUT), `${m} m/px`).toBe(1);
    for (const m of [690, 691, 2000, 5000, 28_000]) expect(groundReach(m, OUT), `${m} m/px`).toBe(0);
    let before = 1;
    for (let m = 345; m <= 690; m += 1) {
      const r = groundReach(m, OUT);
      expect(r, `${m} m/px`).toBeLessThanOrEqual(before);
      // A percent of zoom never takes more than a twentieth of the ground away.
      expect(before - r, `${m} m/px`).toBeLessThan(0.05);
      before = r;
    }
    expect(groundReach(488, OUT)).toBeCloseTo(0.5, 1); // half an octave out
  });
});

describe('the fill as a cast on the terrain\'s colour (PLAN 2.14d)', () => {
  it('slight inland, strong at a border, between the two on occupied land; and an eighth of the hatching is left in the picture', () => {
    expect(GROUND_CAST).toBeGreaterThan(0.05); // a view with no border in it still has its nation's cast
    expect(GROUND_CAST).toBeLessThan(0.2); // and one terrain on two nations' land is nearly one colour
    expect(BORDER_CAST).toBeGreaterThan(0.5); // at a border the fills meet as fills
    expect(OCCUPIED_CAST).toBeGreaterThan(GROUND_CAST * 2);
    expect(OCCUPIED_CAST).toBeLessThan(BORDER_CAST);
    expect(BORDER_BAND).toBeGreaterThan(0);
    expect(BORDER_BAND).toBeLessThanOrEqual(1);
    // The shader keeps HATCH_AT_GROUND / OCCUPIED_CAST of the stripes in the fill, of which OCCUPIED_CAST shows.
    expect(HATCH_AT_GROUND / OCCUPIED_CAST).toBeLessThan(1);
  });
});