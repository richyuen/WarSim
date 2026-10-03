import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.35 AT (e2e part): paint, undo and redo through the editor UI give identical raster
// hashes (owner, controller, terrain); line and bucket tools and a target mask work by map clicks.

const { w: W, h: H } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const rasters = (page: Page) => page.evaluate(async () => (await window.__warsim!.sim.inspect()).rasters);
const edits = (page: Page) => page.evaluate(async () => (await window.__warsim!.sim.inspect()).edits);

test('editor: paint, undo and redo restore identical rasters; line, bucket and mask', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [px, py] = cellOf(19.5, 52, W, H);
  await page.evaluate(({ px, py }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale: 8 }), { px, py });
  await page.waitForTimeout(200);

  await page.getByTestId('editor-btn').click();
  await expect(page.getByTestId('editor-panel')).toBeVisible();
  await page.getByTestId('editor-nation').selectOption(String(GER));
  const h0 = await rasters(page);

  // Brush: a click on central Poland paints Germany there; the click does not select a nation.
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await edits(page)).undo).toBe(1);
  const h1 = await rasters(page);
  expect(h1.owner).not.toBe(h0.owner);
  expect(h1.controller).not.toBe(h0.controller);
  expect(h1.terrain).toBe(h0.terrain);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.nationAt(700, 400))).toBe(GER);
  await expect(page.getByTestId('nation-panel')).toHaveCount(0);

  // Undo / redo by keyboard and by buttons: the rasters return exactly.
  await page.keyboard.press('Control+z');
  await expect.poll(() => rasters(page)).toEqual(h0);
  await page.keyboard.press('Control+y');
  await expect.poll(() => rasters(page)).toEqual(h1);
  await page.getByTestId('editor-undo').click();
  await expect.poll(() => rasters(page)).toEqual(h0);
  await page.getByTestId('editor-redo').click();
  await expect.poll(() => rasters(page)).toEqual(h1);
  await expect(page.getByTestId('editor-undo')).toContainText('1');

  // Line: two clicks.
  await page.getByTestId('editor-tool-line').click();
  await page.getByTestId('editor-radius').fill('1');
  await page.mouse.click(560, 300);
  await expect(page.getByTestId('editor-hint')).toContainText('end');
  await page.mouse.click(840, 300);
  await expect.poll(async () => (await edits(page)).undo).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.nationAt(700, 300))).toBe(GER);

  // Bucket limited by a mask: fill Poland's connected land with "unowned", only on plains.
  await page.getByTestId('editor-tool-bucket').click();
  await page.getByTestId('editor-nation').selectOption('0');
  await page.getByTestId('editor-mask').selectOption('terrain');
  await page.getByTestId('editor-mask-terrain').selectOption(String(Terrain.Plains));
  const polBefore = await page.evaluate(async (p) => (await window.__warsim!.sim.inspect()).nations.find((n) => n.id === p)!.cells, POL);
  await page.mouse.click(700, 520);
  await expect.poll(async () => (await edits(page)).undo).toBe(3);
  const polAfter = await page.evaluate(async (p) => (await window.__warsim!.sim.inspect()).nations.find((n) => n.id === p)!.cells, POL);
  expect(polAfter).toBeLessThan(polBefore);
  expect(polAfter).toBeGreaterThan(0); // non-plains Polish land kept

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.35') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'editor.png') });

  // Terrain layer: paint mountains, then three undos and one more restore the starting rasters.
  await page.getByTestId('editor-mask').selectOption('none');
  await page.getByTestId('editor-tool-brush').click();
  await page.getByTestId('editor-layer').selectOption('terrain');
  await page.getByTestId('editor-terrain').selectOption(String(Terrain.Mountains));
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await rasters(page)).terrain).not.toBe(h0.terrain);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Control+z');
  await expect.poll(() => rasters(page)).toEqual(h0);
  expect(await edits(page)).toEqual({ undo: 0, redo: 4 });

  await page.getByTestId('editor-close').click();
  await expect(page.getByTestId('editor-panel')).toHaveCount(0);
});
