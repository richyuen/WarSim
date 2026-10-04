import { describe, expect, it } from 'vitest';
import { ANIM_TAIL_MS, FADE_MS, progress, running, smooth, SwitchBank, TimedSwitch } from '../../src/render/timing';

// The clock shared by the view's short animations (counter splits and folds, the handovers
// between tiers, flags, labels). Review pass after PLAN 1.43–1.45: three copies of these rules
// became one. Review pass after PLAN 2.7: the switches of the labels became one bank.

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

  it('a bank of switches: new things are set at once, hidden ones are off, unseen ones are forgotten', () => {
    const bank = new SwitchBank<string>();
    // Frame 1: "a" is placed and wanted (new: there at once); "b" is in view with nothing to show.
    let state = bank.frame(1000);
    expect(state.held('a')).toBe(false); // the layout is asked before the layer answers
    expect(bank.value('a', true)).toBe(1);
    state.hidden!('b');
    bank.end();
    expect(bank.animating(1000)).toBe(false);
    // Frame 2: the zoom brings "b": it fades in from nothing. "a" is held.
    state = bank.frame(2000);
    expect([state.held('a'), state.visible('a'), state.held('b'), state.visible('b')]).toEqual([true, true, false, false]);
    expect(bank.value('a', true)).toBe(1);
    expect(bank.value('b', true)).toBe(0);
    bank.end();
    expect(bank.animating(2000)).toBe(true);
    // Mid-fade: "b" is held and half there; "a" goes out, and stays visible while it does.
    state = bank.frame(2000 + FADE_MS / 2);
    expect(state.held('b')).toBe(true);
    expect(bank.value('b', true)).toBeCloseTo(0.5, 12);
    expect(bank.value('a', false)).toBe(1);
    bank.end();
    state = bank.frame(2000 + FADE_MS);
    expect([state.held('a'), state.visible('a')]).toEqual([false, true]);
    expect(bank.value('a', false)).toBeCloseTo(0.5, 12);
    expect(bank.value('b', true)).toBe(1);
    bank.end();
    // A frame in which "a" is neither placed nor hidden: out of view. It has no state after,
    // and is there at once when a pan brings it back.
    bank.frame(5000);
    bank.value('b', true);
    bank.end();
    state = bank.frame(6000);
    expect([state.held('a'), state.visible('a')]).toEqual([false, false]);
    expect(bank.value('a', true)).toBe(1);
    bank.end();
    expect(bank.animating(6000)).toBe(false);
    bank.clear();
    expect(bank.frame(7000).held('b')).toBe(false);
  });

  it('smooth is a symmetric ease: a fade turned at p goes on at 1 − p', () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(0.5)).toBe(0.5);
    expect(smooth(1)).toBe(1);
    for (const p of [0.1, 0.25, 0.4, 0.8]) expect(smooth(1 - p)).toBeCloseTo(1 - smooth(p), 12);
    for (let p = 0; p < 1; p += 0.05) expect(smooth(p + 0.05)).toBeGreaterThan(smooth(p));
  });
});
