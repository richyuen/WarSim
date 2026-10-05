import { expect, it } from 'vitest';
import { landPoint, maskSure } from '../../src/shared/landMask';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.11k: `coast1938.test.ts` looks at seed 99 at the start and at days 30 and 90. The
// muster that PLAN 2.9a missed put divisions in the sea later than that, and not in every
// seed: in seed 1 four British divisions stood in a water pixel at Gibraltar on day 91 (seed 99
// and seed 1938 have none in the year; seeds 3 and 7 have Japanese ones at Dalian). Here every
// formation at rest is looked at on every day of a year of seed 1.

const { w: W, h: H } = SIZE_1938;

it('seed 1, every day of a year: every formation at rest stands on sure land', () => {
  const assets = assets1938(W);
  const mask = assets.landMask!;
  const sim = new Sim({ scenario: '1938', seed: 1, assets });
  const w = sim.world;
  const f = w.formations.cols;
  const off = new Map<number, string>();
  let looks = 0;
  for (let day = 0; day <= 365; day++) {
    if (day > 0) sim.step(24);
    w.formations.forEach((id) => {
      // On the march a formation is between two cells' points; a crossing has no land to stand
      // on, nor has a cell without a land pixel in the mask (an atoll): those keep their middle.
      if (f.moving[id] === 1) return;
      const [x, y] = [f.x[id]!, f.y[id]!];
      const [cx, cy] = [Math.floor(x), Math.floor(y)];
      if (w.cells.terrain[cy * W + cx] === Terrain.Crossing || landPoint(mask, W, cx, cy, true) === null) return;
      looks++;
      if (!maskSure(mask, W, H, x, y, true) && !off.has(id)) off.set(id, `day ${day}: formation ${id} of nation ${f.nation[id]} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
    });
  }
  expect(looks).toBeGreaterThan(100_000);
  expect([...off.values()].slice(0, 6)).toEqual([]);
}, 900_000);
