import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.165 AT (critic runs 19–21, `c21_k_2203.json`: Breakthrough from Berlin toward Warsaw on
// day 1, Germany at peace, changed nothing and said nothing): God Mode's Breakthrough for a nation
// at war with no one is refused, and the God tab says why.

const { w: W, h: H } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());

test("Breakthrough for a nation at peace: refused, and the God tab says there is no front", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=2203');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect((await inspect(page)).wars.some((w) => w.attackers.includes(GER) || w.defenders.includes(GER))).toBe(false);
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-god').click();
  const corridors = (await inspect(page)).corridors;
  await page.getByTestId('god-tool-battle').click();
  const [x, y] = cellOf(17, 52.4, W, H);
  await page.evaluate(([cx, cy]) => window.__warsim!.view!.controller.set({ cx, cy, scale: 8 }), [x, y] as const);
  await page.waitForTimeout(150);
  await page.mouse.click(600, 400);
  await page.mouse.click(800, 400);
  await expect(page.getByTestId('god-refusal')).toBeVisible();
  await expect(page.getByTestId('god-refusal')).toContainText('at war with no one');
  expect((await inspect(page)).corridors).toBe(corridors);
});
