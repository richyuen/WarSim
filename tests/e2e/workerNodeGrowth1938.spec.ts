import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.12 (the critic's R2-B4): the worker's state hash left Node's with the step after
// nation 128 was founded, and a game continued in the browser had another hash than the game
// that was saved, from years in which nation 128 was there. That nation was the one whose row
// made the nations table grow: it was founded dead, and its militia stood at (NaN, NaN). A NaN
// that comes out of arithmetic has bits of its own; they are in the state, in the save and in
// the hash.
//
// Here the table is made to grow in the first minutes of a game: revolts by command, the same
// in a real browser worker and in Node, across the growth and beyond it. Then the game is
// saved, continued on a fresh page, and goes on as Node's.

const W = SIZE_1938.w;

test('the worker goes as Node across the growth of the nations table, and a continued game as the saved one', async ({ page }) => {
  test.setTimeout(240_000);
  const url = '/?scenario=1938&paused=1&seed=1938&view=0';
  await page.goto(url);
  await page.waitForFunction(() => (window.__warsim?.hud.worker.value ?? null) !== null, null, { timeout: 60_000 });
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).toBe(node.hash());

  const cap0 = node.world.nations.capacity;
  let province = 1;
  let grownAt = 0;
  // Twenty provinces to a tick, until the table has grown and three nations more are founded.
  while (node.world.nations.highWater < cap0 + 3) {
    expect(province, 'provinces left to revolt').toBeLessThan(node.world.provinces.count);
    const cmds: Command[] = Array.from({ length: 20 }, () => ({ kind: 'spawnRevolt', province: province++ }));
    const cap = node.world.nations.capacity;
    for (const c of cmds) node.command(c);
    node.step(1);
    if (node.world.nations.capacity !== cap) grownAt = node.world.tick;
    const worker = await page.evaluate(async (cs) => {
      const sim = window.__warsim!.sim;
      for (const c of cs) sim.command(c);
      return sim.step(1);
    }, cmds);
    expect(worker.hash, `tick ${node.world.tick}: revolts up to province ${province - 1}, nations up to ${node.world.nations.highWater - 1}${grownAt === node.world.tick ? ', the table grew' : ''}`).toBe(node.hash());
  }
  expect(grownAt, 'the tick in which the table grew').toBeGreaterThan(0);
  console.log(`the nations table grew from ${cap0} to ${node.world.nations.capacity} in tick ${grownAt}; ${node.world.nations.count} nations after ${province - 1} provinces`);

  // A day on, the same.
  node.step(24);
  const day = await page.evaluate(() => window.__warsim!.sim.step(24));
  expect(day.hash, 'a day on').toBe(node.hash());

  // Saved, and continued on a fresh page (a new worker): the saved game's hash from its first
  // moment, and Node's two days later, with more revolts on the way.
  const tick = node.world.tick;
  await page.evaluate(() => window.__warsim!.autosave.saveNow());
  await page.goto(`${url}&continue=1`);
  await page.waitForFunction(() => (window.__warsim?.hud.worker.value ?? null) !== null, null, { timeout: 60_000 });
  await page.waitForFunction((t) => window.__warsim!.hud.tick.value === t, tick, { timeout: 30_000 });
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash, 'continued: the first moment').toBe(node.hash());
  const more: Command[] = Array.from({ length: 20 }, (_, i) => ({ kind: 'spawnRevolt', province: province + i }));
  const before = node.world.nations.highWater;
  for (const c of more) node.command(c);
  node.step(48);
  expect(node.world.nations.highWater, 'nations founded after the load').toBeGreaterThan(before);
  const later = await page.evaluate(async (cs) => {
    const sim = window.__warsim!.sim;
    for (const c of cs) sim.command(c);
    return sim.step(48);
  }, more);
  expect(later.hash, 'continued: two days on, with nations founded since').toBe(node.hash());
});
