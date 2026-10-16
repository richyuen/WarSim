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
  const step = () => page.evaluate(() => window.__warsim!.sim.step(1));

  // The treasury.
  await page.getByTestId('god-gold-input').fill('12345');
  await page.getByTestId('god-gold').click();
  await step();
  await expect.poll(async () => Math.round((await stat(GER))!.gold)).toBe(12345);

  // Annex: Luxembourg into Germany.
  const LUX = id('LUX');
  await page.getByTestId('god-target').selectOption(String(LUX));
  await page.getByTestId('god-annex').click();
  await step();
  await expect.poll(async () => stat(LUX)).toBeNull();

  // A war fought to the death: Germany's side of its war on Poland.
  const POL = id('POL');
  await page.getByTestId('god-target').selectOption(String(POL));
  await page.getByTestId('god-war').click();
  await step();
  const war = await page.evaluate(({ GER, POL }) => window.__warsim!.hud.stats.value!.wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(POL))!.id, { GER, POL });
  const toggle = page.getByTestId(`god-death-${war}`);
  await expect(toggle).not.toHaveClass(/active/);
  await toggle.click();
  await step();
  await expect.poll(() => page.evaluate((war) => window.__warsim!.hud.stats.value!.wars.find((w) => w.id === war)!.toDeath, war)).toEqual([true, false]);
  await expect(toggle).toHaveClass(/active/);
  await toggle.click();
  await step();
  await expect.poll(() => page.evaluate((war) => window.__warsim!.hud.stats.value!.wars.find((w) => w.id === war)!.toDeath, war)).toEqual([false, false]);
});
