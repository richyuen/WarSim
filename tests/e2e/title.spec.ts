import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.43a AT (critic B5): `/` shows the title screen and no world; choosing 1938 starts it on
// 1 January 1938 with the chosen seed and options; the settings panel leads back, saving the game;
// the toy world opens by its URL.

const evidence = (info: { outputPath: () => string }): string => {
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.43') : info.outputPath();
  mkdirSync(out, { recursive: true });
  return out;
};
const ready = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });

test('/ opens the title screen and no world', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/');
  await expect(page).toHaveTitle('WarSim');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('app-title')).toHaveText('WarSim');

  // No world behind it: no sim worker, no map canvas, no HUD, no test API of a game.
  expect(page.workers()).toHaveLength(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('bottombar')).toHaveCount(0);
  expect(await page.evaluate(() => window.__warsim === undefined)).toBe(true);

  // The scenario list: the 1938 world first and chosen; the toy world is not offered.
  const items = page.locator('[data-testid^="title-scenario-"]');
  await expect(items.first()).toHaveAttribute('data-testid', 'title-scenario-1938');
  await expect(items.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(items.first()).toContainText('World, 1938');
  await expect(page.getByTestId('title-scenario-toy')).toHaveCount(0);
  await expect(page.getByTestId('title-chosen')).toHaveText('World, 1938');
  await expect(page.getByTestId('title-start-date')).toHaveText('1 January 1938');
  // The new-game form of PLAN 1.39b1, with a seed already in it.
  expect(await page.getByTestId('settings-seed').inputValue()).toMatch(/^\d+$/);
  for (const id of ['opt-looping', 'opt-aggression', 'opt-traits', 'opt-gold', 'opt-ce']) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId('settings-new-game')).toHaveText('Start');
  await page.screenshot({ path: path.join(evidence(info), 'title.png') });

  // The texts go through i18n: the pseudo-locale changes them.
  await page.getByTestId('locale-select').selectOption('qps');
  await expect(page.getByTestId('settings-new-game')).toHaveText(/^⟦Šţåŕţ·+⟧$/);
  await page.getByTestId('locale-select').selectOption('en');

  // A phone-sized window: one column, nothing cut off sideways, Start reachable.
  await page.setViewportSize({ width: 420, height: 800 });
  expect(await page.evaluate(() => document.querySelector('[data-testid=title-screen]')!.scrollWidth <= window.innerWidth)).toBe(true);
  const list = (await page.getByTestId('title-scenario-1938').boundingBox())!;
  const detail = (await page.getByTestId('title-detail').boundingBox())!;
  expect(detail.y).toBeGreaterThan(list.y + list.height);
  await page.getByTestId('settings-new-game').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('settings-new-game')).toBeInViewport();
  await page.screenshot({ path: path.join(evidence(info), 'title-narrow.png') });
  await page.setViewportSize({ width: 1400, height: 800 });

  // An unknown scenario in the URL is the title screen too, and the persisted interface size
  // applies to it.
  await page.evaluate(() => localStorage.setItem('warsim.uiScale', '1.3'));
  await page.goto('/?scenario=1939');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(page.workers()).toHaveLength(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');
  expect(errors).toEqual([]);
});

test('the title screen starts the 1938 world with the chosen seed and options; Main menu saves and leads back', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/');
  await page.getByTestId('title-scenario-1938').click();
  await page.getByTestId('settings-seed').fill('4242');
  await page.getByTestId('opt-looping').selectOption('off');
  await page.getByTestId('opt-gold').selectOption('equal');
  await page.getByTestId('opt-ce').selectOption('static');
  await page.screenshot({ path: path.join(evidence(info), 'title-options.png') });
  await Promise.all([page.waitForURL(/scenario=1938/), page.getByTestId('settings-new-game').click()]);
  for (const p of ['seed=4242', 'looping=0', 'gold=equal', 'ce=static']) expect(page.url()).toContain(p);
  await ready(page);
  await expect(page.getByTestId('title-screen')).toHaveCount(0);

  // 1 January 1938, paused, and exactly the world Node builds from that seed and those options.
  await expect(page.getByTestId('date-label')).toContainText('1 January 1938');
  const s: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect());
  expect(s.tick).toBe(0);
  expect(s.seed).toBe(4242);
  expect(s.settings.loopingMap).toBe(false);
  expect(s.settings.ceMode).toBe('static');
  const node = new Sim({ scenario: '1938', seed: 4242, options: { loopingMap: false, gold: 'equal', ceMode: 'static' }, assets: assets1938(SIZE_1938.w) });
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).toBe(node.hash());
  await page.waitForTimeout(500); // let the first frames draw
  await page.screenshot({ path: path.join(evidence(info), 'started-1938.png') });

  // Settings → Main menu: the game is autosaved, then the title screen is back.
  await page.evaluate(() => window.__warsim!.sim.step(48));
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-current-seed')).toContainText('4242');
  await page.screenshot({ path: path.join(evidence(info), 'settings-panel.png') });
  await Promise.all([page.waitForURL((u) => u.search === ''), page.getByTestId('settings-menu').click()]);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const saved = await page.evaluate(
    () =>
      new Promise<{ scenario: string; tick: number } | null>((resolve, reject) => {
        const open = indexedDB.open('warsim', 1);
        open.onerror = () => reject(open.error ?? new Error('indexedDB open failed'));
        open.onsuccess = () => {
          const get = open.result.transaction('saves', 'readonly').objectStore('saves').get('autosave');
          get.onerror = () => reject(get.error ?? new Error('indexedDB get failed'));
          get.onsuccess = () => {
            const r = get.result as { scenario: string; tick: number } | undefined;
            resolve(r ? { scenario: r.scenario, tick: r.tick } : null);
          };
        };
      }),
  );
  expect(saved).toEqual({ scenario: '1938', tick: 48 });
  expect(errors).toEqual([]);
});

test('the toy world opens by its URL', async ({ page }) => {
  await page.goto('/?scenario=toy&paused=1&seed=7');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.worker.value !== null, null, { timeout: 60_000 });
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
  await expect(page.locator('canvas#map')).toBeVisible();
  await expect(page.getByTestId('date-label')).toContainText('1 January 1938');
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).toBe(new Sim({ scenario: 'toy', seed: 7 }).hash());
});
