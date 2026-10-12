import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { buildLandCoverage } from '../../src/shared/landCoverage';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { earthLandMask } from '../../tools/headless/assets';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7g: a lake of the fine mask that the coarse coverage has not (a quarter as fine) was
// drawn at T2 and T3 and not at T1: it came in with the ground. The coast of T1 is the mask's
// too from where a mask pixel is a pixel on screen. A lake in Europe of two mask pixels or more
// whose coverage texels read land: water at T1 (800 m/px), as at T2; at T0 (3 km/px) the
// coverage's land.

const { w: W, h: H } = SIZE_1938;

/**
 * The middle of a mask pixel of water beside another, in a coverage texel that reads land (over
 * 0.6) as do the four beside it: a lake of a few mask pixels, which a texel of 4 × 4 averages away.
 */
function hiddenLake(): [number, number] {
  const m = earthLandMask();
  const cov = buildLandCoverage(m.bits, m.w, m.h, 4);
  const bit = (x: number, y: number): number => {
    const i = y * m.w + x;
    return (m.bits[i >> 3]! >> (i & 7)) & 1;
  };
  const [x0, y0] = cellOf(-10, 62, m.w, m.h).map(Math.floor) as [number, number];
  const [x1, y1] = cellOf(30, 36, m.w, m.h).map(Math.floor) as [number, number];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (bit(x, y) || (bit(x + 1, y) && bit(x, y + 1) && bit(x - 1, y) && bit(x, y - 1))) continue;
      const cx = Math.floor(x / 4);
      const cy = Math.floor(y / 4);
      let land = true;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (cov.data[(cy + dy) * cov.w + cx + dx]! < 153) land = false;
      if (land) return [((x + 0.5) * W) / m.w, ((y + 0.5) * H) / m.h];
    }
  }
  return [-1, -1];
}

async function middle(page: Page, x: number, y: number, m: number): Promise<number[]> {
  await lookAt(page, x, y, m);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw();
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const p = new Uint8Array(4);
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return [p[0]!, p[1]!, p[2]!];
  });
}
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test('a lake the coverage has not: water at T1 as at T2, the coverage\'s land at T0', async ({ page }, info) => {
  test.setTimeout(150_000);
  const [lx, ly] = hiddenLake();
  expect(lx, 'a lake of the mask that the coverage has not, in Europe').toBeGreaterThan(0);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // The sea's colour at T1 (the middle of the South Pacific).
  const [ox, oy] = cellOf(-130, -40, W, H);
  const sea = await middle(page, ox, oy, 800);
  const t0 = await middle(page, lx, ly, 3000);
  const t1 = await middle(page, lx, ly, 800);
  await page.screenshot({ path: path.join(out, 'lake-t1.png') });
  const t2 = await middle(page, lx, ly, 100);
  console.log(`lake at cell ${lx.toFixed(2)}, ${ly.toFixed(2)}: T0 ${t0}, T1 ${t1}, T2 ${t2}; the sea ${sea}`);
  expect(dist(t1, sea), 'water at T1').toBeLessThan(12);
  expect(dist(t0, sea), 'the coverage\'s land at T0').toBeGreaterThan(40);
  expect(dist(t2, sea), 'water at T2 (by its depth: a lake is shallow)').toBeLessThan(60);
});
