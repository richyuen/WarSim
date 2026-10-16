import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 7.4b (ADR-441): at T1 an order line is drawn for what is looked at, not for every
// formation on the march. In a war at 2000 m/px the lines were a web of dashed yellow lines from
// formations off the screen (the critic of 2026-10-07; N4, N5). Drawn: the formation whose panel
// is open, the player's selection and own nation, and the nation whose panel is open.

const { w: W, h: H } = SIZE_1938;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const POL = nation('POL');
const GER = nation('GER');
const LINE = [255, 232, 150];

/** The ids of the formations whose order lines the last frame drew, among `ids`. */
function lines(page: Page, ids: number[]): Promise<number[]> {
  return page.evaluate((ids) => {
    const v = window.__warsim!.view!;
    v.draw();
    return v.orderLineIds.filter((id) => ids.includes(id)).sort((a, b) => a - b);
  }, ids);
}

/** Pixels of the order line's colour on the overlay. */
function linePixels(page: Page): Promise<number> {
  return page.evaluate((LINE) => {
    window.__warsim!.view!.draw();
    const c = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
    const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]! > 120 && Math.abs(px[i]! - LINE[0]!) + Math.abs(px[i + 1]! - LINE[1]!) + Math.abs(px[i + 2]! - LINE[2]!) < 60) n++;
    return n;
  }, LINE);
}

test('order lines at T1: for the formation and nation looked at and the player\'s own, not for all', async ({ page }, info) => {
  test.setTimeout(150_000);
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.4') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [cx, cy] = cellOf(18.5, 52.3, W, H);
  await lookAt(page, cx, cy, 1000);
  // Two Polish formations and a German one, the nearest to the middle of the view.
  const picked = await page.evaluate(({ POL, GER, cx, cy }) => {
    const v = window.__warsim!.view!;
    const near = (n: number): number[] => v.formationsOf(n).filter((id) => !v.formationAfloat(id)).map((id) => [id, Math.hypot(v.formationPos(id)![0] - cx, v.formationPos(id)![1] - cy)] as const).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    return { pol: near(POL).slice(0, 2), ger: near(GER).slice(0, 1) };
  }, { POL, GER, cx, cy });
  expect(picked.pol, 'two Polish formations').toHaveLength(2);
  expect(picked.ger, 'a German formation').toHaveLength(1);
  const ids = [...picked.pol, ...picked.ger].sort((a, b) => a - b);
  const bare = await linePixels(page);
  // Each to a place of its own land (Poznań, Berlin): an order into another's land is refused in peace.
  const [tx, ty] = cellOf(16.9, 52.4, W, H);
  const [gx, gy] = cellOf(13.4, 52.5, W, H);
  await page.evaluate(({ picked, tx, ty, gx, gy }) => {
    for (const id of picked.pol) window.__warsim!.sim.command({ kind: 'moveFormation', id, x: tx, y: ty });
    for (const id of picked.ger) window.__warsim!.sim.command({ kind: 'moveFormation', id, x: gx, y: gy });
  }, { picked, tx, ty, gx, gy });
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 2, null, { timeout: 30_000 });

  // All three on the march.
  expect(await page.evaluate((ids) => ids.filter((id) => window.__warsim!.view!.formationMoving(id)).length, ids), 'three on the march').toBe(3);
  // An observer with nothing open: none of the three has a line, and no line is drawn.
  expect(await lines(page, ids)).toEqual([]);
  expect(await page.evaluate(() => window.__warsim!.view!.orderLineIds.length), 'no line of any formation').toBe(0);
  expect(await linePixels(page), 'no line on the overlay').toBeLessThanOrEqual(bare);
  await page.screenshot({ path: path.join(out, 'b-lines-none.png') });

  // A formation's panel open: its line alone.
  await page.evaluate((id) => void (window.__warsim!.view!.pickedFormation = id), picked.pol[0]!);
  expect(await lines(page, ids)).toEqual([picked.pol[0]!]);
  expect(await linePixels(page), 'its line on the overlay').toBeGreaterThan(bare + 30);
  await page.evaluate(() => void (window.__warsim!.view!.pickedFormation = 0));

  // Poland's panel open: the lines of both Polish formations, not the German one.
  await page.evaluate((n) => window.__warsim!.view!.select(n), POL);
  expect(await lines(page, ids)).toEqual([...picked.pol].sort((a, b) => a - b));
  await page.screenshot({ path: path.join(out, 'b-lines-poland.png') });
  await page.evaluate(() => window.__warsim!.view!.select(0));
  expect(await lines(page, ids)).toEqual([]);

  // Playing Germany: its own formation's line.
  // (The sim is the truth of who plays: its stats follow the command at the next tick.)
  // Its AI, on till now, may have given the formation another order: the player gives it again.
  await page.evaluate((n) => window.__warsim!.player!.take(n), GER);
  await page.evaluate(({ id, tx, ty }) => window.__warsim!.sim.command({ kind: 'moveFormation', id, x: tx, y: ty }), { id: picked.ger[0]!, tx: gx, ty: gy });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.selectionNation)).toBe(GER);
  expect(await lines(page, ids)).toEqual(picked.ger);
});
