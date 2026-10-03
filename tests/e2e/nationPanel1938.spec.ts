import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.31a AT: clicking a nation opens the nation panel; the Overview tab shows land, army,
// alliance and wars; the Economy tab shows income, expenses and treasury; chips select nations.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const int = (s: string | null): number => Number((s ?? '').replace('−', '-').replace(/[^0-9-]/g, ''));

test('nation panel: click a nation, read its overview and economy, follow a chip', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const panel = page.getByTestId('nation-panel');
  await expect(panel).toHaveCount(0);

  // Click Germany on the map.
  const [gx, gy] = cellOf(10.5, 51, W, H);
  await page.evaluate(({ gx, gy }) => window.__warsim!.view!.controller.set({ cx: gx, cy: gy, scale: 6 }), { gx, gy });
  await page.waitForTimeout(200);
  await page.mouse.click(700, 400);
  await expect(panel).toHaveAttribute('data-nation', String(id('GER')));
  await expect(page.getByTestId('nation-name')).toHaveText('Germany');
  expect(int(await page.getByTestId('stat-land').textContent())).toBeGreaterThan(1000);
  // Land is km², not cells (ADR-52): Germany at the start of 1938 is about 470,000 km².
  const km2 = int(await page.getByTestId('stat-land').textContent());
  expect(km2).toBeGreaterThan(400_000);
  expect(km2).toBeLessThan(560_000);
  const share = Number.parseFloat((await page.getByTestId('stat-land-share').textContent())!.replace(/[^0-9.]/g, ''));
  expect(share).toBeGreaterThan(0.2);
  expect(share).toBeLessThan(0.6);
  expect(int(await page.getByTestId('stat-army').textContent())).toBeGreaterThan(100_000);
  await expect(page.getByTestId('panel-alliance')).toContainText('Anti-Comintern Pact');
  await expect(page.getByTestId('panel-wars')).toContainText('At peace');

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.31') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'panel-overview.png') });

  // Economy tab: income and treasury are positive; balance = income − expenses.
  await page.getByTestId('tab-economy').click();
  await expect(page.getByTestId('panel-economy')).toBeVisible();
  const income = int(await page.getByTestId('stat-income').textContent());
  const expenses = int(await page.getByTestId('stat-expenses').textContent());
  expect(income).toBeGreaterThan(0);
  expect(expenses).toBeGreaterThan(0); // upkeep of a 564k-man army, known on day one
  expect(int(await page.getByTestId('stat-gold').textContent())).toBeGreaterThan(0);
  expect(Math.abs(int(await page.getByTestId('stat-balance').textContent()) - (income - expenses))).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(out, 'panel-economy.png') });

  // Spain's side is at war: its enemy chip selects the other side's leader.
  await page.getByTestId('tab-overview').click();
  await page.evaluate((s) => window.__warsim!.view!.select(s), id('NSP'));
  await expect(panel).toHaveAttribute('data-nation', String(id('NSP')));
  const chip = page.getByTestId('panel-wars').getByTestId('nation-chip').first();
  const enemy = await chip.textContent();
  await chip.click();
  await expect(page.getByTestId('nation-name')).toHaveText(enemy ?? '');
  expect(await page.evaluate(() => window.__warsim!.hud.selected.value)).not.toBe(id('NSP'));

  // Stats follow the sim: after a month of ticks the panel's date-dependent data is refreshed.
  const before = await page.evaluate(() => window.__warsim!.hud.stats.value!.tick);
  await page.evaluate(() => window.__warsim!.sim.step(24 * 3));
  await page.waitForFunction((b) => window.__warsim!.hud.stats.value!.tick > b, before, { timeout: 20_000 });

  // Close.
  await page.getByTestId('nation-close').click();
  await expect(panel).toHaveCount(0);
});
