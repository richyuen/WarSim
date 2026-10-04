import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PAD, viewSubscription } from '../../src/app/subscription';
import { maxScale, type Camera } from '../../src/render/camera';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';

// PLAN 2.7n2 (ADR-74, second read, finding 1): when the view asks the worker again.
//
// The worker sends the elements of the box it was last told. The view told it again when its
// box, rounded to quarter cells, had changed. A quarter cell is 41 px at 120 m/px and 4,892 px at
// 1 m/px, two and a half screens: at the closest zooms a pan onto a division left the worker
// with a box that did not hold it, and the view with no figures.

const GEO = SCENARIO_GEOMETRY['1938'];
const KM = GEO.kmPerCell;
const VIEWS = [[1280, 720], [1920, 1080], [900, 1400]] as const;

let seed = 2718;
const rnd = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

/** Whether the view of `cam` lies inside `bbox`. */
function inside(cam: Camera, vw: number, vh: number, bbox: readonly number[]): boolean {
  const hw = vw / 2 / cam.scale;
  const hh = vh / 2 / cam.scale;
  return cam.cx - hw >= bbox[0]! && cam.cy - hh >= bbox[1]! && cam.cx + hw <= bbox[2]! && cam.cy + hh <= bbox[3]!;
}

describe('the view subscription (PLAN 2.7n2)', () => {
  it('is the view padded by a quarter, with the tier of the zoom', () => {
    const { sub } = viewSubscription({ cx: 1000, cy: 400, scale: 100 }, 1280, 720, KM);
    expect(sub.bbox).toEqual([1000 - 6.4 * SUBSCRIPTION_PAD, 400 - 3.6 * SUBSCRIPTION_PAD, 1000 + 6.4 * SUBSCRIPTION_PAD, 400 + 3.6 * SUBSCRIPTION_PAD]);
    expect(sub.tier).toBe(2); // 196 m/px
    expect(sub.wantsElements).toBe(true);
    expect(viewSubscription({ cx: 1000, cy: 400, scale: 1 }, 1280, 720, KM).sub).toMatchObject({ tier: 0, wantsElements: false });
  });

  it('two cameras with one key: the view of each is inside the box of the other, at every zoom', () => {
    const outside: string[] = [];
    let same = 0;
    let pairs = 0;
    // From the whole world in view (0.35 px per cell) to 1 m/px, half a level apart.
    for (let scale = 0.35; scale <= maxScale(GEO); scale = Math.min(scale * Math.SQRT2, scale === maxScale(GEO) ? Infinity : maxScale(GEO))) {
      for (const [vw, vh] of VIEWS) {
        for (let i = 0; i < 400; i++) {
          const a: Camera = { cx: rnd() * GEO.w, cy: rnd() * GEO.h, scale };
          // A second camera: in half the pairs up to half a padded box away at a zoom up to 5%
          // off (with a step of a quarter cell these had one key at the closest zooms), in the
          // other half a few px away at the same zoom (these have one key at any step).
          const far = i % 2 === 0;
          const reach = ((far ? Math.max(vw, vh) : Math.min(vw, vh) / 20) / 2 / scale) * SUBSCRIPTION_PAD;
          const b: Camera = { cx: a.cx + (rnd() - 0.5) * reach, cy: a.cy + (rnd() - 0.5) * reach, scale: far ? scale * (0.95 + rnd() * 0.1) : scale };
          const sa = viewSubscription(a, vw, vh, KM);
          const sb = viewSubscription(b, vw, vh, KM);
          pairs++;
          if (sa.key !== sb.key) continue;
          same++;
          if (!inside(b, vw, vh, sa.sub.bbox)) outside.push(`${vw}×${vh} at ${((KM * 1000) / scale).toFixed(1)} m/px: the camera moved ${((b.cx - a.cx) * scale).toFixed(0)}, ${((b.cy - a.cy) * scale).toFixed(0)} px with no new key`);
        }
      }
    }
    // The pairs are not all apart: there are cameras with one key to test.
    expect(same).toBeGreaterThan(pairs / 10);
    expect(outside.length, `${outside.length} of ${same} pairs with one key; the first: ${outside[0]}`).toBe(0);
  });

  it('a pan of a quarter of the view asks again, from the world view down to 1 m/px', () => {
    for (const mPerPx of [20_000, 5000, 1000, 300, 120, 30, 10, 3, 1]) {
      const scale = (KM * 1000) / mPerPx;
      for (const [vw, vh] of VIEWS) {
        const a: Camera = { cx: 1100.3, cy: 288.7, scale };
        const key = viewSubscription(a, vw, vh, KM).key;
        expect(viewSubscription({ ...a, cx: a.cx + vw / 4 / scale }, vw, vh, KM).key, `${vw}×${vh} at ${mPerPx} m/px, a quarter of the width`).not.toBe(key);
        expect(viewSubscription({ ...a, cy: a.cy + vh / 4 / scale }, vw, vh, KM).key, `${vw}×${vh} at ${mPerPx} m/px, a quarter of the height`).not.toBe(key);
      }
    }
  });

  it('and a pan of a few pixels does not', () => {
    // Not at every place (a step's edge is somewhere), but for most cameras.
    let again = 0;
    let n = 0;
    for (const mPerPx of [5000, 300, 30, 1]) {
      const scale = (KM * 1000) / mPerPx;
      for (let i = 0; i < 200; i++, n++) {
        const a: Camera = { cx: rnd() * GEO.w, cy: rnd() * GEO.h, scale };
        if (viewSubscription({ ...a, cx: a.cx + 2 / scale }, 1280, 720, KM).key !== viewSubscription(a, 1280, 720, KM).key) again++;
      }
    }
    expect(again).toBeLessThan(n / 4);
  });
});
