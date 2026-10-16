import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { MAP_MODES } from '../../src/shared/mapModes';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { open1938 } from './mapView';
import { settle } from './settle';

// PLAN 7.4f1 (the critic's N7): Escape closes a panel, the nearest first; the number keys change
// the map mode; a double click zooms in about the place clicked.

const FRA = NATIONS_1938.findIndex((n) => n.tag === 'FRA') + 1;

test('Escape closes one panel a press, the number keys set the map mode, a double click zooms in', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const mode = (): Promise<string> => page.evaluate(() => window.__warsim!.hud.mapMode.value);

  // The number keys: 1 to 9 and 0 in the order of the map mode button.
  await page.locator('#map').click({ position: { x: 5, y: 400 } });
  await page.keyboard.press('3');
  expect(await mode()).toBe(MAP_MODES[2]);
  await page.keyboard.press('0');
  expect(await mode()).toBe(MAP_MODES[9]);
  await page.keyboard.press('1');
  expect(await mode()).toBe('political');
  // Not while typing in a field.
  await page.getByTestId('history-btn').click();
  const field = page.locator('.history-panel input[type=text], .history-panel input:not([type])').first();
  if ((await field.count()) > 0) {
    await field.focus();
    await page.keyboard.press('2');
    expect(await mode(), 'a digit typed in a field').toBe('political');
    await field.blur();
  }

  // Escape: the History panel, then a formation's panel, then the nation's, one a press.
  await expect(page.getByTestId('history-panel')).toBeVisible();
  const formation = await page.evaluate((n) => window.__warsim!.view!.formationsOf(n)[0]!, FRA);
  await page.evaluate((n) => window.__warsim!.view!.select(n), FRA);
  await page.evaluate((id) => window.__warsim!.hud.selectFormation(id), formation);
  // (The formation's panel stands where the nation's does, in its place.)
  await expect(page.getByTestId('formation-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('history-panel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__warsim!.hud.formation.value), 'the formation still open').toBe(formation);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__warsim!.hud.formation.value), 'the formation closed').toBe(0);
  expect(await page.evaluate(() => window.__warsim!.hud.selected.value), 'the nation still open').toBe(FRA);
  await expect(page.getByTestId('nation-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__warsim!.hud.selected.value), 'the nation closed').toBe(0);
  await expect(page.getByTestId('nation-panel')).toHaveCount(0);

  // A double click: twice the scale, the place under the cursor where it was.
  await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: 1100, cy: 300, scale: 1 });
  });
  await settle(page);
  const [x, y] = [500, 300];
  const before = await page.evaluate(({ x, y }) => {
    const c = window.__warsim!.view!.controller.cam;
    const el = document.getElementById('map')!;
    return { scale: c.scale, wx: c.cx + (x - el.clientWidth / 2) / c.scale, wy: c.cy + (y - el.clientHeight / 2) / c.scale };
  }, { x, y });
  await page.locator('#map').dblclick({ position: { x, y } });
  await page.waitForTimeout(1500);
  await settle(page);
  const after = await page.evaluate(({ x, y }) => {
    const c = window.__warsim!.view!.controller.cam;
    const el = document.getElementById('map')!;
    return { scale: c.scale, wx: c.cx + (x - el.clientWidth / 2) / c.scale, wy: c.cy + (y - el.clientHeight / 2) / c.scale };
  }, { x, y });
  expect(after.scale / before.scale).toBeCloseTo(2, 2);
  expect(Math.hypot(after.wx - before.wx, after.wy - before.wy), 'the place clicked stays under the cursor (cells)').toBeLessThan(0.5);
});
