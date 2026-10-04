import { describe, expect, it } from 'vitest';
import { HANDOVER_HYSTERESIS, HANDOVER_MS, TierHandover } from '../../src/render/units/handover';
import { T3_MAX_M } from '../../src/render/units/individuals';
import { T1_MAX_M, T1_MIN_M } from '../../src/render/units/markers';
import { tierOf } from '../../src/shared/protocol';

// PLAN 1.45a: the T0 ↔ T1 handover. Before, the two unit layers cross-faded by zoom over
// 2000–2600 m/px, so a camera resting in that band showed both half-faded (critic B7's "ghost
// counters": at 2446 m/px, counters at 0.84 and markers at 0.16, paused, for as long as one
// looked). Now the layer is a state and the cross-fade takes time.

const OUT = T1_MAX_M * HANDOVER_HYSTERESIS;
/** A handover that has rested at `mPerPx` since long before `now`. */
function resting(mPerPx: number, now = 0): TierHandover {
  const h = new TierHandover(T1_MAX_M);
  h.share(mPerPx, now - 10_000);
  return h;
}

describe('T0 ↔ T1 handover (PLAN 1.45a)', () => {
  it('at rest shows one layer in full, at every zoom', () => {
    for (let m = 100; m < 60_000; m *= 1.07) {
      const h = new TierHandover(T1_MAX_M);
      expect(h.share(m, 0), `${m} m/px, first frame`).toBe(m <= T1_MAX_M ? 1 : 0);
      expect(h.animating(0)).toBe(false);
      expect([0, 1]).toContain(h.share(m, 5_000));
    }
    // Arriving in the old cross-fade band from either side, and staying.
    for (const m of [2017, 2174, 2446, 2575]) {
      const fromFar = resting(6_000);
      fromFar.share(m, 0);
      expect(fromFar.share(m, HANDOVER_MS + 1), `${m} from T0`).toBe(0);
      const fromNear = resting(1_000);
      fromNear.share(m, 0);
      expect(fromNear.share(m, HANDOVER_MS + 1), `${m} from T1`).toBe(m <= OUT ? 1 : 0);
      expect(fromNear.animating(HANDOVER_MS + 51)).toBe(false);
    }
  });

  it('the markers come in at T1_MAX_M and go out above it by the hysteresis factor', () => {
    const h = resting(6_000);
    expect(h.share(T1_MAX_M + 1, 0)).toBe(0); // not yet: T1 is up to 2000 m/px
    expect(h.near).toBe(false);
    h.share(T1_MAX_M, 0);
    expect(h.near).toBe(true);
    expect(h.share(OUT - 1, 10_000)).toBe(1); // zooming out, they stay through the band
    expect(h.share(OUT, 20_000)).toBe(1);
    expect(h.near).toBe(true);
    h.share(OUT + 1, 30_000);
    expect(h.near).toBe(false);
    expect(h.share(OUT + 1, 40_000)).toBe(0);
    // Back down into the band from above: still the counters.
    expect(h.share(T1_MAX_M + 1, 50_000)).toBe(0);
  });

  it('a change is a smooth cross-fade over HANDOVER_MS, in steps the eye follows', () => {
    const h = resting(6_000);
    let last = h.share(1_500, 0);
    expect(last).toBe(0); // the fade starts at the frame that sees the change
    expect(h.animating(0)).toBe(true);
    for (let t = 16; t <= HANDOVER_MS; t += 16) {
      const s = h.share(1_500, t);
      expect(s).toBeGreaterThan(last);
      expect(s - last).toBeLessThan(0.12); // 16 ms frames: no pop
      last = s;
    }
    expect(h.share(1_500, HANDOVER_MS / 2)).toBeCloseTo(0.5, 6);
    expect(h.share(1_500, HANDOVER_MS)).toBe(1);
    expect(h.animating(HANDOVER_MS + 49)).toBe(true); // one more frame, so the end state is drawn
    expect(h.animating(HANDOVER_MS + 50)).toBe(false);
  });

  it('a turn in mid-fade continues from the share reached', () => {
    const h = resting(6_000);
    h.share(1_500, 0);
    const reached = h.share(1_500, 100);
    expect(reached).toBeGreaterThan(0.2);
    expect(reached).toBeLessThan(0.5);
    // Zoomed back out at once: the markers fade out again from where they were.
    expect(h.share(6_000, 100)).toBeCloseTo(reached, 9);
    expect(h.share(6_000, 150)).toBeLessThan(reached);
    expect(h.share(6_000, 200)).toBeCloseTo(0, 9);
    expect(h.share(6_000, 100 + HANDOVER_MS)).toBe(0);
  });

  it('a clock that runs backwards (tests draw at made-up times) leaves the fade done, not undone', () => {
    const h = resting(6_000);
    h.share(1_500, 60_000);
    expect(h.share(1_500, 1_000)).toBe(1);
    expect(h.animating(1_000)).toBe(false);
  });

  it('a handover can take longer, and gives its progress unsmoothed for a change in parts (PLAN 2.7c)', () => {
    const h = new TierHandover(T1_MIN_M, 470);
    h.linear(1_000, -10_000);
    expect(h.linear(250, 0)).toBe(0);
    expect(h.linear(250, 235)).toBeCloseTo(0.5, 12);
    expect(h.share(250, 235)).toBeCloseTo(0.5, 12); // the share is the progress, eased
    expect(h.linear(250, 117.5)).toBeCloseTo(0.25, 12);
    expect(h.share(250, 117.5)).toBeCloseTo(0.15625, 12);
    expect(h.animating(469 + 50)).toBe(true);
    expect(h.animating(470 + 50)).toBe(false);
    expect(h.linear(250, 470)).toBe(1);
    // Out again: back down over the same time, and a turn in the middle goes on from where it was.
    expect(h.linear(1_000, 1_000)).toBe(1);
    expect(h.linear(1_000, 1_000 + 141)).toBeCloseTo(0.7, 12);
    expect(h.linear(250, 1_000 + 141)).toBeCloseTo(0.7, 12);
    expect(h.linear(250, 1_000 + 141 + 47)).toBeCloseTo(0.8, 12);
  });
});

