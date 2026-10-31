import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.165 AT (critic runs 19–21, `c21_q_6421.json`: a God revolt in Bavaria read "Germany
// declared war on Free Saxony" in the ticker): a revolt is told as a revolt, and the war its
// holder declares on the rebels in that hour is not told as a war declared.

const { w: W, h: H } = SIZE_1938;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());

test('a God revolt in Poland: one ticker row of the revolt, none of a war declared on the rebels', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=6421');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), POL);
  await page.getByTestId('tab-god').click();
  const before = await inspect(page);
  await page.getByTestId('god-tool-revolt').click();
  const [x, y] = cellOf(21.0, 52.23, W, H);
  await page.evaluate(([cx, cy]) => window.__warsim!.view!.controller.set({ cx, cy, scale: 8 }), [x, y] as const);
  await page.waitForTimeout(150);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).nations.filter((n) => n.living && !before.nations.some((b) => b.id === n.id && b.living)).length).toBe(1);
  // The ticker's rows arrive with the next statistics message: a day stepped.
  await page.evaluate(() => window.__warsim!.sim.step(24));
  const revolt = page.locator('[data-testid=ticker-row][data-kind-name=RevoltSpawned]');
  await expect(revolt).toHaveCount(1);
  await expect(revolt).toContainText('broke away from Poland');
  await expect(page.locator('[data-testid=ticker-row][data-kind-name=WarDeclared]', { hasText: 'Poland declared war on' })).toHaveCount(0);
});
