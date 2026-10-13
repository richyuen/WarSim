import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 4.10c (the critic's R4-B4): the sea-control mode did not say whose a tint is. Its legend
// now lists the holders in their colours with their zones, and names the zone under the cursor
// with its holder: on the first day of 1938, Scapa Flow's water is the United Kingdom's and the
// middle of the South Pacific nobody's.

const { w: W, h: H } = SIZE_1938;

test('the sea-control legend lists the holders and names the zone under the cursor with its holder', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 2, null, { timeout: 30_000 });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('seaControl'));
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.10') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // The holders, the most zones first, the United Kingdom among them.
  const holders = page.getByTestId('sea-holder');
  await expect(holders.first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('map-legend')).toContainText('United Kingdom');
  const counts = await holders.evaluateAll((rows) => rows.map((r) => Number(/(\d+) zones/.exec(r.textContent ?? '')?.[1] ?? 0)));
  expect(counts.length).toBeGreaterThan(1);
  for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);

  // The cursor over Scapa Flow's water: the zone named, held by the United Kingdom.
  const [sx, sy] = cellOf(-2.6, 59.5, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 3 }), { x: sx, y: sy });
  await page.mouse.move(700, 400);
  await expect(page.getByTestId('sea-hover')).toContainText('held by United Kingdom', { timeout: 5000 });
  const scapa = (await page.getByTestId('sea-hover').textContent()) ?? '';
  expect(scapa.split(':')[0]!.length, 'the zone has a name').toBeGreaterThan(2);
  await page.screenshot({ path: path.join(out, 'sea-control-legend.png') });
  // The middle of the South Pacific: nobody's.
  const [px, py] = cellOf(-130, -35, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 3 }), { x: px, y: py });
  await page.mouse.move(701, 401);
  await expect(page.getByTestId('sea-hover')).toContainText('held by none', { timeout: 5000 });
});
