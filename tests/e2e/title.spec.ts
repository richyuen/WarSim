import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { encodeScenarioFile, SCENARIO_FORMAT } from '../../src/shared/scenarioFile';
import { SCENARIO_INFO } from '../../src/shared/scenarios';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.43a AT (critic B5): `/` shows the title screen and no world; choosing 1938 starts it on
// 1 January 1938 with the chosen seed and options; the settings panel leads back, saving the game;
// the toy world opens by its URL.
// PLAN 1.43b AT: Continue resumes the autosave at its tick, a game without a looping map resumes
// without one, and there is no Continue without an autosave; a scenario file chosen on the title
// screen starts its base scenario with the file's state hash; a file that does not fit is refused.

// PLAN 1.43c AT: the preview shows the scenario's nations in their colours at known places, and
// the nation count equals the sim's.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const rgbOf = (hex: string): number[] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

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
  // The chosen scenario's map (PLAN 1.43c): an image of its start, with nations in their colours
  // at known places and the sea between them; and how many nations there are.
  const preview = page.getByTestId('title-preview');
  await expect(preview).toHaveAttribute('alt', 'Political map of World, 1938');
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => (img.complete ? [img.naturalWidth, img.naturalHeight] : null))).toEqual([1024, 512]);
  const places = [
    { tag: 'SOV', lon: 60, lat: 60 },
    { tag: 'USA', lon: -100, lat: 40 },
    { tag: 'BRA', lon: -52, lat: -10 },
    { tag: 'AST', lon: 134, lat: -25 },
    { tag: '', lon: -40, lat: 30 }, // mid-Atlantic
  ];
  const cells = places.map((p) => cellOf(p.lon, p.lat, 1024, 512).map(Math.floor));
  const seen = await preview.evaluate((img: HTMLImageElement, at: number[][]) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return at.map(([x, y]) => Array.from(ctx.getImageData(x!, y!, 1, 1).data.subarray(0, 3)));
  }, cells);
  places.forEach((p, i) => expect(seen[i], p.tag || 'sea').toEqual(p.tag ? rgbOf(NATIONS_1938.find((n) => n.tag === p.tag)!.color) : [0x1d, 0x35, 0x57]));
  await expect(page.getByTestId('title-nations')).toHaveText(String(SCENARIO_INFO['1938'].nations));
  await expect(page.getByTestId('title-map')).toHaveText('Earth · 2048 × 1024');
  // It is drawn at a size worth looking at, and Start is on the screen without scrolling.
  expect((await preview.boundingBox())!.width).toBeGreaterThan(450);
  await expect(page.getByTestId('settings-new-game')).toBeInViewport({ ratio: 1 });

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
  const nations = Number(await page.getByTestId('title-nations').textContent());
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
  expect(s.nations.filter((n) => n.living).length).toBe(nations); // the count the title screen showed
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

test('Continue resumes the autosave with the seed and options of its game', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/');
  // Nothing saved yet: no Continue.
  await expect(page.getByTestId('title-screen')).toHaveAttribute('data-save', 'none');
  await expect(page.getByTestId('title-continue')).toHaveCount(0);

  // A game without a looping map, left after three days.
  await page.getByTestId('settings-seed').fill('77');
  await page.getByTestId('opt-looping').selectOption('off');
  await Promise.all([page.waitForURL(/scenario=1938/), page.getByTestId('settings-new-game').click()]);
  await ready(page);
  const left = await page.evaluate(() => window.__warsim!.sim.step(72));
  await page.getByTestId('settings-btn').click();
  await Promise.all([page.waitForURL((u) => u.search === ''), page.getByTestId('settings-menu').click()]);

  // The title screen offers it, with its scenario and its date.
  await expect(page.getByTestId('title-screen')).toHaveAttribute('data-save', 'found');
  await expect(page.getByTestId('title-save')).toContainText('World, 1938');
  await expect(page.getByTestId('title-save-date')).toHaveText('4 January 1938');
  await page.screenshot({ path: path.join(evidence(info), 'title-continue.png') });
  await Promise.all([page.waitForURL(/continue=1/), page.getByTestId('title-continue').click()]);
  for (const p of ['scenario=1938', 'seed=77', 'looping=0']) expect(page.url()).toContain(p);
  await ready(page);
  await page.waitForFunction(() => window.__warsim!.hud.tick.value === 72, null, { timeout: 30_000 });

  // The same world, three days in, still without a looping map; the panel knows its seed and options.
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual(left);
  const node = new Sim({ scenario: '1938', seed: 77, options: { loopingMap: false }, assets: assets1938(SIZE_1938.w) });
  node.step(72);
  expect(left.hash).toBe(node.hash());
  expect(await page.evaluate(() => window.__warsim!.view!.wrapsX)).toBe(false);
  await expect(page.getByTestId('date-label')).toContainText('4 January 1938');
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-current-seed')).toContainText('77');
  await expect(page.getByTestId('opt-looping')).toHaveValue('off');

  // A continue URL that says nothing of the game (as before 1.43b, or typed by hand): the game
  // takes the looping setting and the seed from the loaded world. Before, this drew wrap copies
  // of a world without a looping map and showed seed 1938.
  await page.goto('/?scenario=1938&paused=1&continue=1');
  await page.waitForURL(/looping=0/, { timeout: 60_000 });
  expect(page.url()).toContain('continue=1');
  await ready(page);
  await page.waitForFunction(() => window.__warsim!.hud.tick.value === 72, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.view!.wrapsX)).toBe(false);
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual(left);
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-current-seed')).toContainText('seed 77');
  expect(errors).toEqual([]);
});

