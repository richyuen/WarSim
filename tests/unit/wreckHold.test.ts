import { describe, expect, it } from 'vitest';
import { EVENT_STRIDE, EventKind } from '../../src/shared/events';
import { Wreck } from '../../src/shared/unitLooks';
import { FLAME_MS, HULL_OUT_MS, hullOpacity, SMOKE_MS } from '../../src/render/fx/hulls';
import { WRECK_HOLD_HOURS, WRECK_LIFE_MS, WRECK_OUT_MS, WreckFx, wreckOpacity } from '../../src/render/fx/wrecks';

// PLAN 7.9a (critic run 7: "`wrecks` read null at every tier ... I saw no wreck"): the test hook
// read `wrecks.count`, which `WreckFx` had not, and a wreck went in about 15 s of the clock, paused
// or not, so at the speeds a fight is watched it was gone. Now a wreck (and a hull, and a mark of
// the fallen) is held until both its time on the clock and WRECK_HOLD_HOURS of the game have
// passed; without a tick it fades on the clock alone, as before.

/** One ElementDestroyed record: [seq, tick, kind, element, wreck kind, x, y]. */
function destroyed(tick: number, id: number): number[] {
  const r = new Array<number>(EVENT_STRIDE).fill(0);
  [r[0], r[1], r[2], r[3], r[4], r[5], r[6]] = [1, tick, EventKind.ElementDestroyed, id, Wreck.vehicle, 10, 10];
  return r;
}

describe('a wreck held by the game (PLAN 7.9a)', () => {
  it('counts what it holds', () => {
    const fx = new WreckFx();
    expect(fx.count).toBe(0);
    fx.add(2, [...destroyed(100, 1), ...destroyed(100, 2)], 0, 100);
    expect(fx.count).toBe(2);
  });

  it('stays while the game is paused, however long the clock runs', () => {
    const fx = new WreckFx();
    fx.add(1, destroyed(100, 1), 0, 100);
    // An hour of the clock later, the game still at tick 100 (paused): there, whole.
    const later = 3_600_000;
    fx.add(0, [], later, 100);
    expect(fx.count).toBe(1);
    expect(wreckOpacity(fx.wrecks[0]!, later)).toBe(1);
  });

  it('fades once the game is WRECK_HOLD_HOURS past it, over WRECK_OUT_MS', () => {
    const fx = new WreckFx();
    fx.add(1, destroyed(100, 1), 0, 100);
    const t = WRECK_LIFE_MS * 2;
    fx.add(0, [], t, 100 + WRECK_HOLD_HOURS - 1);
    expect(wreckOpacity(fx.wrecks[0]!, t)).toBe(1);
    fx.add(0, [], t, 100 + WRECK_HOLD_HOURS);
    expect(wreckOpacity(fx.wrecks[0]!, t + WRECK_OUT_MS / 2)).toBeGreaterThan(0);
    expect(wreckOpacity(fx.wrecks[0]!, t + WRECK_OUT_MS / 2)).toBeLessThan(1);
    fx.add(0, [], t + WRECK_OUT_MS, 100 + WRECK_HOLD_HOURS + 5);
    expect(fx.count).toBe(0);
  });

  it('the clock still holds it when the game runs fast: at least WRECK_LIFE_MS', () => {
    const fx = new WreckFx();
    fx.add(1, destroyed(100, 1), 0, 100);
    // At Max the game is days past it a second later: the clock's hold still holds it.
    fx.add(0, [], 1000, 100 + 10 * WRECK_HOLD_HOURS);
    expect(wreckOpacity(fx.wrecks[0]!, 1000)).toBe(1);
    expect(wreckOpacity(fx.wrecks[0]!, WRECK_LIFE_MS - WRECK_OUT_MS / 2)).toBeGreaterThan(0);
    expect(wreckOpacity(fx.wrecks[0]!, WRECK_LIFE_MS)).toBe(0);
  });

  it('without a tick, as before: gone at WRECK_LIFE_MS', () => {
    const fx = new WreckFx();
    fx.add(1, destroyed(100, 1), 0);
    expect(wreckOpacity(fx.wrecks[0]!, WRECK_LIFE_MS)).toBe(0);
  });

  it('a hull held by the game the same way', () => {
    const held = { born: 0, out: Infinity };
    expect(hullOpacity(held, 10 * (FLAME_MS + SMOKE_MS + HULL_OUT_MS))).toBe(1);
    const released = { born: 0, out: 2 * (FLAME_MS + SMOKE_MS) };
    expect(hullOpacity(released, 2 * (FLAME_MS + SMOKE_MS) + HULL_OUT_MS)).toBe(0);
    expect(hullOpacity({ born: 0 }, FLAME_MS + SMOKE_MS + HULL_OUT_MS)).toBe(0);
  });
});
