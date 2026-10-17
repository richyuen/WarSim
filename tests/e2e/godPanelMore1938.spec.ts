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

// PLAN 7.4f26 (AoC's Spawn Nations with its initial size): a nation set down by a click, of the
// size chosen, on the land of the nation that held it, at peace with it.
test('God Mode: a nation spawned by a click, of the size chosen (PLAN 7.4f26)', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const GER = id('GER');
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-god').click();
  await page.evaluate(() => window.__warsim!.view!.controller.set({ cx: 1083.5, cy: 266.5, scale: 12 }));
  await page.waitForTimeout(500);
  const ids = (): Promise<number[]> => page.evaluate(() => window.__warsim!.hud.stats.value!.nations.map((n) => n.id));
  const before = await ids();
  // Paused: no hour passes between the two reads of Germany's land.
  const gerCells = await page.evaluate((g) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === g)!.cells, GER);
  await page.getByTestId('god-tool-nation').click();
  await expect(page.getByTestId('god-tool-hint')).toBeVisible();
  await page.getByTestId('god-nation-size').fill('3');
  await expect(page.getByTestId('god-nation-size-row')).toContainText('3 provinces');
  expect(await page.evaluate(() => window.__warsim!.hud.spawnSize.value)).toBe(3);
  const box = (await page.locator('#map').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // One nation more, and the land clicked is its own.
  await expect.poll(async () => (await ids()).filter((n) => !before.includes(n))).toHaveLength(1);
  const born = (await ids()).find((n) => !before.includes(n))!;
  await expect.poll(() => page.evaluate(([x, y]) => window.__warsim!.view!.nationAt(x!, y!), [box.width / 2, box.height / 2])).toBe(born);
  // Its land was all Germany's (three provinces of it: `godMode.test.ts` counts them); at peace with Germany.
  const stat = (n: number) => page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)!, n);
  expect((await stat(born)).cells, 'it has land').toBeGreaterThan(0);
  expect((await stat(born)).cells + (await stat(GER)).cells, 'all of it Germany\'s').toBe(gerCells);
  expect((await stat(born)).enemies, 'at peace').toEqual([]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/evidence/7.4/f26-spawn-nation.png' });
  // The tool stays armed for the next click.
  await expect(page.getByTestId('god-tool-nation')).toHaveClass(/active/);
  expect(await page.evaluate(() => window.__warsim!.hud.godTool.value)).toBe('nation');
});

test('God Mode: the world\'s rules set in the game (PLAN 7.4f19)', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('GER'));
  await page.getByTestId('tab-god').click();
  const rules = () => page.evaluate(() => window.__warsim!.hud.stats.value!.rules);
  const start = await rules();
  await page.getByTestId('god-winner-takes-all').setChecked(!start.winnerTakesAll);
  await expect.poll(async () => (await rules()).winnerTakesAll).toBe(!start.winnerTakesAll);
  await page.getByTestId('god-revolt-mode').selectOption(start.revoltMode === 'region' ? 'province' : 'region');
  await expect.poll(async () => (await rules()).revoltMode).toBe(start.revoltMode === 'region' ? 'province' : 'region');
  await page.getByTestId('god-ce-mode').selectOption('random');
  await expect.poll(async () => (await rules()).ceMode).toBe('random');
  // The controls show the world's state.
  await expect(page.getByTestId('god-ce-mode')).toHaveValue('random');
  // PLAN 7.4f27: each box's words begin on its line, beside it (Winner takes all's went under it,
  // the box alone on a line).
  const apart = await page.locator('.god-tab label.god-row:has(> input[type="checkbox"])').evaluateAll((labels) =>
    labels.map((l) => {
      const box = l.querySelector('input')!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(l);
      range.setStartAfter(l.querySelector('input')!);
      const first = range.getClientRects()[0]!;
      return { text: l.textContent!.trim(), below: first.top - box.bottom, left: first.left - box.right };
    }),
  );
  expect(apart.length).toBeGreaterThanOrEqual(5);
  for (const a of apart) {
    expect(a.below, `"${a.text}" begins beside its box, not under it`).toBeLessThan(0);
    expect(a.left, `"${a.text}" right of its box`).toBeGreaterThanOrEqual(0);
  }
});
