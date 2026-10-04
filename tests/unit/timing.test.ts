import { describe, expect, it } from 'vitest';
import { ANIM_TAIL_MS, FADE_MS, progress, running, smooth, TimedSwitch } from '../../src/render/timing';

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

  it('a timed switch: set at first, then every change is a fade that a turn continues', () => {
    const s = new TimedSwitch(250);
    expect(s.on).toBeNull();
    expect(s.value(true, 1000)).toBe(1); // the first answer sets it: nothing to fade from
    expect(s.animating(1000)).toBe(false);
    expect(s.value(true, 5000)).toBe(1);
    // Off: a fade from the frame that says so.
    expect(s.value(false, 6000)).toBe(1);
    expect(s.on).toBe(false);
    expect(s.animating(6000)).toBe(true);
    expect(s.linear(false, 6100)).toBeCloseTo(0.6, 12);
    expect(s.value(false, 6125)).toBeCloseTo(0.5, 12);
    expect(s.value(false, 6250)).toBe(0);
    expect(s.animating(6250 + ANIM_TAIL_MS - 1)).toBe(true);
    expect(s.animating(6250 + ANIM_TAIL_MS)).toBe(false);
    // A turn in the middle goes on from the value reached, and takes only what is left.
    s.value(true, 7000);
    const reached = s.value(true, 7100);
    expect(s.value(false, 7100)).toBeCloseTo(reached, 12);
    expect(s.value(false, 7150)).toBeLessThan(reached);
    expect(s.value(false, 7200)).toBe(0);
    // In 16 ms frames no step is larger than the eye follows.
    const t = new TimedSwitch(FADE_MS);
    t.value(false, 0);
    let last = t.value(true, 10_000);
    for (let now = 10_016; now <= 10_000 + FADE_MS + 16; now += 16) {
      const v = t.value(true, now);
      expect(v - last).toBeGreaterThanOrEqual(0);
      expect(v - last).toBeLessThan(0.1);
      last = v;
    }
    expect(last).toBe(1);
  });

  it('smooth is a symmetric ease: a fade turned at p goes on at 1 − p', () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(0.5)).toBe(0.5);
    expect(smooth(1)).toBe(1);
    for (const p of [0.1, 0.25, 0.4, 0.8]) expect(smooth(1 - p)).toBeCloseTo(1 - smooth(p), 12);
    for (let p = 0; p < 1; p += 0.05) expect(smooth(p + 0.05)).toBeGreaterThan(smooth(p));
  });
});
