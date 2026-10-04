import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.44 AT (critic B6): the editor's brush and line paint on a left-drag. A brush stroke
// across ≥ 20 cells paints every cell under its path, the camera does not move, and one undo
// removes the whole stroke; a right-drag pans and paints nothing; with no paint tool active a
// left-drag pans as before.

const { w: W, h: H } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const SCALE = 8; // px per cell
const rasters = (page: Page) => page.evaluate(async () => (await window.__warsim!.sim.inspect()).rasters);
const edits = (page: Page) => page.evaluate(async () => (await window.__warsim!.sim.inspect()).edits);
const camera = (page: Page) => page.evaluate(() => ({ ...window.__warsim!.view!.camera }));
/** The holders of the cells under the screen points, once the map view has them. */
const holders = (page: Page, points: [number, number][]) => page.evaluate((ps) => ps.map(([x, y]) => window.__warsim!.view!.nationAt(x, y)), points);
/** Screen points along the segment a → b, one per cell it crosses (at 8 px per cell). */
function along(a: [number, number], b: [number, number]): [number, number][] {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / SCALE);
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as [number, number]);
}
async function drag(page: Page, a: [number, number], b: [number, number], button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down({ button });
  await page.mouse.move(b[0], b[1], { steps: 12 });
  await page.mouse.up({ button });
}

test('editor: the brush and the line paint on a left-drag; the right button pans', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [px, py] = cellOf(19.5, 52, W, H); // central Poland
  await page.evaluate(({ px, py, scale }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale }), { px, py, scale: SCALE });
  await page.waitForTimeout(200);
  const h0 = await rasters(page);

  // No paint tool: a left-drag pans by the pointer's way, as before, and paints nothing.
  const c0 = await camera(page);
  await drag(page, [700, 400], [620, 440]);
  const c1 = await camera(page);
  expect(c1.cx - c0.cx).toBeCloseTo(80 / SCALE, 6);
  expect(c1.cy - c0.cy).toBeCloseTo(-40 / SCALE, 6);
  expect(await rasters(page)).toEqual(h0);
  await page.evaluate(({ px, py, scale }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale }), { px, py, scale: SCALE });

  // The brush, radius 1, German paint: a stroke of 30 cells east and 8 south over Polish land.
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(GER));
  await page.getByTestId('editor-radius').fill('1');
  await expect(page.locator('canvas#map')).toHaveCSS('cursor', 'crosshair');
  // Polish land left of the editor panel: from Łódź east into Volhynia.
  const from: [number, number] = [700, 430];
  const to: [number, number] = [940, 470];
  const path1 = along(from, to);
  expect(path1.length).toBeGreaterThanOrEqual(20);
  expect((await holders(page, path1)).every((n) => n !== GER)).toBe(true);
  const before = await camera(page);
  await drag(page, from, to);

  // Every cell under the path is German, the camera did not move, and it is one undo step.
  await expect.poll(async () => (await holders(page, path1)).filter((n) => n !== GER).length).toBe(0);
  expect(await camera(page)).toEqual(before);
  expect(await edits(page)).toEqual({ undo: 1, redo: 0 });
  await expect(page.getByTestId('editor-undo')).toContainText('1');
  const h1 = await rasters(page);
  expect(h1.owner).not.toBe(h0.owner);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.44') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'brush-stroke.png') });

  await page.keyboard.press('Control+z');
  await expect.poll(() => rasters(page)).toEqual(h0);
  expect(await edits(page)).toEqual({ undo: 0, redo: 1 });
  await page.keyboard.press('Control+y');
  await expect.poll(() => rasters(page)).toEqual(h1);

  // A right-drag and a middle-drag pan, and paint nothing.
  for (const button of ['right', 'middle'] as const) {
    const c = await camera(page);
    await drag(page, [600, 600], [680, 580], button);
    const d = await camera(page);
    expect(d.cx - c.cx, button).toBeCloseTo(-80 / SCALE, 6);
    expect(d.cy - c.cy, button).toBeCloseTo(20 / SCALE, 6);
  }
  // A right-click paints nothing either.
  await page.mouse.click(600, 600, { button: 'right' });
  await page.waitForTimeout(200);
  expect(await rasters(page)).toEqual(h1);
  expect(await edits(page)).toEqual({ undo: 1, redo: 0 });
  // The keys still pan while the brush is active.
  const k0 = await camera(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');
  expect((await camera(page)).cx).toBeGreaterThan(k0.cx);
  await page.evaluate(({ px, py, scale }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale }), { px, py, scale: SCALE });
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating);

  // The line: press at its start, release at its end. One step; the camera stays.
  await page.getByTestId('editor-tool-line').click();
  const lineFrom: [number, number] = [700, 520];
  const lineTo: [number, number] = [940, 560];
  const path2 = along(lineFrom, lineTo);
  const beforeLine = await camera(page);
  await drag(page, lineFrom, lineTo);
  await expect.poll(async () => (await holders(page, path2)).filter((n) => n !== GER).length).toBe(0);
  expect(await camera(page)).toEqual(beforeLine);
  expect(await edits(page)).toEqual({ undo: 2, redo: 0 });
  await page.screenshot({ path: path.join(out, 'line-drag.png') });

  // The bucket is a click tool: with it a left-drag pans again.
  await page.getByTestId('editor-tool-bucket').click();
  await expect(page.locator('canvas#map')).not.toHaveCSS('cursor', 'crosshair');
  const b0 = await camera(page);
  await drag(page, [600, 640], [560, 640]);
  expect((await camera(page)).cx - b0.cx).toBeCloseTo(40 / SCALE, 6);
  expect(await edits(page)).toEqual({ undo: 2, redo: 0 });
  expect(errors).toEqual([]);
});

