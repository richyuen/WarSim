import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 5.8v1: the page's orders for a wing. As Germany, the Actions tab lists its air wings;
// a fighter group's Strike armed, a click on the map near Poznań gives it there; Rebase armed
// and Escape disarms it, and the next click is no wing's.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const wings = (page: Page) => page.evaluate(() => window.__warsim!.hud.stats.value?.wings ?? []);
/** A click at the middle of the map's canvas. */
async function clickMiddle(page: Page): Promise<void> {
  const box = (await page.locator('canvas.map-nations').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('a wing\'s mission by the Actions tab and a click on the map; Escape disarms an order', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page);
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect.poll(async () => (await wings(page)).length, { timeout: 30_000 }).toBeGreaterThan(20);
  const names = await page.evaluate(() => window.__warsim!.hud.templates.value.map((t) => t.nameKey));
  const list = await wings(page);
  const fighter = list.find((w) => w.template === names.indexOf('template.fighter_group') && !w.carrier)!;
  const transport = list.find((w) => w.transport)!;
  expect(fighter.mission).toBeNull();
  // A transport has Supply and no Strike; a fighter Strike and no Supply.
  await expect(page.getByTestId(`act-wing-${transport.id}-supply`)).toBeVisible();
  await expect(page.getByTestId(`act-wing-${transport.id}-strike`)).toHaveCount(0);
  await expect(page.getByTestId(`act-wing-${fighter.id}-supply`)).toHaveCount(0);

  const [px, py] = cellOf(16.9, 52.4, SIZE_1938.w, SIZE_1938.h);
  await lookAt(page, px, py, 1500);
  await page.getByTestId(`act-wing-${fighter.id}-strike`).click();
  await expect(page.getByTestId('act-wing-armed')).toContainText('strike a place');
  await clickMiddle(page);
  await expect(page.getByTestId('act-wing-armed')).toHaveCount(0);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect.poll(async () => (await wings(page)).find((w) => w.id === fighter.id)?.mission, { timeout: 30_000 }).toBe('strike');
  await expect(page.getByTestId(`act-wing-${fighter.id}`)).toContainText('striking');

  // Rebase armed, then Escape: disarmed, and the click after it gives the wing no order.
  await page.getByTestId(`act-wing-${transport.id}-rebase`).click();
  await expect(page.getByTestId('act-wing-armed')).toContainText('move to an airbase or carrier');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('act-wing-armed')).toHaveCount(0);
});
