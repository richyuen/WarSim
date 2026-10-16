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
