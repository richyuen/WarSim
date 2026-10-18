import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.3: the interest-managed element path. At T2 the view subscribes with its padded bbox
// and gets the elements of exactly the formations inside it; each element sits at its slot by
// its formation and the element strengths add up to the formation's. At T1 the same, without
// their fire (PLAN 7.21c1, ADR-498: a T1 marker shows its elements; before, none were sent at
// T1); at T0 none. Subscription churn with elements never changes the sim (I4, 1938 with
// elements).

const { w: W, h: H } = SIZE_1938;

async function look(page: Page, lon: number, lat: number, mPerPx: number): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
}

/** Waits for the elements of a snapshot subscribed at `tier`, sent to the view at `mPerPx` (the elements of T1 are in hand before T2's). */
async function arrived(page: Page, tier: number, mPerPx: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(({ tier, m }) => {
      const v = window.__warsim!.view!;
      return v.subscription?.tier === tier && Math.abs(v.elementsZoom / m - 1) < 0.01 && v.elementCount > 20;
    }, { tier, m: mPerPx }), { timeout: 15_000 })
    .toBe(true);
}

/** The elements in hand are exactly those of the formations in the subscribed box, each by its formation. */
async function exactly(page: Page, tier: number): Promise<void> {
  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    return { sub: v.subscription!, f: Array.from(v.elementFormation), x: Array.from(v.elementX), y: Array.from(v.elementY), truncated: v.elementTruncated };
  });
  expect(got.sub.tier).toBe(tier);
  expect(got.sub.wantsElements).toBe(true);
  expect(got.truncated).toBe(false);
  const full = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  const [x0, y0, x1, y1] = got.sub.bbox;
  // A wing's elements are not drawn (PLAN 5.1d, 5.8w3): the land's and the sea's are.
  const inside = full.formations.filter((f) => !f.wing && f.elements > 0 && f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1);
  // The formations in the bbox, with all of their elements; besides them only those whose block
  // reaches into it from just outside (the worker sends by the block: PLAN 2.7n1).
  const per = new Map<number, number>();
  got.f.forEach((f) => per.set(f, (per.get(f) ?? 0) + 1));
  for (const f of inside) expect(per.get(f.id), `formation ${f.id}`).toBe(f.elements);
  const byId = new Map(full.formations.map((f) => [f.id, f]));
  const reach = 0.03 * 6;
  const off = [...per.keys()].filter((id) => !inside.some((f) => f.id === id)).map((id) => byId.get(id)!).filter((f) => f.x < x0 - reach || f.x > x1 + reach || f.y < y0 - reach || f.y > y1 + reach);
  expect(off.map((f) => f.id)).toEqual([]);
  for (const id of per.keys()) expect(per.get(id), `formation ${id}`).toBe(byId.get(id)!.elements);
  // Each element stands by its formation (a block of slots 0.03 cells apart).
  for (let i = 0; i < got.f.length; i++) {
    const f = byId.get(got.f[i]!)!;
    expect(Math.hypot(got.x[i]! - f.x, got.y[i]! - f.y)).toBeLessThan(0.03 * 6);
  }
}

test('elements: interest-managed, at their formations, strengths add up; at T1 too, none at T0', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });

  // T0 over Poland: no elements.
  await look(page, 21, 52.2, 3000);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.subscription?.tier)).toBe(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__warsim!.view!.elementCount)).toBe(0);

  // T1 over Poland: the elements of the formations in the box, as at T2.
  await look(page, 21, 52.2, 1000);
  await arrived(page, 1, 1000);
  await exactly(page, 1);

  // T2 at Warsaw.
  await look(page, 21.0, 52.23, 120);
  await arrived(page, 2, 120);
  await exactly(page, 2);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.3') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'elements-warsaw-120m.png') });
  await look(page, 21.0, 52.23, 40);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'elements-warsaw-40m.png') });

  // Back to T0: the next snapshot carries no elements.
  await look(page, 21, 52.2, 3000);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.elementCount)).toBe(0);
});

test('I4 with elements: 1938 subscription churn at T2 while stepping gives the Node hash', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?scenario=toy&paused=1&view=0');
  await page.waitForFunction(() => window.__warsim !== undefined);
  const status = await page.evaluate(async ({ w, h }) => {
    const sim = window.__warsim!.sim;
    await sim.init({ scenario: '1938', seed: 1938 });
    let s = 4242;
    const rnd = (): number => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 40; i++) {
      const x0 = rnd() * w;
      const y0 = rnd() * h;
      const tiers = [1, 1.5, 2, 3] as const;
      sim.subscribe({ bbox: [x0, y0, x0 + rnd() * 200, y0 + rnd() * 120], z: rnd() * 20, tier: tiers[Math.floor(rnd() * 4)]!, wantsElements: rnd() < 0.8 });
      await sim.step(6);
    }
    return sim.hash();
  }, { w: W, h: H });
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  node.step(240);
  expect(status).toEqual({ tick: 240, hash: node.hash() });
});
