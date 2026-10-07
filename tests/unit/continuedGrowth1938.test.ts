import { expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 3.5f: the game of `workerNodeGrowth1938.spec.ts` in Node alone. Revolts by command until
// the nations table has grown, a day, a save; the save is loaded into another Sim, and both go
// on for two days with more revolts on the way. The spec found the page's hash apart from
// Node's at tick 73 (the full e2e of PLAN 3.5e). It was not the save: in Node the continued game
// is the saved one, and the page left Node without a save too. A history row of that hour held
// `undefined` (a peace signed by nobody, `war.test.ts`), which a Float64Array takes as a NaN
// with other bits in Chromium than in Node. So: every number of the history is a number.

it('a game continued from a save goes as the saved one, with nations founded before and after (1938, seed 1938)', () => {
  const W = SIZE_1938.w;
  const a = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const cap0 = a.world.nations.capacity;
  let province = 1;
  while (a.world.nations.highWater < cap0 + 3) {
    expect(province, 'provinces left to revolt').toBeLessThan(a.world.provinces.count);
    for (let i = 0; i < 20; i++) a.command({ kind: 'spawnRevolt', province: province++ });
    a.step(1);
  }
  a.step(24);

  const b = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  b.load(a.save());
  expect(b.hash(), 'loaded: the first moment').toBe(a.hash());
  const more: Command[] = Array.from({ length: 20 }, (_, i) => ({ kind: 'spawnRevolt', province: province + i }));
  const before = a.world.nations.highWater;
  for (const c of more) {
    a.command(c);
    b.command(c);
  }
  let apart = 0;
  for (let h = 1; h <= 48 && apart === 0; h++) {
    a.step(1);
    b.step(1);
    if (b.hash() !== a.hash()) apart = h;
  }
  expect(a.world.nations.highWater, 'nations founded after the load').toBeGreaterThan(before);
  expect(apart, 'the first hour after the load at which the two games have another hash').toBe(0);
  expect(a.world.tick).toBeGreaterThanOrEqual(73);
  const rows = a.world.history.rows as readonly unknown[];
  const notNumbers: string[] = [];
  for (let i = 0; i < rows.length; i++) if (typeof rows[i] !== 'number') notNumbers.push(`row ${Math.floor(i / HISTORY_STRIDE)} (tick ${String(rows[i - (i % HISTORY_STRIDE)])}, kind ${String(rows[i - (i % HISTORY_STRIDE) + 1])}), field ${i % HISTORY_STRIDE}: ${String(rows[i])}`);
  expect(notNumbers).toEqual([]);
}, 300_000);
