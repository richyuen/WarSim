import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { open1938 } from './mapView';

// PLAN 7.4f15 (the critic of 2026-10-07: AoC's God panel has Annex, Fight to the Death and the
// treasury, ours had none of them): each from the God tab of a nation's panel.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('God Mode: the treasury set, a neighbour annexed, a war fought to the death', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const GER = id('GER');
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-god').click();
  const stat = (n: number) => page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n) ?? null, n);
  // A God command is applied at once, between ticks, and the stats are sent at once after it
  // (SPEC §2.3): no hour passes. (Polls that stepped an hour each moved the treasury by the hour's
  // upkeep, some 180 gold a poll, under load many polls.)
  const after = <T,>(read: () => Promise<T>): Promise<T> => read();

  // Germany's and Italy's AI off: with gold to spare it orders formations in the hours after, and
  // the treasury read is then what is left of the sum set (red so in the gate's run).
  await page.getByTestId('god-ai').uncheck();
  await page.evaluate((n) => window.__warsim!.sim.command({ kind: 'setAi', nation: n, enabled: false }, true), id('ITA'));

  // The treasury.
  await page.getByTestId('god-gold-input').fill('12345');
  await page.getByTestId('god-gold').click();
  await expect.poll(() => after(async () => Math.round((await stat(GER))!.gold))).toBe(12345);

  // Recolor (PLAN 7.4f16): the nation's colour, in its stats and on the map's markers.
  await page.getByTestId('god-color-input').fill('#22aa55');
  await page.getByTestId('god-recolor').click();
  await expect.poll(() => after(async () => (await stat(GER))!.color)).toBe(0x22aa55);

  // Donate (PLAN 7.4f16): 2,000 of Germany's 12,345 to Italy.
  const ITA = id('ITA');
  const before = { ger: (await stat(GER))!.gold, ita: (await stat(ITA))!.gold };
  await page.getByTestId('god-target').selectOption(String(ITA));
  await page.getByTestId('god-donate-input').fill('2000');
  await page.getByTestId('god-donate').click();
  await expect.poll(() => after(async () => Math.round((await stat(ITA))!.gold - before.ita))).toBe(2000);
  expect(Math.round(before.ger - (await stat(GER))!.gold)).toBe(2000);

  // Annex: Luxembourg into Germany.
  const LUX = id('LUX');
  await page.getByTestId('god-target').selectOption(String(LUX));
  await page.getByTestId('god-annex').click();
  await expect.poll(() => after(() => stat(LUX))).toBeNull();

  // A war fought to the death: Germany's side of its war on Poland.
  const POL = id('POL');
  await page.getByTestId('god-target').selectOption(String(POL));
  await page.getByTestId('god-war').click();
  const warOf = () => page.evaluate(({ GER, POL }) => window.__warsim!.hud.stats.value!.wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(POL))?.id ?? 0, { GER, POL });
  await expect.poll(() => after(warOf)).toBeGreaterThan(0);
  const war = await warOf();
  const toggle = page.getByTestId(`god-death-${war}`);
  await expect(toggle).not.toHaveClass(/active/);
  await toggle.click();
  await expect.poll(() => after(() => page.evaluate((war) => window.__warsim!.hud.stats.value!.wars.find((w) => w.id === war)!.toDeath, war))).toEqual([true, false]);
  await expect(toggle).toHaveClass(/active/);
  await toggle.click();
  await expect.poll(() => after(() => page.evaluate((war) => window.__warsim!.hud.stats.value!.wars.find((w) => w.id === war)!.toDeath, war))).toEqual([false, false]);
});

test('God Mode: combat efficiency up, locked; alliance unity down (PLAN 7.4f17)', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const GER = id('GER');
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-god').click();
  const stat = () => page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)!, GER);
  const ce = (await stat()).efficiency;
  await page.getByTestId('god-ce-up').click();
  await expect.poll(async () => (await stat()).efficiency).toBeCloseTo(ce + 0.1, 6);
  await expect(page.getByTestId('god-ce')).toHaveText(`${Math.round((ce + 0.1) * 100)}%`);
  await page.getByTestId('god-ce-lock').check();
  await expect.poll(async () => (await stat()).ceLocked).toBe(true);
  // Germany is in the Anti-Comintern Pact at the start: its unity, 10 down.
  const unity = (await stat()).alliance!.unity;
  await page.getByTestId('god-unity-down').click();
  await expect.poll(async () => (await stat()).alliance!.unity).toBeCloseTo(Math.max(0, unity - 10), 6);
});

test('God Mode: a town founded by a click, and razed by another (PLAN 7.4f18)', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const GER = id('GER');
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-god').click();
  // Land in Germany, between its cities: the middle of the view at 2 px a cell over Hesse.
  await page.evaluate(() => window.__warsim!.view!.controller.set({ cx: 1083.5, cy: 266.5, scale: 12 }));
  await page.waitForTimeout(500);
  const towns = () => page.evaluate(async () => (await window.__warsim!.sim.inspect(true)).cities.filter((c) => c.name === 'New Town'));
  expect(await towns()).toHaveLength(0);
  await page.getByTestId('god-tool-city').click();
  await expect(page.getByTestId('god-tool-hint')).toBeVisible();
  const box = (await page.locator('#map').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await towns()).length).toBe(1);
  // On land Germany holds.
  expect(await page.evaluate(([x, y]) => window.__warsim!.view!.nationAt(x!, y!), [box.width / 2, box.height / 2])).toBe(GER);
  // Raze it.
  await page.getByTestId('god-tool-raze').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await towns()).length).toBe(0);
});