test('a scenario file chosen on the title screen starts its game; a file that does not fit is refused', async ({ page }, info) => {
  test.setTimeout(240_000);
  // A scenario made in Node: seed 5, no looping map, Poland renamed, ten days in.
  const sim = new Sim({ scenario: '1938', seed: 5, options: { loopingMap: false }, assets: assets1938(SIZE_1938.w) });
  sim.command({ kind: 'renameNation', nation: POL, name: 'Rzeczpospolita' });
  sim.step(24 * 10);
  const { bytes, hash } = sim.exportScenario();
  const header = { format: SCENARIO_FORMAT, name: 'Title test', base: '1938', w: SIZE_1938.w, h: SIZE_1938.h, tick: sim.tick, hash };
  const file = Buffer.from(await encodeScenarioFile(header, bytes));
  const pick = (name: string, buffer: Buffer): Promise<void> => page.getByTestId('title-scenario-file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  const error = page.getByTestId('title-file-error');

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/');
  await expect(error).toHaveCount(0);

  // Refused on the title screen: a damaged file, another kind of file, another map size, a
  // scenario this version does not have. No game starts.
  const damaged = Buffer.from(file);
  damaged[damaged.length - 40] = damaged[damaged.length - 40]! ^ 0xff;
  await pick('damaged.warsim-scenario', damaged);
  await expect(error).toContainText('Could not load');
  await pick('other.warsim-scenario', Buffer.from('hello'));
  await expect(error).toContainText('not a WarSim scenario file');
  await pick('small.warsim-scenario', Buffer.from(await encodeScenarioFile({ ...header, w: 1024, h: 512 }, bytes)));
  await expect(error).toContainText('1024×512');
  await pick('atlantis.warsim-scenario', Buffer.from(await encodeScenarioFile({ ...header, base: 'atlantis' }, bytes)));
  await expect(error).toContainText('atlantis');
  expect(new URL(page.url()).search).toBe('');
  expect(page.workers()).toHaveLength(0);
  await page.screenshot({ path: path.join(evidence(info), 'title-file-refused.png') });

  // A file whose state is not the one its header names passes the title screen and is refused
  // by the game, which returns to the title screen.
  await Promise.all([page.waitForURL(/failed=scenario/, { timeout: 60_000 }), pick('forged.warsim-scenario', Buffer.from(await encodeScenarioFile({ ...header, hash: (hash ^ 1) >>> 0 }, bytes)))]);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(error).toHaveText('The scenario file could not be loaded. Choose it again.');

  // The file itself: the game of its base scenario starts with the file's state. That world has
  // no looping map, so the game corrects its URL and draws the map without wrap copies.
  await Promise.all([page.waitForURL(/load=scenario/), pick('title-test.warsim-scenario', file)]);
  await page.waitForURL(/looping=0/, { timeout: 60_000 });
  await ready(page);
  await page.waitForFunction((tick) => window.__warsim!.hud.tick.value === tick, sim.tick, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: sim.tick, hash });
  expect(await page.evaluate(() => window.__warsim!.view!.wrapsX)).toBe(false);
  await expect(page.getByTestId('date-label')).toContainText('11 January 1938');
  const s: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect());
  expect(s.seed).toBe(5);
  expect(s.nations.find((n) => n.id === POL)!.name).toBe('=Rzeczpospolita');
  // The panel shows the world's seed, not the URL's default.
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-current-seed')).toContainText('seed 5');
  await page.getByTestId('settings-close').click();
  await page.waitForTimeout(500); // let the first frames draw
  await page.screenshot({ path: path.join(evidence(info), 'scenario-file-started.png') });

  // The file stays staged: reloading the game starts the scenario again.
  await page.evaluate(() => window.__warsim!.sim.step(24));
  await page.reload();
  await ready(page);
  await page.waitForFunction((tick) => window.__warsim!.hud.tick.value === tick, sim.tick, { timeout: 30_000 });
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).toBe(hash);

  // The editor's import into a running game (PLAN 1.38) shows the loaded world's seed too.
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await ready(page);
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null);
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('scenario-import').setInputFiles({ name: 'title-test.warsim-scenario', mimeType: 'application/octet-stream', buffer: file });
  await expect(page.getByTestId('scenario-status')).toContainText('Loaded', { timeout: 30_000 });
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-current-seed')).toContainText('seed 5');
});

test('a game URL that asks for a staged scenario file when none is staged returns to the title screen', async ({ page }) => {
  await page.goto('/?scenario=1938&paused=1&load=scenario');
  await page.waitForURL(/failed=scenario/);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('title-file-error')).toHaveText('The scenario file could not be loaded. Choose it again.');
  expect(page.workers()).toHaveLength(0);
});