import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { seaShade } from '../../src/render/map/ground';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7f: the sea at T2 and T3 is shaded by its depth (the elevation's sea floor), not one
// flat colour; at T1 it is one colour. The Dogger Bank in the North Sea (a few tens of metres)
// against the South Pacific (thousands).

const { w: W, h: H } = SIZE_1938;
const lum = (c: number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

/** The map's colour at the middle of the view, on (lon, lat) at `m` m/px. */
async function middle(page: Page, lon: number, lat: number, m: number): Promise<number[]> {
  const [x, y] = cellOf(lon, lat, W, H);
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

test('the sea by its depth at T2: the Dogger Bank light, the South Pacific dark; at T1 one colour', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [bank, ocean] = [[2.5, 54.8], [-130, -40]] as const;
  const t1 = [await middle(page, bank[0], bank[1], 1000), await middle(page, ocean[0], ocean[1], 1000)];
  const t2 = [await middle(page, bank[0], bank[1], 100), await middle(page, ocean[0], ocean[1], 100)];
  console.log(`T1 bank ${t1[0]} ocean ${t1[1]}; T2 bank ${t2[0]} ocean ${t2[1]}`);
  // At T1 the same colour.
  expect(Math.abs(lum(t1[0]!) - lum(t1[1]!))).toBeLessThan(3);
  // At T2 the bank lighter than the sea's colour, the ocean darker: as the ramp has it for a
  // depth of 15 to 40 m and of 4,000 m and more (within the light of the hillshade: none at sea).
  expect(lum(t2[0]!) / lum(t1[0]!)).toBeGreaterThan(seaShade(60) * 0.95);
  expect(lum(t2[1]!) / lum(t1[1]!)).toBeLessThan(seaShade(3000) * 1.05);
  expect(lum(t2[0]!) / lum(t2[1]!)).toBeGreaterThan(1.4);
  // For the eye: the coast of the Netherlands and the shelf, and the Strait of Messina's deep.
  const [nx, ny] = cellOf(4.2, 53.2, W, H);
  await lookAt(page, nx, ny, 150);
  await page.screenshot({ path: path.join(out, 'sea-depth-north-sea-t2.png') });
  const [mx, my] = cellOf(15.6, 38.2, W, H);
  await lookAt(page, mx, my, 150);
  await page.screenshot({ path: path.join(out, 'sea-depth-messina-t2.png') });
});
