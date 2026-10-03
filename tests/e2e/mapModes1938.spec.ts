import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { ALLY_COLOR, MAP_MODES, NEUTRAL_COLOR, PEACE_COLOR, SELF_COLOR, WAR_COLOR } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.30a/b: map modes political, alliances, puppets, terrain, wars, diplomacy, income and
// revolts, each with a legend; diplomacy colours relations to the nation selected by clicking the map.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

async function pixelAt(page: Page, lon: number, lat: number): Promise<number[]> {
  const [x, y] = cellOf(lon, lat, W, H);
  return page.evaluate(
    ({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: 12 });
      v.draw();
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [p[0]!, p[1]!, p[2]!];
    },
    { x, y },
  );
}

const setMode = (page: Page, m: string): Promise<void> => page.evaluate((mode) => window.__warsim!.hud.setMapMode(mode as 'political'), m);

test('every map mode renders with a legend; wars, diplomacy and income colour correctly', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast && window.__warsim!.sim.labels !== null, null, { timeout: 60_000 });

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.30') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const legend = page.getByTestId('map-legend');
  for (const mode of MAP_MODES) {
    await setMode(page, mode);
    await expect(legend).toHaveAttribute('data-mode', mode);
    expect(await legend.locator('.legend-row').count()).toBeGreaterThan(0);
    const [cx, cy] = cellOf(15, 48, W, H);
    await page.evaluate(({ cx, cy }) => window.__warsim!.view!.controller.set({ cx, cy, scale: 3 }), { cx, cy });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `mode-${mode}.png`) });
  }

  // Wars: the Spanish Civil War is on; Sweden is at peace.
  await setMode(page, 'wars');
  expect(dist(await pixelAt(page, -3.7, 40.4), rgb(WAR_COLOR))).toBeLessThan(30);
  expect(dist(await pixelAt(page, 15, 62), rgb(PEACE_COLOR))).toBeLessThan(30);

  // Diplomacy: a real click on France selects it; then Germany's relations.
  await setMode(page, 'diplomacy');
  const [fx, fy] = cellOf(2.5, 46.5, W, H);
  await page.evaluate(({ fx, fy }) => window.__warsim!.view!.controller.set({ cx: fx, cy: fy, scale: 6 }), { fx, fy });
  await page.waitForTimeout(200);
  await page.mouse.click(700, 400);
  await expect.poll(() => page.evaluate(() => window.__warsim!.hud.selected.value)).toBe(id('FRA'));
  await expect(legend.locator('.legend-selected')).toHaveText('France');
  await page.evaluate((g) => window.__warsim!.view!.select(g), id('GER'));
  expect(dist(await pixelAt(page, 10.5, 51), rgb(SELF_COLOR))).toBeLessThan(30);
  expect(dist(await pixelAt(page, 12.5, 42.5), rgb(ALLY_COLOR))).toBeLessThan(30); // Italy, Anti-Comintern
  expect(dist(await pixelAt(page, 19.5, 52), rgb(NEUTRAL_COLOR))).toBeLessThan(30); // Poland

  // Revolts (PLAN 1.30b): a province pushed to unrest 100 renders hot; a calm one pale.
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const [wx, wy] = cellOf(21.0, 52.23, W, H); // Warsaw
  const warsawProvince = node.world.cells.province[Math.floor(wy) * W + Math.floor(wx)]!;
  expect(warsawProvince).toBeGreaterThan(0);
  await page.evaluate((p) => window.__warsim!.sim.command({ kind: 'setUnrest', province: p, value: 100 }), warsawProvince);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  // The step lands on 1 January: the monthly revolt pass applies its −2 decay (100 → 98).
  await page.waitForFunction((p) => (window.__warsim!.sim.unrest?.[p] ?? 0) >= 90, warsawProvince, { timeout: 20_000 });
  await setMode(page, 'revolts');
  const hot = await pixelAt(page, 21.0, 52.23);
  const calm = await pixelAt(page, 10.5, 51.0); // central Germany (Berlin's lakes draw fine coast lines)
  expect(dist(hot, [143, 28, 15]), `Warsaw ${hot}`).toBeLessThan(30);
  expect(dist(calm, [232, 227, 207]), `central Germany ${calm}`).toBeLessThan(30);
  const [px, py] = cellOf(19.5, 52, W, H);
  await page.evaluate(({ px, py }) => window.__warsim!.view!.controller.set({ cx: px, cy: py, scale: 8 }), { px, py });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'mode-revolts-warsaw.png') });

  // Income: the Soviet Union is darker (richer) than Albania.
  await setMode(page, 'income');
  const lum = (p: number[]): number => p[0]! + p[1]! + p[2]!;
  expect(lum(await pixelAt(page, 40, 55))).toBeLessThan(lum(await pixelAt(page, 20, 41.1)));
});
