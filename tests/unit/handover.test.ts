import { describe, expect, it } from 'vitest';
import { HANDOVER_HYSTERESIS, HANDOVER_MS, TierHandover } from '../../src/render/units/handover';
import { T1_MAX_M } from '../../src/render/units/markers';

// PLAN 1.45a: the T0 ↔ T1 handover. Before, the two unit layers cross-faded by zoom over
// 2000–2600 m/px, so a camera resting in that band showed both half-faded (critic B7's "ghost
// counters": at 2446 m/px, counters at 0.84 and markers at 0.16, paused, for as long as one
// looked). Now the layer is a state and the cross-fade takes time.

const OUT = T1_MAX_M * HANDOVER_HYSTERESIS;
/** A handover that has rested at `mPerPx` since long before `now`. */
function resting(mPerPx: number, now = 0): TierHandover {
  const h = new TierHandover();
  h.share(mPerPx, now - 10_000);
  return h;
}

describe('T0 ↔ T1 handover (PLAN 1.45a)', () => {
  it('at rest shows one layer in full, at every zoom', () => {
    for (let m = 100; m < 60_000; m *= 1.07) {
      const h = new TierHandover();
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
    expect(h.markers).toBe(false);
    h.share(T1_MAX_M, 0);
    expect(h.markers).toBe(true);
    expect(h.share(OUT - 1, 10_000)).toBe(1); // zooming out, they stay through the band
    expect(h.share(OUT, 20_000)).toBe(1);
    expect(h.markers).toBe(true);
    h.share(OUT + 1, 30_000);
    expect(h.markers).toBe(false);
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
});
