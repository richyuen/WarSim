import { describe, expect, it } from 'vitest';
import { GROUND, GROUND_CLASSES, groundUniform } from '../../src/render/map/ground';
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
