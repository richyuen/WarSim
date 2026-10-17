import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.12 (critic run 7, stats 7: "add warheads, nuclear dead and fallout to the panel and the
// charts"): a God Mode warhead on Warsaw, then the month's sample: the chart of the nuclear dead
// has Poland first, and Poland's panel says its dead and its land under fallout.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const { w: W, h: H } = SIZE_1938;

test("the nuclear age in the statistics: a burst's dead in the chart and in the panel", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [wx, wy] = cellOf(21.01, 52.23, W, H);
  await page.evaluate(async ({ x, y }) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'godNuke', x, y, thermonuclear: false });
    // Past the next month's sample.
    const tick = (await sim.step(24 * 32)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { x: wx, y: wy });
  // The chart of the nuclear dead: Poland first.
  const ranking = page.getByTestId('stats-ranking');
  if ((await ranking.count()) === 0) await page.getByTestId('stats-btn').click();
  await page.getByTestId('ranking-charts').click();
  await page.getByTestId('chart-metric').selectOption('nukeDead');
  await expect(page.getByTestId('stats-chart')).toHaveAttribute('data-metric', 'nukeDead');
  await expect(page.getByTestId('chart-legend').first()).toContainText('Poland');
  await page.screenshot({ path: path.resolve('docs/evidence/7.12/chart-nuke-dead.png') });
  // Poland's panel: its dead and its land under fallout.
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await expect(page.getByTestId('panel-nuclear')).toBeVisible({ timeout: 10_000 });
  const dead = await page.getByTestId('stat-nuke-dead').innerText();
  const fallout = await page.getByTestId('stat-fallout').innerText();
  console.log(`Poland's panel: dead "${dead}", under fallout "${fallout}"`);
  expect(Number(dead.replace(/\D/g, ''))).toBeGreaterThan(1000);
  expect(Number(fallout.replace(/\D/g, ''))).toBeGreaterThan(0);
  await page.getByTestId('panel-nuclear').screenshot({ path: path.resolve('docs/evidence/7.12/panel-nuclear.png') });
});