test('editor: one finger paints with the brush, two fingers move the map', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [px, py] = cellOf(19.5, 52, W, H);
  await page.evaluate(({ px, py, scale }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale }), { px, py, scale: SCALE });
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(GER));
  await page.getByTestId('editor-radius').fill('1');
  const touch = (type: string, id: number, x: number, y: number) =>
    page.evaluate(
      ({ type, id, x, y }) => {
        const target = type === 'pointerdown' ? document.getElementById('map')! : window;
        target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
      },
      { type, id, x, y },
    );

  // One finger from (700, 430) to (860, 430), over Polish land: painted, camera still.
  const c0 = await camera(page);
  const path1 = along([700, 430], [860, 430]);
  expect((await holders(page, path1)).every((n) => n !== GER)).toBe(true);
  await touch('pointerdown', 1, 700, 430);
  for (let x = 720; x <= 860; x += 20) await touch('pointermove', 1, x, 430);
  await touch('pointerup', 1, 860, 430);
  await expect.poll(async () => (await holders(page, path1)).filter((n) => n !== GER).length).toBe(0);
  expect(await camera(page)).toEqual(c0);
  expect(await edits(page)).toEqual({ undo: 1, redo: 0 });

  // A second finger ends the stroke; the two fingers then move the map and paint no further.
  const h1 = await rasters(page);
  await touch('pointerdown', 1, 700, 520);
  await touch('pointerdown', 2, 800, 520);
  await touch('pointermove', 1, 740, 560);
  await touch('pointermove', 2, 840, 560);
  await touch('pointerup', 1, 740, 560);
  await touch('pointerup', 2, 840, 560);
  const c1 = await camera(page);
  expect(c1.cx - c0.cx).toBeCloseTo(-40 / SCALE, 1);
  expect(c1.cy - c0.cy).toBeCloseTo(-40 / SCALE, 1);
  // The first finger's stamp at its press is the only new paint: one more step, and undoing it
  // gives the map as the first stroke left it.
  expect(await edits(page)).toEqual({ undo: 2, redo: 0 });
  await page.getByTestId('editor-nation').focus(); // the synthetic touches left the focus in the radius field
  await page.keyboard.press('Control+z');
  await expect.poll(() => rasters(page)).toEqual(h1);
});
