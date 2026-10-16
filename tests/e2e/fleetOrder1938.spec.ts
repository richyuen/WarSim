import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7d: a fleet's order line goes along its way. A British squadron at Gibraltar sent to
// Alexandria: its line runs through the Mediterranean, by the turns of its way, and not straight
// over Algeria and Libya as a march's arrow goes.

const { w: W, h: H } = SIZE_1938;
const LINE = [255, 232, 150];

/** Pixels of the order line's colour on the overlay in a box of cells [x0, y0, x1, y1]. */
async function linePixels(page: Page, box: [number, number, number, number]): Promise<number> {
  return page.evaluate(({ box, LINE }) => {
    const v = window.__warsim!.view!;
    v.draw();
    const c = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
    const k = c.width / c.clientWidth;
    const cam = v.controller.cam;
    const at = (x: number, y: number): [number, number] => [(x - cam.cx) * cam.scale + c.clientWidth / 2, (y - cam.cy) * cam.scale + c.clientHeight / 2];
    const [ax, ay] = at(box[0], box[1]);
    const [bx, by] = at(box[2], box[3]);
    const [x, y, w, h] = [Math.round(Math.min(ax, bx) * k), Math.round(Math.min(ay, by) * k), Math.round(Math.abs(bx - ax) * k), Math.round(Math.abs(by - ay) * k)];
    const px = c.getContext('2d')!.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]! > 120 && Math.abs(px[i]! - LINE[0]!) + Math.abs(px[i + 1]! - LINE[1]!) + Math.abs(px[i + 2]! - LINE[2]!) < 60) n++;
    return n;
  }, { box, LINE });
}

test('a squadron sent from Gibraltar to Alexandria: its order line through the Mediterranean, not over Africa', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [gx, gy] = cellOf(-5.35, 36.13, W, H);
  const fleet = await page.evaluate(({ gx, gy }) => {
    const v = window.__warsim!.view!;
    let best = -1;
    let near = 6;
    for (const id of v.formationIds()) {
      if (!v.formationAfloat(id)) continue;
      const [x, y] = v.formationPos(id)!;
      const d = Math.hypot(x - gx, y - gy);
      if (d < near) [best, near] = [id, d];
    }
    return best;
  }, { gx, gy });
  expect(fleet, 'a fleet at Gibraltar').toBeGreaterThan(0);
  // At T1 (1,500 m/px: the markers and their order lines), from Gibraltar to Tunis. Inland
  // Algeria, where the straight line from Gibraltar to Alexandria would cross; the sea north of
  // it, where the way goes. Each counted before the order too: what else has the line's colour.
  const [mx, my] = cellOf(3, 36, W, H);
  const [lx0, ly0] = cellOf(1, 35.0, W, H);
  const [lx1, ly1] = cellOf(7, 33.8, W, H);
  const [sx0, sy0] = cellOf(-1, 38.5, W, H);
  const [sx1, sy1] = cellOf(10, 36.2, W, H);
  await lookAt(page, mx, my, 1500);
  const before = [await linePixels(page, [lx0, ly0, lx1, ly1]), await linePixels(page, [sx0, sy0, sx1, sy1])];
  const [ax, ay] = cellOf(29.9, 31.25, W, H);
  await page.evaluate(({ id, ax, ay }) => window.__warsim!.sim.command({ kind: 'moveFormation', id, x: ax, y: ay }), { id: fleet, ax, ay });
  // Its panel open: since PLAN 7.4b an order line is drawn for what is looked at, not for all.
  await page.evaluate((id) => void (window.__warsim!.view!.pickedFormation = id), fleet);
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 2, null, { timeout: 30_000 });
  const way = await page.evaluate((id) => window.__warsim!.view!.formationWay(id), fleet);
  expect(way, 'the way of the fleet under way').not.toBeNull();
  const pts = way!.length / 2;
  expect(pts).toBeGreaterThanOrEqual(3);
  expect(pts).toBeLessThan(30);
  // It ends at Alexandria's water.
  expect(Math.hypot(way![way!.length - 2]! - ax, way![way!.length - 1]! - ay)).toBeLessThan(6);
  await lookAt(page, mx, my, 1500);
  const inland = (await linePixels(page, [lx0, ly0, lx1, ly1])) - before[0]!;
  const sea = (await linePixels(page, [sx0, sy0, sx1, sy1])) - before[1]!;
  await page.screenshot({ path: path.join(out, 'fleet-order-line.png') });
  console.log(`fleet ${fleet}: ${pts} points; line pixels inland Algeria ${inland}, at sea north of it ${sea} (more than before the order)`);
  expect(inland).toBeLessThanOrEqual(0);
  expect(sea).toBeGreaterThan(20);
  // And the east of the sea, to Alexandria, for the eye.
  const [ex, ey] = cellOf(24, 34, W, H);
  await lookAt(page, ex, ey, 1500);
  await page.screenshot({ path: path.join(out, 'fleet-order-line-east.png') });
});
