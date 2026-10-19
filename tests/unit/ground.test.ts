import { describe, expect, it } from 'vitest';
import { BORDER_BAND, BORDER_CAST, GROUND, GROUND_CAST, GROUND_CLASSES, GROUND_FULL_M, GROUND_NONE_M, groundShareAt, groundUniform, HATCH_AT_GROUND, OCCUPIED_CAST } from '../../src/render/map/ground';
import { Terrain } from '../../src/shared/terrain';
import { T1_MIN_M } from '../../src/render/units/markers';

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

// PLAN 7.34a (critic R9, ADR-532): the map's T1 → T2 change was a hard cut, one step of the
// critic's wheel (412 to 264 m/px) going from the flat fill to the ground in full, for the ground
// came in with the sprites' share of the handover. It is a blend by the zoom now, the same in
// and out; beyond T2 it still goes with the zoom (PLAN 2.11l), from 750 m/px on none of it.
describe('the ground of T2 comes and goes with the zoom (PLAN 7.34a)', () => {
  it("none from 750 m/px out, all of it from 300 in (T2's edge), and between less the further out", () => {
    expect(GROUND_FULL_M).toBe(T1_MIN_M);
    for (const m of [1, 30, 264, 299.9, 300]) expect(groundShareAt(m), `${m} m/px`).toBe(1);
    for (const m of [750, 751, 2000, 5000, 28_000]) expect(groundShareAt(m), `${m} m/px`).toBe(0);
    let before = 1;
    for (let m = 300; m <= 750; m += 1) {
      const r = groundShareAt(m);
      expect(r, `${m} m/px`).toBeLessThanOrEqual(before);
      // A percent of zoom never takes more than a fortieth of the ground away.
      expect(before - r, `${m} m/px`).toBeLessThan(0.025);
      before = r;
    }
    expect(groundShareAt(Math.sqrt(GROUND_FULL_M * GROUND_NONE_M))).toBeCloseTo(0.5, 6); // the middle of the band, in the log
  });

  it("a step of the critic's wheel (1.5625×) changes it by at most a half, wherever the step falls", () => {
    let largest = 0;
    for (let m = 100; m < 2000; m *= 1.001) largest = Math.max(largest, Math.abs(groundShareAt(m) - groundShareAt(m * 1.5625)));
    expect(largest).toBeLessThanOrEqual(0.5);
    // The critic's own steps (6,000 m/px over 1.5625^i): 644, 412 and 264 m/px.
    const sheet = [5, 6, 7].map((i) => groundShareAt(6000 / Math.pow(1.5625, i)));
    expect(sheet[0]).toBeGreaterThan(0);
    expect(sheet[1]).toBeGreaterThan(sheet[0]!);
    expect(sheet[1]).toBeLessThan(1);
    expect(sheet[2]).toBe(1);
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