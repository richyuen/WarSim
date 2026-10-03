import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.36 AT: build a mini scenario with each editor tool (cities, capital, gold, cores and a
// preset revolt, alliance, puppet, annexation), save it, load it and verify. Alliances and
// puppets are the God tab's tools; everything else is the editor panel. Save/load is the real
// path: the autosave in IndexedDB and a page reload with ?continue=1.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [POL, ETH, GER, AUT, HUN, SWE, NOR, LIT] = ['POL', 'ETH', 'GER', 'AUT', 'HUN', 'SWE', 'NOR', 'LIT'].map(id) as [number, number, number, number, number, number, number, number];
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());
const nation = (s: Inspection, n: number) => s.nations.find((x) => x.id === n)!;

async function centre(page: Page, lon: number, lat: number, scale = 8): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale }), { x, y, scale });
  await page.waitForTimeout(150);
}

test('scenario editor: build a mini scenario, save, load and verify', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false }, true));

  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(POL));

  // 1. Place a city in the Polish countryside, then make it Poland's capital.
  await centre(page, 19.0, 51.0);
  await page.getByTestId('editor-tool-city').click();
  await page.getByTestId('editor-city-name').fill('Nowe Miasto');
  await page.getByTestId('editor-city-size').fill('3');
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).cities.some((c) => c.name === 'Nowe Miasto')).toBe(true);
  await page.getByTestId('editor-tool-capital').click();
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).cities.find((c) => c.name === 'Nowe Miasto')!.capitalOf).toBe(POL);

  // 2. Gold.
  await page.getByTestId('editor-gold').fill('54321');
  await page.getByTestId('editor-gold-set').click();
  await expect.poll(async () => nation(await inspect(page), POL).gold).toBe(54321);

  // 3. A preset revolt: dead Ethiopia gets a core on a province near Kraków.
  await page.getByTestId('editor-nation').selectOption(String(ETH));
  await page.getByTestId('editor-tool-core').click();
  await centre(page, 20.0, 50.1);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).cores.some((c) => c.nations.includes(ETH) && c.nations.includes(POL))).toBe(true);
  const etProvince = (await inspect(page)).cores.find((c) => c.nations.includes(ETH) && c.nations.includes(POL))!.province;

  // 4. Remove a scenario city (Breslau, Germany).
  const breslau = (await inspect(page)).cities.find((c) => c.name === 'Breslau')!;
  expect(breslau).toBeTruthy();
  await page.getByTestId('editor-tool-removeCity').click();
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 8 }), breslau);
  await page.waitForTimeout(150);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).cities.some((c) => c.name === 'Breslau')).toBe(false);

  // 5. Annexation: Germany annexes Austria.
  await page.getByTestId('editor-nation').selectOption(String(GER));
  await page.getByTestId('editor-annex-target').selectOption(String(AUT));
  await page.getByTestId('editor-annex').click();
  await expect.poll(async () => nation(await inspect(page), AUT).living).toBe(false);
  // The map follows while paused: Vienna is drawn German, and Austria's label goes.
  await centre(page, 16.37, 48.21);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.nationAt(700, 400)), { timeout: 10_000 }).toBe(GER);
  await expect.poll(() => page.evaluate(() => (window.__warsim!.view!.draw(), window.__warsim!.view!.nationLabels.some((l) => l.text === 'Austria'))), { timeout: 10_000 }).toBe(false);
  await page.getByTestId('editor-close').click();

  // 6. Alliance and puppet with the God tab: Sweden + Norway; Lithuania becomes Hungary's puppet.
  await page.getByTestId('god-btn').click();
  await page.evaluate((s) => window.__warsim!.view!.select(s), SWE);
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-target').selectOption(String(NOR));
  await page.getByTestId('god-ally').click();
  await expect.poll(async () => nation(await inspect(page), NOR).alliance?.leader).toBe(SWE);
  await page.evaluate((h) => window.__warsim!.view!.select(h), HUN);
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-target').selectOption(String(LIT));
  await page.getByTestId('god-puppet').click();
  await expect.poll(async () => nation(await inspect(page), LIT).overlord).toBe(HUN);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.36') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await centre(page, 19.0, 51.0, 5);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'mini-scenario.png') });

  // Save (autosave to IndexedDB), reload from it, verify everything came back.
  const built = await inspect(page);
  await page.evaluate(() => window.__warsim!.autosave.saveNow());
  await page.goto('/?scenario=1938&paused=1&seed=1938&continue=1');
  await page.waitForFunction(() => window.__warsim?.hud.stats.value !== null && window.__warsim?.hud.stats.value !== undefined, null, { timeout: 60_000 });
  await expect.poll(async () => (await inspect(page)).cities.some((c) => c.name === 'Nowe Miasto'), { timeout: 30_000 }).toBe(true);
  const loaded = await inspect(page);
  expect(loaded.rasters).toEqual(built.rasters);
  expect(loaded.cities).toEqual(built.cities);
  expect(loaded.cores).toEqual(built.cores);
  expect(loaded.cities.find((c) => c.name === 'Nowe Miasto')!.capitalOf).toBe(POL);
  expect(loaded.cities.some((c) => c.name === 'Breslau')).toBe(false);
  expect(nation(loaded, POL).gold).toBe(54321);
  expect(nation(loaded, AUT).living).toBe(false);
  expect(nation(loaded, NOR).alliance?.leader).toBe(SWE);
  expect(nation(loaded, LIT).overlord).toBe(HUN);
  expect(loaded.cores.find((c) => c.province === etProvince)!.nations).toContain(ETH);
  expect(loaded.settings.aiEnabled).toBe(false);
  // The map view's city layer has the placed city after the load too (cityLayer from the worker).
  const placed = loaded.cities.find((c) => c.name === 'Nowe Miasto')!;
  await expect.poll(() => page.evaluate(({ x, y }) => window.__warsim!.view!.cityNear(Math.floor(x), Math.floor(y), 1), placed)).toBe(placed.id);
  expect(await page.evaluate(({ x, y }) => window.__warsim!.view!.cityNear(Math.floor(x), Math.floor(y), 1), breslau)).not.toBe(breslau.id);
});
