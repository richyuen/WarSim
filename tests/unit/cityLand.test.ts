import { describe, expect, it } from 'vitest';
import { coastMask, coastSure, maskBit, nearestSure } from '../../src/shared/landMask';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 7.4g1 (ADR-460): of the 1938 start's 5,757 cities, 387 were not on sure land of the fine
// mask and 140 on a water pixel of it: at T2 and T3 their dots stood in the drawn sea. The page
// draws a city at the nearest point of sure land within two cells (`nearestSure`); a city on sure
// land stays where it is.

const { w: W, h: H } = SIZE_1938;

describe('city dots on sure land (PLAN 7.4g1)', () => {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = sim.world;
  const coast = coastMask(w.landMask!, W);
  const cities: [number, number][] = [];
  w.cities.forEach((c) => cities.push([w.cities.cols.x[c]!, w.cities.cols.y[c]!]));
  const k = w.landMask!.w / W;
  const onWater = (x: number, y: number): boolean => !maskBit(w.landMask!, Math.floor(x * k) % w.landMask!.w, Math.floor(y * k));

  it('every city is on sure land where it is drawn, and none moves further than two cells', () => {
    const before = cities.filter(([x, y]) => !coastSure(coast, W, H, x, y, true));
    const water = cities.filter(([x, y]) => onWater(x, y));
    process.stderr.write(`cities ${cities.length}: not on sure land ${before.length}, on a water pixel ${water.length}\n`);
    expect(before.length, 'cities not on sure land at their own places (the case of this task)').toBeGreaterThan(100);
    let moved = 0;
    let far = 0;
    const left: string[] = [];
    for (const [x, y] of cities) {
      const [px, py] = nearestSure(coast, W, H, x, y, true);
      const d = Math.hypot(px - x, py - y);
      if (d > 0) moved++;
      far = Math.max(far, d);
      if (!coastSure(coast, W, H, px, py, true)) left.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    process.stderr.write(`moved ${moved}, the furthest ${far.toFixed(3)} cells; still not on sure land ${left.length}: ${left.slice(0, 8).join(' ')}\n`);
    expect(moved).toBe(before.length);
    expect(far).toBeLessThanOrEqual(2);
    expect(left).toEqual([]);
  });

  it('a city on sure land stays where it is', () => {
    const inland = cities.find(([x, y]) => coastSure(coast, W, H, x, y, true))!;
    expect(nearestSure(coast, W, H, inland[0], inland[1], true)).toEqual(inland);
  });
});
