import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 7.4f7 (the critic's "no tooltip on hover"): a mouse on a nation's land names it by the
// cursor, and says who holds the land when another does; off land, nothing. It takes no click.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** The CSS px of a place in the view. */
function at(page: Page, lon: number, lat: number): Promise<[number, number]> {
  const [x, y] = cellOf(lon, lat, W, H);
  return page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    const c = v.controller.cam;
    const el = document.getElementById('map')!;
    return [(x - c.cx) * c.scale + el.clientWidth / 2, (y - c.cy) * c.scale + el.clientHeight / 2] as [number, number];
  }, { x, y });
}

test('a tooltip names the nation under the mouse, and its occupier', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const [cx, cy] = cellOf(10, 50, W, H);
  await lookAt(page, cx, cy, 3000);
  const tip = page.getByTestId('map-tooltip');

  // Germany at Leipzig.
  const [gx, gy] = await at(page, 12.4, 51.3);
  await page.mouse.move(gx, gy);
  await expect(tip).toHaveText('Germany');
  // It stands by the cursor and takes no click.
  const box = (await tip.boundingBox())!;
  expect(Math.abs(box.x - (gx + 14))).toBeLessThan(2);
  expect(await tip.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

  // Off land (the North Sea): nothing.
  const [sx, sy] = await at(page, 3.5, 55.5);
  await page.mouse.move(sx, sy);
  await expect(tip).toHaveCount(0);

  // Land of France held by Germany: France's, occupied by Germany.
  const [px, py] = cellOf(2.35, 48.86, W, H);
  await page.evaluate(({ ger, px, py }) => window.__warsim!.sim.command({ kind: 'paintControl', nation: ger, x: px, y: py, r: 3 }), { ger: id('GER'), px, py });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForTimeout(500);
  const [fx, fy] = await at(page, 2.35, 48.86);
  await page.mouse.move(fx, fy);
  await expect(tip).toContainText('France');
  await expect(tip).toContainText('Occupied by Germany');

  // A button down (a drag): none.
  await page.mouse.down();
  await page.mouse.move(fx + 5, fy + 5);
  await expect(tip).toHaveCount(0);
  await page.mouse.up();
});
