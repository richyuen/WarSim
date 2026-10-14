import { describe, expect, it } from 'vitest';
import { EVENT_STRIDE, EventKind } from '../../src/shared/events';
import { CLOUD_MS, MIN_PX, NukeFx } from '../../src/render/fx/nuke';

// PLAN 6.6b: a burst's effects take the snapshot's `NukeDetonated` alone, are sized by the yield's
// blast radius at the camera's scale (at least MIN_PX), live CLOUD_MS, and can be held at an age.

const ev = (kind: number, yieldN: number, x: number, y: number): number[] => {
  const r = new Array<number>(EVENT_STRIDE).fill(0);
  [r[2], r[4], r[5], r[6]] = [kind, yieldN, x, y];
  return r;
};

describe('a nuclear burst\'s effects (PLAN 6.6b)', () => {
  it('takes the bursts of a snapshot, no other event; lives CLOUD_MS; a hold stops the clock', () => {
    const fx = new NukeFx();
    fx.add(3, [...ev(EventKind.AirStrike, 1, 5, 5), ...ev(EventKind.NukeDetonated, 2, 10, 20), ...ev(EventKind.NukeCasualties, 1, 10, 20)], 1000);
    expect(fx.bursts).toEqual([{ x: 10, y: 20, yieldN: 2, born: 1000 }]);
    expect(fx.animating(1000 + CLOUD_MS - 1)).toBe(true);
    expect(fx.animating(1000 + CLOUD_MS)).toBe(false);
    fx.add(0, [], 1000 + CLOUD_MS);
    expect(fx.bursts).toEqual([]);
    fx.hold = 500;
    expect(fx.animating(0)).toBe(false);
  });

  it('a radius by the yield\'s cube root at the camera\'s scale, MIN_PX at least', () => {
    const geo = { w: 2048, h: 1024, wrapX: true } as unknown as Parameters<typeof NukeFx.radiusPx>[2];
    const at = (scale: number, yieldN: number): number => NukeFx.radiusPx({ x: 0, y: 0, yieldN, born: 0 }, { cx: 0, cy: 0, scale }, geo);
    expect(at(1, 1)).toBe(MIN_PX);
    const near = at(100, 1);
    expect(near).toBeCloseTo((25 / (40075 / 2048)) * 100, 9);
    expect(at(100, 2) / near).toBeCloseTo(Math.cbrt(2), 9);
  });
});
