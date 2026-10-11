import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { mix, SEA_HELD_TINT, SEA_LAND_FADE } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 4.7a: the sea-control map mode. A sea zone held is tinted with its holder's colour
// (SEA_HELD_TINT of it over the sea's), one held by nobody is the sea's; the land is faded. On
// the first day of 1938 the zone of Scapa Flow's water is the United Kingdom's (PLAN 4.4a), the
// middle of the South Pacific nobody's.

const { w: W, h: H } = SIZE_1938;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const hex = (s: string): number => parseInt(s.replace('#', ''), 16);

async function pixelAt(page: Page, lon: number, lat: number, scale = 3): Promise<number[]> {
  const [x, y] = cellOf(lon, lat, W, H);
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

test('the sea-control mode tints the zones held with their holders\' colours: Scapa Flow\'s British, the South Pacific open', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  // The first day's sea control (the first tick) reaches the page.
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 2, null, { timeout: 30_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // North of Scapa Flow, in its water's zone; the middle of the South Pacific.
  const [scapa, pacific] = [[-3.0, 59.3], [-130, -40]] as const;
  await setMode(page, 'political');
  const sea = await pixelAt(page, pacific[0], pacific[1]);
  const germany = await pixelAt(page, 10.5, 51);
  await setMode(page, 'seaControl');
  await expect(page.getByTestId('map-legend')).toHaveAttribute('data-mode', 'seaControl');
  const british = hex(NATIONS_1938.find((n) => n.tag === 'ENG')!.color);
  const held = await pixelAt(page, scapa[0], scapa[1]);
  const open = await pixelAt(page, pacific[0], pacific[1]);
  const seaHex = (sea[0]! << 16) | (sea[1]! << 8) | sea[2]!;
  expect(dist(held, rgb(mix(seaHex, british, SEA_HELD_TINT))), `Scapa Flow's zone ${held}`).toBeLessThan(30);
  expect(dist(open, sea), `the South Pacific ${open}`).toBeLessThan(12);
  // The land faded towards grey.
  const faded = await pixelAt(page, 10.5, 51);
  const germanyHex = (germany[0]! << 16) | (germany[1]! << 8) | germany[2]!;
  expect(dist(faded, rgb(mix(germanyHex, 0xc7c7bf, SEA_LAND_FADE))), `central Germany ${faded} from ${germany}`).toBeLessThan(30);
  // The North Sea and the Atlantic about Britain, for the eye.
  const [cx, cy] = cellOf(-2, 55, W, H);
  await page.evaluate(({ cx, cy }) => window.__warsim!.view!.controller.set({ cx, cy, scale: 2 }), { cx, cy });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'sea-control-britain.png') });
  const [mx, my] = cellOf(18, 37, W, H);
  await page.evaluate(({ cx, cy }) => window.__warsim!.view!.controller.set({ cx, cy, scale: 2 }), { cx: mx, cy: my });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'sea-control-mediterranean.png') });
});
