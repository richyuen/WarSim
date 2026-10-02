import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { Sim } from '../../src/sim/sim';

// PLAN 0.13 in the real browser: rAF-acked snapshot flow from the sim worker, and
// invariant I4 (subscription churn never changes sim state) across the worker boundary.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__warsim !== undefined);
});

test('I4 in the worker: subscription churn while stepping gives the Node hash', async ({ page }) => {
  const status = await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.init({ scenario: 'toy', seed: 5 });
    let s = 12345;
    const rnd = (): number => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 100; i++) {
      const x0 = rnd() * 512 - 256;
      sim.subscribe({ bbox: [x0, rnd() * 128, x0 + rnd() * 400, 128], z: rnd() * 20, tier: 1, wantsElements: rnd() < 0.5 });
      await sim.step(7);
    }
    return sim.hash();
  });
  const node = new Sim({ scenario: 'toy', seed: 5 });
  node.step(700);
  expect(status).toEqual({ tick: 700, hash: node.hash() });
});

test('running at max speed streams acked snapshots in order', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.init({ scenario: 'toy', seed: 6 });
    const seqs: number[] = [];
    const ticks: number[] = [];
    let tiles = 0;
    const off = sim.onSnapshotReceived((snap) => {
      seqs.push(snap.seq);
      ticks.push(snap.tick);
      tiles += snap.tiles.count;
    });
    sim.setSpeed('max');
    sim.setPaused(false);
    await new Promise((r) => setTimeout(r, 1500));
    sim.setPaused(true);
    const status = await sim.hash();
    off();
    return { seqs, ticks, tiles, status };
  });
  expect(result.seqs.length).toBeGreaterThan(20);
  // Each snapshot is the successor of the last acked one: no duplicates, no reordering.
  result.seqs.forEach((s, i) => i > 0 && expect(s).toBe(result.seqs[i - 1]! + 1));
  result.ticks.forEach((t, i) => i > 0 && expect(t).toBeGreaterThanOrEqual(result.ticks[i - 1]!));
  expect(result.tiles).toBeGreaterThan(8); // initial full sync + changed tiles
  expect(result.status.tick).toBeGreaterThan(500);

  const node = new Sim({ scenario: 'toy', seed: 6 });
  node.step(result.status.tick);
  expect(result.status.hash).toBe(node.hash());
});
