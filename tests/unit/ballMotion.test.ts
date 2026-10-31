import { describe, expect, it } from 'vitest';
import { BallClass, ballBob, BallState, BLINK_EVERY_S, BLINK_S, blinkShut, BOB_H, BOB_HZ, eyeOpen, FLINCH_AMP, FLINCH_OPEN, flinchShake } from '../../src/render/units/ballShader';
import { DEAD_HOLD_MS, DEAD_IN_MS, DEAD_LIFE_MS, DEAD_OUT_MS, deadOpacity, DeadBalls, MAX_DEAD_BALLS } from '../../src/render/units/deadBalls';
import { EVENT_STRIDE, EventKind } from '../../src/shared/events';

// PLAN 7.174e (ADR-777): the countryballs move on the render clock.

describe('the countryballs\' motion (PLAN 7.174e)', () => {
  it('bobs on the march, by class and walk phase, and stands still at rest', () => {
    for (let t = 0; t < 3; t += 0.05) expect(ballBob(BallClass.infantry, t, 0.3, false)).toBe(0);
    let top = 0;
    let low = Infinity;
    for (let t = 0; t < 2; t += 0.005) {
      const b = ballBob(BallClass.infantry, t, 0.3, true);
      top = Math.max(top, b);
      low = Math.min(low, b);
    }
    expect(top).toBeCloseTo(BOB_H[BallClass.infantry]!, 2);
    expect(low).toBeLessThan(0.01);
    // A bob a half period of its |sin|: one a 1 / BOB_HZ of a second.
    expect(ballBob(BallClass.infantry, 0, 0.5, true)).toBeCloseTo(ballBob(BallClass.infantry, 1 / BOB_HZ[BallClass.infantry]!, 0.5, true), 6);
    // Two balls of other phases are at other heights at one time.
    expect(ballBob(BallClass.infantry, 1, 0.1, true)).not.toBeCloseTo(ballBob(BallClass.infantry, 1, 0.4, true), 3);
    // A tank bobs lower than a man.
    expect(BOB_H[BallClass.tank]!).toBeLessThan(BOB_H[BallClass.infantry]!);
    // 0.3 s on, a marching ball is at another height (the e2e's case).
    expect(Math.abs(ballBob(BallClass.infantry, 10, 0.2, true) - ballBob(BallClass.infantry, 10.3, 0.2, true))).toBeGreaterThan(0.02);
  });

  it('blinks for BLINK_S once in BLINK_EVERY_S to twice that, by its seed', () => {
    for (const seed of [0, 0.25, 0.7, 0.99]) {
      const period = BLINK_EVERY_S * (1 + seed);
      let shut = 0;
      let blinks = 0;
      let was = false;
      const dt = 0.001;
      for (let t = 0; t < period * 4; t += dt) {
        const s = blinkShut(t, seed);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        if (s > 0) shut += dt;
        if (s > 0 && !was) blinks++;
        was = s > 0;
      }
      expect(blinks, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(blinks, `seed ${seed}`).toBeLessThanOrEqual(5);
      expect(shut / 4, `seed ${seed}: shut a blink`).toBeCloseTo(BLINK_S, 1);
    }
  });

  it('squeezes and shakes the eyes under fire; opens them otherwise, but for a blink', () => {
    // A time with no blink for seed 0.5.
    const t = 2;
    expect(blinkShut(t, 0.5)).toBe(0);
    expect(eyeOpen(0, t, 0.5)).toBe(1);
    expect(eyeOpen(BallState.engaged, t, 0.5)).toBe(1);
    expect(eyeOpen(BallState.hit, t, 0.5)).toBeCloseTo(FLINCH_OPEN, 6);
    expect(eyeOpen(BallState.hit | BallState.engaged, t, 0.5)).toBeCloseTo(FLINCH_OPEN, 6);
    expect(flinchShake(0, 0.04)).toBe(0);
    let most = 0;
    for (let s = 0; s < 1; s += 0.001) most = Math.max(most, Math.abs(flinchShake(BallState.hit, s)));
    expect(most).toBeCloseTo(FLINCH_AMP, 3);
    // Shut, never quite a line of nothing.
    let least = 1;
    for (let s = 0; s < 10; s += 0.001) least = Math.min(least, eyeOpen(0, s, 0.5));
    expect(least).toBeCloseTo(0.08, 2);
  });

  it('a destroyed ball comes in, holds, fades and is gone; its nation from the snapshot before', () => {
    expect(deadOpacity(-1)).toBe(0);
    expect(deadOpacity(DEAD_IN_MS / 2)).toBeCloseTo(0.5, 6);
    expect(deadOpacity(DEAD_IN_MS + DEAD_HOLD_MS / 2)).toBe(1);
    expect(deadOpacity(DEAD_IN_MS + DEAD_HOLD_MS + DEAD_OUT_MS / 2)).toBeCloseTo(0.5, 6);
    expect(deadOpacity(DEAD_LIFE_MS)).toBe(0);

    const events = (ids: number[]): number[] => {
      const d: number[] = [];
      for (const id of ids) d.push(0, 10, EventKind.ElementDestroyed, id, 0, 100.5, 50.5);
      d.push(0, 10, EventKind.WarDeclared, 1, 2, 0, 0);
      expect(d.length).toBe((ids.length + 1) * EVENT_STRIDE);
      return d;
    };
    const dead = new DeadBalls();
    const nations = new Map([
      [7, 3],
      [8, 4],
    ]);
    dead.add(3, events([7, 8]), 1000, (id) => nations.get(id) ?? -1);
    expect(dead.balls.map((b) => b.nation)).toEqual([3, 4]);
    expect(dead.animating(1000 + DEAD_LIFE_MS - 1)).toBe(true);
    expect(dead.animating(1000 + DEAD_LIFE_MS)).toBe(false);
    // One the view did not hold has no ball.
    dead.add(2, events([99]), 1100, (id) => nations.get(id) ?? -1);
    expect(dead.balls).toHaveLength(2);
    // Those gone leave at the next snapshot; at most MAX_DEAD_BALLS at once.
    dead.add(1, events([]), 1000 + DEAD_LIFE_MS, () => 1);
    expect(dead.balls).toHaveLength(0);
    const many = Array.from({ length: MAX_DEAD_BALLS + 20 }, (_, i) => i);
    dead.add(many.length + 1, events(many), 5000, () => 1);
    expect(dead.balls).toHaveLength(MAX_DEAD_BALLS);
  });
});
