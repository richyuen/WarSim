import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NUKE_ALERT_HOURS, NUKE_ALERT_MIN_MS } from '../../src/shared/nukeAlert';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 6.6a: God Mode's strike, through its map tool; the alert banner, its "go to" button and the
// auto-pause option. A bomb on Berlin from the God tab while the game runs: the banner tells it and
// the game pauses; "Go to" brings the camera back; with the option off a second strike shows its
// banner and the game runs on.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

async function lookAt(page: Page, lon: number, lat: number, scale = 8): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale }), { x, y, scale });
  await page.waitForTimeout(150);
}
const paused = (page: Page): Promise<boolean> => page.evaluate(() => window.__warsim!.hud.paused.value);
const running = (page: Page): Promise<void> => page.evaluate(() => (window.__warsim!.hud.paused.value ? window.__warsim!.hud.togglePause() : undefined));

test('God Mode\'s strike: the alert banner, its go-to and the auto-pause option', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/6.6') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // God Mode on, Germany selected, the God tab.
  await page.getByTestId('god-btn').click();
  await lookAt(page, 10.5, 51);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(id('GER')));
  await page.getByTestId('tab-god').click();
  await expect(page.getByTestId('nuke-alert')).toHaveCount(0);

  // The game runs; the God tool's bomb on Berlin.
  await running(page);
  expect(await paused(page)).toBe(false);
  await page.getByTestId('god-tool-nuke').click();
  await expect(page.getByTestId('god-tool-hint')).toBeVisible();
  await lookAt(page, 13.4, 52.52);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nuke-alert')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('nuke-alert-text')).toHaveText(/^A bomb fell from the heavens on Germany near Berlin: an atomic bomb, [\d,]+ civilians killed; (?:no troops in the blast|[\d,]+ m[ae]n(?:, [\d,]+ guns?)?(?: and [\d,]+ (?:guns?|tanks?))? lost)$/);
  await expect.poll(() => paused(page), { message: 'the strike paused the game' }).toBe(true);
  await expect(page.getByTestId('god-tool-hint')).toHaveCount(0); // one-shot tool
  await page.screenshot({ path: path.join(out, 'nuke-alert.png') });

  // Go to: from Madrid back to Berlin.
  await lookAt(page, -3.7, 40.42, 3);
  await page.getByTestId('nuke-goto').click();
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  // The camera at Berlin, within a few cells (the view may keep clear of an open panel).
  await expect
    .poll(() => page.evaluate(({ bx, by }) => Math.hypot(window.__warsim!.view!.controller.cam.cx - bx, window.__warsim!.view!.controller.cam.cy - by), { bx, by }), { timeout: 10_000 })
    .toBeLessThan(3);
  await page.getByTestId('nuke-close').click();
  await expect(page.getByTestId('nuke-alert')).toHaveCount(0);

  // The option off: a strike on Warsaw shows its banner and the game runs on.
  await page.getByTestId('settings-btn').click();
  await page.getByTestId('settings-nuke-pause').uncheck();
  await page.getByTestId('settings-btn').click();
  await running(page);
  await page.getByTestId('god-tool-nuke').click();
  await lookAt(page, 21.01, 52.23);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nuke-alert-text')).toHaveText(/on Poland/, { timeout: 15_000 });
  expect(await paused(page)).toBe(false);
  await expect(page.getByTestId('settings-nuke-pause')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('warsim.nukePause'))).toBe('0');
});

// PLAN 7.25d (the critic's run 8): the alert stood 10 days and over the headers of History and
// Charts. The panels of the centre stand below it; it goes once its strike is NUKE_ALERT_HOURS old
// and it has been shown NUKE_ALERT_MIN_MS; while the game is paused it stays.
test('the alert: the panels of the centre below it; it goes after its days, not while paused', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.25') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const box = (testid: string): Promise<{ top: number; bottom: number }> =>
    page.evaluate((testid) => {
      const r = document.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }, testid);

  // A bomb on Paris, the game paused: the alert, and it stands.
  await page.getByTestId('god-btn').click();
  await page.getByTestId('god-tool-nuke').click();
  await lookAt(page, 2.35, 48.86);
  await page.mouse.click(700, 400);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect(page.getByTestId('nuke-alert')).toBeVisible({ timeout: 15_000 });
  expect(await paused(page)).toBe(true);

  // History, then Charts: each panel's top below the alert's bottom.
  await page.getByTestId('history-btn').click();
  await expect(page.getByTestId('history-panel')).toBeVisible();
  const alert = await box('nuke-alert');
  expect((await box('history-panel')).top, 'History below the alert').toBeGreaterThanOrEqual(alert.bottom);
  await page.screenshot({ path: path.join(out, 'd-alert-history.png') });
  await page.getByTestId('history-btn').click();
  await page.getByTestId('ranking-charts').click();
  await expect(page.getByTestId('stats-chart')).toBeVisible();
  expect((await box('stats-chart')).top, 'Charts below the alert').toBeGreaterThanOrEqual(alert.bottom);
  await page.screenshot({ path: path.join(out, 'd-alert-charts.png') });
  await page.getByTestId('chart-close').click();

  // Paused for more than its seconds: it stays.
  await page.waitForTimeout(NUKE_ALERT_MIN_MS + 500);
  await expect(page.getByTestId('nuke-alert')).toBeVisible();
  // Run: it goes, with the strike at least its hours old.
  const struck = await page.evaluate(() => window.__warsim!.hud.nukeAlert.value!.tick);
  await running(page);
  await expect(page.getByTestId('nuke-alert')).toHaveCount(0, { timeout: 120_000 });
  const tick = await page.evaluate(() => window.__warsim!.hud.stats.value!.tick);
  expect(tick - struck, 'gone after its hours').toBeGreaterThanOrEqual(NUKE_ALERT_HOURS);
});
