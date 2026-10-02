import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { lighten, NON_ALIGNED_COLOR, PUPPET_LIGHTEN } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.18: the puppet map mode shows overlords in their colour, their puppets in a lighter
// shade of it, and everyone else grey.

const { w: W, h: H } = SIZE_1938;
const hex = (tag: string): number => parseInt(NATIONS_1938.find((n) => n.tag === tag)!.color.slice(1), 16);
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

async function colourAt(page: Page, lon: number, lat: number): Promise<number[]> {
  const [x, y] = cellOf(lon, lat, W, H);
  return page.evaluate(
    ({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: 16 });
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

test('puppet map mode: overlords, lightened puppets, grey independents', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('puppets'));
  await expect(page.getByTestId('mapmode-btn')).toHaveAttribute('data-mode', 'puppets');

  const ita = hex('ITA');
  expect(dist(await colourAt(page, 12.5, 42.5), rgb(ita))).toBeLessThan(30); // overlord of Albania
  expect(dist(await colourAt(page, 20.0, 41.1), rgb(lighten(ita, PUPPET_LIGHTEN)))).toBeLessThan(30); // Albania
  expect(dist(await colourAt(page, 8.2, 46.8), rgb(NON_ALIGNED_COLOR))).toBeLessThan(30); // Switzerland

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.18') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [ex, ey] = cellOf(30, 35, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 1.6 }), { x: ex, y: ey });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'puppets-world.png') });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('political'));
});
