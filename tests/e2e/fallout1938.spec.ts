import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { FALLOUT_COLOR, FALLOUT_FADE, mix } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 6.3 AT (6.3c): the fallout map mode. England, given a warhead, strikes Hamburg by bomber on
// 1 January 1938; the plume falls east. In the mode the political colours are faded and the
// fallout tinted over them by its level; ground with none is the faded colour alone.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const FADE = 0xc7c7bf; // vec3(0.78, 0.78, 0.75)

async function pixelAt(page: Page, x: number, y: number, scale = 3): Promise<number[]> {
  return page.evaluate(
    ({ x, y, scale }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale });
      v.draw();
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [p[0]!, p[1]!, p[2]!];
    },
    { x, y, scale },
  );
}
const setMode = (page: Page, m: string): Promise<void> => page.evaluate((mode) => window.__warsim!.hud.setMapMode(mode as 'political'), m);

test('the fallout mode: a strike\'s plume tinted over the faded political colours, clean ground faded alone', async ({ page }, info) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/6.3') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const hamburg = cellOf(10.0, 53.55, W, H);
  const madrid = cellOf(-3.7, 40.42, W, H);
  // Before any strike: the mode is the faded political colours alone.
  await setMode(page, 'political');
  const hamburgPol = await pixelAt(page, ...hamburg);
  const madridPol = await pixelAt(page, ...madrid);
  const faded = (p: number[]): number[] => rgb(mix((p[0]! << 16) | (p[1]! << 8) | p[2]!, FADE, FALLOUT_FADE));
  await setMode(page, 'fallout');
  await expect(page.getByTestId('map-legend')).toHaveAttribute('data-mode', 'fallout');
  const before = await pixelAt(page, ...hamburg);
  const spain = await pixelAt(page, ...madrid);
  expect(dist(before, faded(hamburgPol)), `Hamburg before: ${before}, political ${hamburgPol}`).toBeLessThan(30);
  // The strike.
  await page.evaluate((eng) => {
    const s = window.__warsim!.sim;
    s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
    s.command({ kind: 'grantWarheads', nation: eng, count: 1 });
    s.step(1);
  }, id('ENG'));
  await page.evaluate(({ eng, x, y }) => {
    const s = window.__warsim!.sim;
    s.command({ kind: 'launchNuke', nation: eng, x, y, missile: false });
    s.step(48);
  }, { eng: id('ENG'), x: hamburg[0], y: hamburg[1] });
  await page.waitForFunction(() => window.__warsim!.view!.falloutCells > 0, null, { timeout: 30_000 });
  const cells = await page.evaluate(() => window.__warsim!.view!.falloutCells);
  expect(cells).toBeGreaterThan(50);
  // At the burst: tinted toward the fallout's colour; Madrid, far from it, as it was.
  const after = await pixelAt(page, ...hamburg);
  expect(dist(after, rgb(FALLOUT_COLOR)), `Hamburg after: ${after}`).toBeLessThan(dist(before, rgb(FALLOUT_COLOR)) - 60);
  expect(dist(await pixelAt(page, ...madrid), spain)).toBeLessThan(3);
  expect(dist(spain, faded(madridPol)), `Madrid: ${spain}, political ${madridPol}`).toBeLessThan(30);
  // The screenshot: the plume over north Germany and the Baltic.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x + 12, cy: y, scale: 8 });
    v.draw();
  }, { x: hamburg[0], y: hamburg[1] });
  await page.screenshot({ path: path.join(out, 'fallout-mode.png') });
  // Political again: no fallout drawn.
  await setMode(page, 'political');
  expect(dist(await pixelAt(page, ...hamburg), hamburgPol)).toBeLessThan(40);
});
