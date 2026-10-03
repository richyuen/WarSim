import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { CHART_METRICS } from '../../src/shared/statSeries';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.34b AT (e2e part): the chart renders the selected nations: the top 5 of the metric at
// the latest sample plus the nation selected on the map, one line each with one point a month (from the first tick).

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

test('statistics charts: top nations plus the selected one, every metric', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => window.__warsim?.hud.stats.value !== null && window.__warsim?.hud.stats.value !== undefined, null, { timeout: 60_000 });
  const ranking = page.getByTestId('stats-ranking');
  if ((await ranking.count()) === 0) await page.getByTestId('stats-btn').click();

  // Before the first month: no samples, the chart says so.
  await page.getByTestId('ranking-charts').click();
  await expect(page.getByTestId('chart-empty')).toBeVisible();

  // Three months on, with Poland selected.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 92));
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  const lines = page.getByTestId('chart-line');
  await expect.poll(() => lines.count(), { timeout: 20_000 }).toBe(6);
  const nations = await lines.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-nation'))));
  expect(nations).toContain(POL);
  const rows = await page.evaluate(() => window.__warsim!.sim.statSeries().then((r) => Array.from(r)));
  // The first five lines are the top 5 by land at the latest sample.
  const last = Math.max(...rows.filter((_, i) => i % 7 === 0));
  const top = [] as [number, number][];
  for (let i = 0; i < rows.length; i += 7) if (rows[i] === last) top.push([rows[i + 1]!, rows[i + 2]!]);
  top.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  expect(nations.slice(0, 5)).toEqual(top.slice(0, 5).map((x) => x[0]));
  // 92 days from 1 January sample 1 Jan (the first tick), 1 Feb, 1 Mar and 1 Apr.
  for (const n of await lines.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-points'))))) expect(n).toBe(4);
  await expect(page.locator('.chart-line.selected')).toHaveAttribute('data-nation', String(POL));
  await expect(page.getByTestId('chart-legend')).toHaveCount(6);
  await expect(page.getByTestId('chart-legend').filter({ hasText: 'Poland' })).toHaveCount(1);

  // Every metric renders lines (casualties: Spain and China are at war from the start).
  for (const m of CHART_METRICS) {
    await page.getByTestId('chart-metric').selectOption(m);
    await expect(page.getByTestId('stats-chart')).toHaveAttribute('data-metric', m);
    expect(await lines.count()).toBeGreaterThanOrEqual(5);
  }

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.34') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.getByTestId('chart-metric').selectOption('men');
  await page.screenshot({ path: path.join(out, 'charts.png') });
  await page.getByTestId('chart-close').click();
  await expect(page.getByTestId('stats-chart')).toHaveCount(0);
});
