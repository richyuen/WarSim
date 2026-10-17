import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.16d (critic run 7, UI 7: "on the phone the nuke alert covers the nation panel"): at a
// phone's 390 × 844 with Germany's panel open, a burst's alert stands on the bottom bar, clear of the
// panel, inside the view.

const { w: W, h: H } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;

test("on a phone the nuclear alert does not cover the nation panel", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate((g) => window.__warsim!.view!.select(g), GER);
  await expect(page.getByTestId('nation-panel')).toBeVisible();
  const [x, y] = cellOf(13.4, 52.52, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.sim.command({ kind: 'godNuke', x, y, thermonuclear: false }, true), { x, y });
  await expect(page.getByTestId('nuke-alert')).toBeVisible({ timeout: 15_000 });
  const alert = (await page.getByTestId('nuke-alert').boundingBox())!;
  const panel = (await page.getByTestId('nation-panel').boundingBox())!;
  const bar = (await page.getByTestId('bottombar').boundingBox())!;
  const overlap = Math.max(0, Math.min(alert.y + alert.height, panel.y + panel.height) - Math.max(alert.y, panel.y)) * Math.max(0, Math.min(alert.x + alert.width, panel.x + panel.width) - Math.max(alert.x, panel.x));
  console.log(`alert ${JSON.stringify(alert)}, panel ${JSON.stringify(panel)}, bar ${JSON.stringify(bar)}`);
  // Beside the panel at most where the panel runs down to the bar; on the bar's top, inside the view.
  expect(alert.y + alert.height).toBeLessThanOrEqual(bar.y + 1);
  expect(alert.x).toBeGreaterThanOrEqual(0);
  expect(alert.x + alert.width).toBeLessThanOrEqual(390);
  expect(alert.y).toBeGreaterThan(panel.y + 100);
  await page.screenshot({ path: path.resolve('docs/evidence/7.16/d-phone-alert.png') });
  expect(overlap, 'the alert over the panel (px²)').toBe(0);
});