// PLAN 2.7b: the same mechanism at the other two tier boundaries. Toward T2 the markers used to
// fade by zoom over 210–300 m/px (`markerLowFade`, gone), so a camera resting there showed the
// markers and the element sprites both half-faded; toward T3 the sprites were switched for the
// figures in one frame.
describe('every tier boundary is a handover (PLAN 2.7b)', () => {
  for (const [name, threshold] of [['T0 ↔ T1', T1_MAX_M], ['T1 ↔ T2', T1_MIN_M], ['T2 ↔ T3', T3_MAX_M]] as const) {
    it(`${name} at ${threshold} m/px: one layer at rest, in at the threshold, out by the hysteresis`, () => {
      const out = threshold * HANDOVER_HYSTERESIS;
      // At rest, wherever the camera stands, the nearer layer is in full or not there.
      for (let m = threshold / 4; m < threshold * 4; m *= 1.03) {
        const h = new TierHandover(threshold);
        expect(h.share(m, 0), `${m} m/px`).toBe(m <= threshold ? 1 : 0);
        expect(h.animating(0)).toBe(false);
      }
      const h = new TierHandover(threshold);
      h.share(threshold * 3, -10_000);
      expect(h.share(threshold + 0.001, 0)).toBe(0);
      expect(h.near).toBe(false);
      h.share(threshold, 0); // the tier reaches up to its limit, inclusive, as `tierOf` has it
      expect(h.near).toBe(true);
      expect(h.share(threshold, HANDOVER_MS)).toBe(1);
      // Zooming out, the nearer layer stays through the band, in full.
      expect(h.share(out, 10_000)).toBe(1);
      expect(h.near).toBe(true);
      h.share(out * 1.001, 20_000);
      expect(h.near).toBe(false);
      expect(h.share(out * 1.001, 20_000 + HANDOVER_MS)).toBe(0);
      // Back into the band from above: still the farther layer.
      expect(h.share(threshold * 1.05, 30_000)).toBe(0);
    });
  }

  it('the thresholds are the tiers of the subscription', () => {
    expect([tierOf(T1_MAX_M), tierOf(T1_MAX_M + 1)]).toEqual([1, 0]);
    expect([tierOf(T1_MIN_M), tierOf(T1_MIN_M + 1)]).toEqual([2, 1.5]);
    expect([tierOf(T3_MAX_M), tierOf(T3_MAX_M + 1)]).toEqual([3, 2]);
    // Elements are sent from tier 1.5 on: they are in the view before the sprites come in, and
    // still there through the hysteresis on the way out.
    expect(tierOf(T1_MIN_M * HANDOVER_HYSTERESIS)).toBe(1.5);
  });

  it('where the markers used to fade by zoom, a resting camera has one layer in full', () => {
    for (const m of [215, 250, 285, 300]) {
      const fromT1 = new TierHandover(T1_MIN_M);
      fromT1.share(1000, -10_000);
      fromT1.share(m, 0);
      expect(fromT1.share(m, HANDOVER_MS), `${m} m/px from T1`).toBe(1);
      const fromT2 = new TierHandover(T1_MIN_M);
      fromT2.share(100, -10_000);
      expect(fromT2.share(m, 0), `${m} m/px from T2`).toBe(1);
    }
  });
});