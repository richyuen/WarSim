import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 4.9c (the critic's R4-B2): a refused order said nothing on the screen. Switzerland, played,
// orders a division to London: it has no port, and the ticker says so within a second, as does
// the division's panel; a click on the row flies to the division and forgets the row.

const { w: W, h: H } = SIZE_1938;
const SWI = NATIONS_1938.findIndex((n) => n.tag === 'SWI') + 1;

test('a refused order says why, in the ticker and in the formation\'s panel', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((n) => window.__warsim!.view!.formationsOf(n).length > 0, SWI, { timeout: 60_000 });
  await page.evaluate((n) => window.__warsim!.view!.select(n), SWI);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('release-control')).toBeVisible();

  const div = await page.evaluate((n) => window.__warsim!.view!.formationsOf(n)[0]!, SWI);
  const [lx, ly] = cellOf(-0.12, 51.5, W, H);
  await expect(page.getByTestId('order-news')).toHaveCount(0);
  await page.evaluate(({ div, x, y, n }) => window.__warsim!.hud.command({ kind: 'moveFormation', id: div, x, y, nation: n }), { div, x: Math.floor(lx) + 0.5, y: Math.floor(ly) + 0.5, n: SWI });
  const row = page.getByTestId('order-news');
  await expect(row).toHaveCount(1, { timeout: 1000 });
  await expect(row).toContainText('no port');
  await expect(row).toHaveAttribute('data-order', 'refused');

  // The division's panel says it too.
  await page.evaluate((id) => window.__warsim!.hud.selectFormation(id), div);
  await expect(page.getByTestId('formation-notice')).toContainText('no port');
  await page.evaluate(() => window.__warsim!.hud.selectFormation(0));

  // A click flies to the division and forgets the row.
  await row.click();
  await expect(page.getByTestId('order-news')).toHaveCount(0);
  const [cx, cy] = await page.evaluate(() => [window.__warsim!.view!.controller.cam.cx, window.__warsim!.view!.controller.cam.cy]);
  const at = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), div))!;
  await expect.poll(async () => Math.hypot(...(await page.evaluate(() => [window.__warsim!.view!.controller.cam.cx, window.__warsim!.view!.controller.cam.cy])).map((v, i) => v - at[i]!) as [number, number]), { timeout: 5000 }).toBeLessThan(Math.max(2, Math.hypot(cx - at[0], cy - at[1])));
});
