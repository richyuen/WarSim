import { describe, expect, it } from 'vitest';
import { ANIM_TAIL_MS, progress, running, smooth } from '../../src/render/timing';

// The clock shared by the view's short animations (counter splits and folds, the T0 ↔ T1
// handover, capital flags making way). Review pass after PLAN 1.43–1.45: three copies of these
// rules became one.

describe('animation clock', () => {
  it('progress runs from 0 to 1 over the duration and stays there', () => {
    expect(progress(1000, 1000, 250)).toBe(0);
    expect(progress(1125, 1000, 250)).toBe(0.5);
    expect(progress(1250, 1000, 250)).toBe(1);
    expect(progress(9999, 1000, 250)).toBe(1);
    expect(progress(5, -Infinity, 250)).toBe(1); // never started: at rest
  });

  it('a clock that ran backwards leaves an animation done and not running', () => {
    // Tests draw at made-up times; the frame after may be earlier than the animation's start.
    expect(progress(500, 60_000, 250)).toBe(1);
    expect(running(500, 60_000, 250)).toBe(false);
  });

  it('running covers the duration and a tail, so that the end state is drawn', () => {
    expect(running(1000, 1000, 250)).toBe(true);
    expect(running(1249, 1000, 250)).toBe(true);
    expect(running(1250 + ANIM_TAIL_MS - 1, 1000, 250)).toBe(true);
    expect(running(1250 + ANIM_TAIL_MS, 1000, 250)).toBe(false);
    expect(running(5, -Infinity, 250)).toBe(false);
  });

  it('smooth is a symmetric ease: a fade turned at p goes on at 1 − p', () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(0.5)).toBe(0.5);
    expect(smooth(1)).toBe(1);
    for (const p of [0.1, 0.25, 0.4, 0.8]) expect(smooth(1 - p)).toBeCloseTo(1 - smooth(p), 12);
    for (let p = 0; p < 1; p += 0.05) expect(smooth(p + 0.05)).toBeGreaterThan(smooth(p));
  });
});
