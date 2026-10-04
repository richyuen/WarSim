import { describe, expect, it } from 'vitest';
import { EVENT_STRIDE, EventKind } from '../../src/shared/events';
import { Wreck } from '../../src/shared/unitLooks';
import { ANIM_TAIL_MS } from '../../src/render/timing';
import { BURST_MS, burstOf, MAX_WRECKS, WRECK_HOLD_MS, WRECK_IN_MS, WRECK_LIFE_MS, WRECK_OUT_MS, WreckFx, wreckOpacity } from '../../src/render/fx/wrecks';

// PLAN 2.4b: the wrecks the view keeps of a snapshot's ElementDestroyed events. The drawing is
// checked in the browser (tests/e2e/wrecks1938.spec.ts); here what becomes a wreck and for how long.

/** Snapshot event records [seq, tick, kind, a, b, x, y]. */
function events(list: readonly [kind: number, a: number, b: number, x: number, y: number][]): Float64Array {
  const out = new Float64Array(list.length * EVENT_STRIDE);
  list.forEach((e, i) => out.set([i + 1, 50, ...e], i * EVENT_STRIDE));
  return out;
}
const died = (id: number, kind: Wreck = Wreck.men, x = 10, y = 20): [number, number, number, number, number] => [EventKind.ElementDestroyed, id, kind, x, y];
function add(fx: WreckFx, list: readonly [number, number, number, number, number][], now: number): void {
  fx.add(list.length, events(list), now);
}

describe('WreckFx.add', () => {
  it('makes a wreck of each ElementDestroyed and of nothing else', () => {
    const fx = new WreckFx();
    add(fx, [died(7, Wreck.gun, 100.25, 50.5), [EventKind.FormationDestroyed, 3, 1, 100, 50], died(9, Wreck.vehicle, 101, 51)], 4000);
    expect(fx.wrecks).toHaveLength(2);
    expect(fx.wrecks[0]).toMatchObject({ id: 7, kind: Wreck.gun, x: 100.25, y: 50.5, born: 4000 });
    expect(fx.wrecks[1]).toMatchObject({ id: 9, kind: Wreck.vehicle, x: 101, y: 51, born: 4000 });
    expect([fx.last, fx.until]).toEqual([4000, 4000 + WRECK_LIFE_MS]);
  });

  it('a wreck lies at an angle of its own, the same every time', () => {
    const fx = new WreckFx();
    add(fx, Array.from({ length: 100 }, (_, i) => died(i + 1)), 0);
    const angles = fx.wrecks.map((w) => w.angle);
    for (const a of angles) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI);
    }
    expect(new Set(angles.map((a) => Math.floor((a / Math.PI) * 8))).size).toBe(8);
    const again = new WreckFx();
    add(again, Array.from({ length: 100 }, (_, i) => died(i + 1)), 999);
    expect(again.wrecks.map((w) => w.angle)).toEqual(angles);
  });

  it('wrecks that have faded leave when a snapshot arrives; a snapshot without deaths keeps the clock', () => {
    const fx = new WreckFx();
    add(fx, [died(1)], 0);
    add(fx, [died(2)], 5000);
    add(fx, [], WRECK_LIFE_MS - 1);
    expect(fx.wrecks.map((w) => w.id)).toEqual([1, 2]);
    add(fx, [[EventKind.FormationArrived, 3, 1, 10, 20]], WRECK_LIFE_MS);
    expect(fx.wrecks.map((w) => w.id)).toEqual([2]);
    expect([fx.last, fx.until]).toEqual([5000, 5000 + WRECK_LIFE_MS]);
  });

  it('holds at most MAX_WRECKS: the oldest go', () => {
    const fx = new WreckFx();
    add(fx, Array.from({ length: MAX_WRECKS }, (_, i) => died(i + 1)), 0);
    add(fx, [died(90_001), died(90_002)], 100);
    expect(fx.wrecks).toHaveLength(MAX_WRECKS);
    expect(fx.wrecks[0]!.id).toBe(3);
    expect(fx.wrecks.at(-1)!.id).toBe(90_002);
  });
});

describe('a wreck in time', () => {
  const fx = new WreckFx();
  add(fx, [died(1)], 1000);
  const w = fx.wrecks[0]!;

  it('comes in under its burst, stays, and fades', () => {
    expect(wreckOpacity(w, 1000)).toBe(0);
    expect(wreckOpacity(w, 1000 + WRECK_IN_MS / 2)).toBe(0.5);
    expect(wreckOpacity(w, 1000 + WRECK_IN_MS)).toBe(1);
    expect(wreckOpacity(w, 1000 + WRECK_IN_MS + WRECK_HOLD_MS)).toBe(1);
    expect(wreckOpacity(w, 1000 + WRECK_IN_MS + WRECK_HOLD_MS + WRECK_OUT_MS / 2)).toBe(0.5);
    expect(wreckOpacity(w, 1000 + WRECK_LIFE_MS)).toBe(0);
    // The burst is over while the wreck is still coming to rest.
    expect(BURST_MS).toBeGreaterThan(WRECK_IN_MS);
    expect(burstOf(w, 1000)).toBe(0);
    expect(burstOf(w, 1000 + BURST_MS / 2)).toBe(0.5);
    expect(burstOf(w, 1000 + BURST_MS)).toBe(1);
  });

  it('a frame clock from before the snapshot arrived draws the start, not the end', () => {
    expect(wreckOpacity(w, 990)).toBe(0);
    expect(burstOf(w, 990)).toBe(0);
  });

  it('bursting is the short part, animating the whole stay', () => {
    expect(new WreckFx().animating(0)).toBe(false);
    expect(new WreckFx().bursting(0)).toBe(false);
    expect(fx.bursting(990)).toBe(true);
    expect(fx.bursting(1000 + BURST_MS + ANIM_TAIL_MS - 1)).toBe(true);
    expect(fx.bursting(1000 + BURST_MS + ANIM_TAIL_MS)).toBe(false);
    expect(fx.animating(1000 + BURST_MS + ANIM_TAIL_MS)).toBe(true);
    expect(fx.animating(1000 + WRECK_LIFE_MS + ANIM_TAIL_MS - 1)).toBe(true);
    expect(fx.animating(1000 + WRECK_LIFE_MS + ANIM_TAIL_MS)).toBe(false);
  });
});
