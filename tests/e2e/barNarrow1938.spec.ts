import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.4f25 (the critic's N8, what PLAN 3.12Rh4 and 7.4f2 left): at 1024 × 600, playing a
// nation, the bar's "Playing Poland · 0 selected" was cut to its first letter (4 px of 166). It
// goes onto a line of its own in the bar, whole; the war banners stand above the taller bar. At
// 1400 px the bar is one line, as before.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const ev = path.resolve('docs/evidence/7.4');

test('a played nation\'s label goes onto a line of its own where the bar is full, whole', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(ev, { recursive: true });
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(async ([a, d]) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: a!, defender: d! });
    await sim.step(1);
  }, [GER, POL]);
  await expect(page.getByTestId('war-banner').first()).toBeVisible({ timeout: 10_000 });
  const box = (sel: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
    page.locator(sel).first().evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
  const oneLine = await box('[data-testid="bottombar"]');

  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await page.evaluate(() => window.__warsim!.hud.onSelectNation(0));
  const label = page.getByTestId('player-label');
  await expect(label).toContainText('Poland');
  // Whole: nothing of its text is cut.
  await expect.poll(() => label.evaluate((e) => e.scrollWidth - e.clientWidth), { message: 'the label\'s text cut by (px)' }).toBeLessThanOrEqual(0);
  const bar = await box('[data-testid="bottombar"]');
  const l = await box('[data-testid="player-label"]');
  const pause = await box('[data-testid="pause-btn"]');
  const date = await box('[data-testid="date-label"]');
  expect(l.top, 'the label on a line below the buttons').toBeGreaterThanOrEqual(pause.bottom);
  expect(l.top, 'and below the date').toBeGreaterThanOrEqual(date.bottom);
  expect(bar.bottom, 'the bar keeps its place at the bottom').toBeCloseTo(oneLine.bottom, 0);
  expect(bar.top, 'the bar is taller').toBeLessThan(oneLine.top - 10);
  // Every button in the view.
  for (const b of await page.locator('[data-testid="bottombar"] button').evaluateAll((es) => es.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]))) {
    expect(b[0]!, 'a button\'s left in the view').toBeGreaterThanOrEqual(0);
    expect(b[1]!, 'a button\'s right in the view').toBeLessThanOrEqual(1024);
  }
  // What stands above the bar stands above its top.
  for (const b of await page.getByTestId('war-banner').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().bottom))) expect(b, 'a war banner above the bar').toBeLessThanOrEqual(bar.top);
  const legend = page.locator('.map-legend');
  if (await legend.count()) expect((await box('.map-legend')).bottom, 'the legend above the bar').toBeLessThanOrEqual(bar.top);
  await page.screenshot({ path: path.join(ev, 'f25-bar-1024-playing.png') });

  // At 1400 px it all fits on one line: the label beside the date, the bar as tall as before.
  await page.setViewportSize({ width: 1400, height: 800 });
  await expect.poll(async () => (await box('[data-testid="player-label"]')).top - (await box('[data-testid="pause-btn"]')).bottom, { message: 'the label on the buttons\' line at 1400 px' }).toBeLessThan(0);
  const wide = await box('[data-testid="bottombar"]');
  expect(wide.bottom - wide.top, 'one line at 1400 px').toBeCloseTo(oneLine.bottom - oneLine.top, 0);
  for (const b of await page.getByTestId('war-banner').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().bottom))) expect(b, 'a war banner above the bar at 1400 px').toBeLessThanOrEqual(wide.top);
});
