import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open } from './mapView';

// PLAN 7.1l9: the fine land mask is a texture of 2048 × 8192 (eight of its pixels to a texel).
// A GPU whose largest texture is 4096 took none, and the coast of T2 and T3 was the coverage's,
// four times as coarse, with nothing said. The mask goes to the GPU in bands of rows now, as
// many as a band needs to fit: here the view is told the GPU takes no more than 4096 or 2048
// (`?maxTexture=`), and the coast is to be drawn as it is with the GPU's own 16384.

const { w: W, h: H } = SIZE_1938;
/** A coast in each band of rows of four: the Strait of Dover, the Nile's delta, the Cape of Good Hope, Tierra del Fuego. */
const COASTS: [string, number, number][] = [
  ['Dover', 1.4, 51.0],
  ['the Nile', 31.4, 31.4],
  ['the Cape', 18.5, -34.3],
  ['Tierra del Fuego', -67.5, -54.9],
];

/** The map's own picture, without the ground's things and the sprites, every fade over: a hash of its pixels. */
function picture(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.instances = false;
    v.sprites = false;
    v.draw(performance.now() + 1e6);
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let h = 0x811c9dc5;
    for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i]!, 0x01000193);
    return h >>> 0;
  });
}

async function pictures(page: Page, maxTexture: number): Promise<{ bands: number; hashes: number[] }> {
  await open(page, `/?scenario=1938&paused=1&seed=1938${maxTexture ? `&maxTexture=${maxTexture}` : ''}`);
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast && window.__warsim!.view!.maskBands > 0 && window.__warsim!.sim.elevation !== null, null, { timeout: 60_000 });
  const hashes: number[] = [];
  for (const [, lon, lat] of COASTS) {
    const [x, y] = cellOf(lon, lat, W, H);
    for (const mPerPx of [150, 20]) {
      await lookAt(page, x, y, mPerPx);
      hashes.push(await picture(page));
    }
  }
  return { bands: await page.evaluate(() => window.__warsim!.view!.maskBands), hashes };
}

test('a GPU that takes no texture of 8192 draws the fine coast of T2 and T3, the mask in bands', async ({ page }) => {
  test.setTimeout(240_000);
  const own = await pictures(page, 0);
  expect(own.bands).toBe(1);
  for (const [max, bands] of [[4096, 2], [2048, 4]] as const) {
    const got = await pictures(page, max);
    console.log(`largest texture ${max}: the mask in ${got.bands} bands; pictures ${got.hashes.map((h) => h.toString(16)).join(' ')}`);
    expect(got.bands).toBe(bands);
    COASTS.forEach(([name], i) => {
      for (const [k, m] of [[0, 150], [1, 20]] as const) expect(got.hashes[i * 2 + k], `${name} at ${m} m/px, largest texture ${max}`).toBe(own.hashes[i * 2 + k]);
    });
  }
});
