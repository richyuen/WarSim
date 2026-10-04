import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.27 AT: autosave → reload → continue. The worker's state is gzipped into IndexedDB,
// a reload with ?continue=1 restores it, and stepping on gives the same hash as Node running
// the same seed uninterrupted.

test('autosave to IndexedDB, reload with ?continue=1 and continue', async ({ page }) => {
  test.setTimeout(120_000);
  const url = '/?scenario=1938&paused=1&seed=1938';
  await page.goto(url);
  await page.waitForFunction(() => (window.__warsim?.hud.worker.value ?? null) !== null, null, { timeout: 60_000 });
  const stepped = await page.evaluate(() => window.__warsim!.sim.step(72));
  const savedTick = await page.evaluate(() => window.__warsim!.autosave.saveNow());
  expect(savedTick).toBe(72);
  const rec = await page.evaluate(async () => {
    const r = await window.__warsim!.autosave.read();
    return r ? { tick: r.tick, scenario: r.scenario, size: r.bytes.length, gzip: r.bytes[0] === 0x1f && r.bytes[1] === 0x8b } : null;
  });
  expect(rec).toMatchObject({ tick: 72, scenario: '1938', gzip: true });

  // A fresh page (new worker) resumes from the autosave.
  await page.goto(`${url}&continue=1`);
  await page.waitForFunction(() => (window.__warsim?.hud.worker.value ?? null) !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.hud.tick.value === 72, null, { timeout: 30_000 });
  const resumed = await page.evaluate(() => window.__warsim!.sim.hash());
  expect(resumed).toEqual(stepped);

  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  node.step(72 + 48);
  const continued = await page.evaluate(() => window.__warsim!.sim.step(48));
  expect(continued.hash).toBe(node.hash());
});
