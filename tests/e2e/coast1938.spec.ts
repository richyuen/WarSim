import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { buildLandCoverage } from '../../src/shared/landCoverage';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938, earthAsset } from '../helpers/earth';

// PLAN 1.28b: the coastline comes from the fine land mask (16384 × 8192 → 4096 × 2048 coverage),
// not the 2048 × 1024 cell grid; and the terrain map mode. Where mask and cells disagree, the
// pixel follows the mask.

const { w: W, h: H } = SIZE_1938;
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

async function pixelAt(page: Page, x: number, y: number, scale: number): Promise<number[]> {
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

test('the fine land mask draws the coast; terrain mode shows terrain', async ({ page }, info) => {
  test.setTimeout(150_000);
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const { terrain, owner } = node.world.cells;
  const mask = earthAsset('landmask');
  const cov = buildLandCoverage(new Uint8Array(mask), 16384, 8192, 4); // 4096 × 2048: 2 texels per cell
  // Disagreements between a coverage texel (half a cell) and its cell, sampled at the texel
  // centre, where bilinear filtering returns exactly the texel's value.
  const fineLand: [number, number][] = [];
  const fineWater: [number, number][] = [];
  for (let ty = 600; ty < 1400 && (fineLand.length < 12 || fineWater.length < 12); ty++) {
    for (let tx = 1800; tx < 2600; tx++) {
      const c = cov.data[ty * cov.w + tx]! / 255;
      const cell = Math.floor(ty / 2) * W + Math.floor(tx / 2);
      const at: [number, number] = [(tx + 0.5) / 2, (ty + 0.5) / 2];
      if (c > 0.95 && terrain[cell] === 0 && fineLand.length < 12) fineLand.push(at);
      if (c < 0.05 && terrain[cell] !== 0 && owner[cell] !== 0 && fineWater.length < 12) fineWater.push(at);
    }
  }
  expect(fineLand.length).toBeGreaterThan(5);
  expect(fineWater.length).toBeGreaterThan(5);

  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const sea = [0x1d, 0x35, 0x57];
  for (const [x, y] of fineLand) expect(dist(await pixelAt(page, x, y, 40), sea), `fine land at ${x},${y}`).toBeGreaterThan(40);
  for (const [x, y] of fineWater) expect(dist(await pixelAt(page, x, y, 40), sea), `fine water at ${x},${y}`).toBeLessThan(12);

  // Terrain mode: the Sahara is desert-coloured.
  await page.evaluate(() => window.__warsim!.hud.setMapMode('terrain'));
  const [sx, sy] = cellOf(10, 24, W, H);
  expect(dist(await pixelAt(page, sx, sy, 8), [0xdc, 0xc5, 0x8a])).toBeLessThan(30);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.28') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shots: [string, string, number, number, number][] = [
    ['terrain-world', 'terrain', 30, 25, 0.75],
    ['coast-world', 'political', 30, 25, 0.75],
    ['coast-norway', 'political', 7, 61, 12],
    ['coast-greece', 'political', 23.5, 38.5, 10],
  ];
  for (const [name, mode, lon, lat, scale] of shots) {
    const [cx, cy] = cellOf(lon, lat, W, H);
    await page.evaluate(({ m, cx, cy, scale }) => {
      window.__warsim!.hud.setMapMode(m as 'political');
      window.__warsim!.view!.controller.set({ cx, cy, scale });
    }, { m: mode, cx, cy, scale });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
});
