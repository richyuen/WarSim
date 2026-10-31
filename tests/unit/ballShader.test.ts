import { describe, expect, it } from 'vitest';
import { ATLAS_FRAMES } from '../../src/render/units/atlas';
import { BALL_QUAD, BALL_QUAD_MAX, BALL_R, BallClass, ballClassOf, GUN_BARREL, GUN_WHEEL, HELMET_AT, HELMET_BRIM_X, HELMET_R, propPoint, SHIP_HULL, TREADS, TURRET_BARREL_HALF, TURRET_BARREL_LEN, WINGS } from '../../src/render/units/ballShader';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';

// PLAN 7.174d (ADR-777): what each frame's ball wears, and a quad that holds it.

describe('the countryballs\' props (PLAN 7.174d)', () => {
  it('gives every frame a class: men a helmet, hulls treads, turrets a barrel, ships a hull', () => {
    for (let f = 0; f < ATLAS_FRAMES; f++) {
      const c = ballClassOf(f);
      if (isShipFrame(f)) expect(c, `frame ${f}`).toBe(BallClass.ship);
    }
    expect(ballClassOf(Frame.infantry)).toBe(BallClass.infantry);
    expect(ballClassOf(Frame.prone)).toBe(BallClass.infantry);
    expect(ballClassOf(Frame.tankHeavy)).toBe(BallClass.tank);
    expect(ballClassOf(Frame.tankSmall)).toBe(BallClass.tank);
    expect(ballClassOf(Frame.halftrack)).toBe(BallClass.carrier);
    expect(ballClassOf(Frame.gun)).toBe(BallClass.gun);
    expect(ballClassOf(Frame.aircraft)).toBe(BallClass.aircraft);
    expect(ballClassOf(Frame.turretMedium)).toBe(BallClass.turret);
    expect(ballClassOf(Frame.wake)).toBe(BallClass.none);
  });

  it('draws each class in a quad that holds its props, and no larger than it needs', () => {
    // How far each class's props reach from the middle, ball units, along x or y.
    const reach: Record<number, number> = {
      [BallClass.infantry]: Math.max(-(HELMET_AT[1] - HELMET_R[1]), HELMET_BRIM_X + 0.05),
      [BallClass.tank]: Math.max(TREADS.x, TREADS.bottom),
      [BallClass.carrier]: Math.max(TREADS.x, TREADS.bottom),
      [BallClass.gun]: Math.max(GUN_BARREL.to[0] + GUN_BARREL.half, GUN_WHEEL.at[1] + GUN_WHEEL.r),
      [BallClass.ship]: Math.max(SHIP_HULL.bowDeck, -SHIP_HULL.sternDeck, SHIP_HULL.keel),
      [BallClass.aircraft]: WINGS.rx,
      [BallClass.turret]: TURRET_BARREL_LEN + TURRET_BARREL_HALF,
      [BallClass.none]: BALL_R,
    };
    for (const [c, r] of Object.entries(reach)) {
      const quad = BALL_QUAD[Number(c)]!;
      expect(quad, `class ${c}: holds ${r.toFixed(2)} and its outline`).toBeGreaterThanOrEqual(r + 0.05);
      expect(quad, `class ${c}: not much more`).toBeLessThanOrEqual(r + 0.25);
      expect(quad).toBeLessThanOrEqual(BALL_QUAD_MAX);
    }
  });

  it('puts each prop\'s test point inside its quad and out of the eyes\' way', () => {
    for (const c of [BallClass.infantry, BallClass.tank, BallClass.gun, BallClass.ship, BallClass.aircraft, BallClass.turret]) {
      for (const facing of [0, Math.PI, 0.7, -2.4]) {
        const pt = propPoint(c, facing)!;
        expect(Math.max(Math.abs(pt.p[0]), Math.abs(pt.p[1])), `class ${c} at ${facing}`).toBeLessThan(BALL_QUAD[c]!);
      }
    }
    expect(propPoint(BallClass.none, 0)).toBeNull();
  });
});
