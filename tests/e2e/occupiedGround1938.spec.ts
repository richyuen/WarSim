import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, measureGround, open1938 } from './mapView';

// PLAN 2.11f: occupied land is hatched, in stripes of 7 screen px. At T0 and T1 that is the
// picture. At T2 and T3 the stripes lay over the hillshade, the texture and what stands on the
// ground, across the whole view, wherever a war had moved a front: which is where a player
// zooms in. With the ground the hatching now gives way to it: an eighth of it stays, a weave
// about as strong as the ground's own variation on a plain, and the land is told by its tint.
//
// The stripes are known, so they can be measured against whatever else is in the picture: the
// mean brightness of the pixels on a stripe less that of the pixels between two.

const { w: W, h: H } = SIZE_1938;
/** North China at the start of 1938: Japan on China's land for 8 cells all round. */
const POCKET = [1684.5, 364.5] as const;

interface Stripes {
  /** The stripes' contrast: mean brightness on a stripe less between two, of 255. */
  contrast: number;
  /** How much the brightness varies within the stripes' own pixels (a standard deviation): the ground's. */
  spread: number;
  /** The mean colour. */
  mean: [number, number, number];
  px: number;
}

/** The middle 600 × 360 px of the map canvas at rest, without what stands on the ground or the sprites. */
function stripes(page: Page, relief = true): Promise<Stripes> {
  return page.evaluate((relief) => {
    const v = window.__warsim!.view!;
    v.instances = false;
    v.sprites = false;
    v.relief = relief;
    v.draw(performance.now() + 1e6);
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const [w, h] = [600, 360];
    const [x0, y0] = [Math.floor((c.width - w) / 2), Math.floor((c.height - h) / 2)];
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const sum = [0, 0];
    const sq = [0, 0];
    const n = [0, 0];
    const mean: [number, number, number] = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
        // The shader's stripe, at this pixel's middle (gl_FragCoord), one device px to a CSS px.
        const t = (x0 + x + 0.5 + y0 + y + 0.5) / 7;
        const s = t - Math.floor(t) >= 0.5 ? 1 : 0;
        sum[s]! += lum;
        sq[s]! += lum * lum;
        n[s]!++;
        for (let k = 0; k < 3; k++) mean[k]! += px[i + k]!;
      }
    }
    v.relief = true;
    v.instances = true;
    v.sprites = true;
    const m = [sum[0]! / n[0]!, sum[1]! / n[1]!];
    const sd = Math.sqrt(Math.max(0, sq[1]! / n[1]! - m[1]! * m[1]!));
    return { contrast: Math.abs(m[1]! - m[0]!), spread: sd, mean: [mean[0]! / (w * h), mean[1]! / (w * h), mean[2]! / (w * h)] as [number, number, number], px: w * h };
  }, relief);
}

test('occupied land at T2 and T3: the hatching gives way to the ground, and an eighth of it stays', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open1938(page);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  // T1: the hatching as it is, and the picture the same with the ground and without it.
  await lookAt(page, POCKET[0], POCKET[1], 400);
  const t1 = await stripes(page);
  expect((await measureGround(page)).same, 'at T1 the map with the ground and without it').toBe(true);
  console.log(`occupied land, 400 m/px (T1): the stripes' contrast ${t1.contrast.toFixed(1)} of 255, the brightness within them varies by ${t1.spread.toFixed(1)}`);
  expect(t1.contrast, 'the hatching at T1').toBeGreaterThan(8);

  for (const mPerPx of [150, 20]) {
    await lookAt(page, POCKET[0], POCKET[1], mPerPx);
    const whole = await stripes(page, false);
    const got = await stripes(page);
    await page.evaluate(() => window.__warsim!.view!.draw(performance.now() + 1e6));
    await page.screenshot({ path: path.join(out, `occupied-${mPerPx}m.png`) });
    console.log(`occupied land, ${mPerPx} m/px: the stripes' contrast ${got.contrast.toFixed(1)} with the ground (${whole.contrast.toFixed(1)} without it, ${t1.contrast.toFixed(1)} at T1); the ground's own variation ${got.spread.toFixed(1)}`);
    // Without the ground (the switch the tests compare by) the hatching is whole, as at T1.
    expect(Math.abs(whole.contrast - t1.contrast), `${mPerPx} m/px: the hatching without the ground`).toBeLessThan(1);
    // With it: an eighth of the hatching (HATCH_AT_GROUND, 0.12), to within the ground's own
    // doing; and on this plain, the least ground there is to see, the stripes are no stronger
    // than one and a half times the ground's own variation (they were nine times it).
    expect(got.contrast, `${mPerPx} m/px: the hatching with the ground`).toBeLessThan(0.2 * t1.contrast);
    expect(got.contrast, `${mPerPx} m/px: the hatching with the ground`).toBeGreaterThan(0.05 * t1.contrast);
    expect(got.contrast, `${mPerPx} m/px: the stripes against the ground's variation`).toBeLessThan(1.5 * got.spread);
  }

  // Occupied land is still told from the occupier's own: Japan's in north China against Japan's at home.
  await lookAt(page, POCKET[0], POCKET[1], 150);
  const occupied = await stripes(page);
  const [hx, hy] = cellOf(138.2, 36.2, W, H); // Honshu, inland
  await lookAt(page, hx, hy, 150);
  const home = await stripes(page);
  const apart = Math.max(...occupied.mean.map((c, k) => Math.abs(c - home.mean[k]!)));
  console.log(`150 m/px: occupied land's mean colour ${occupied.mean.map((c) => c.toFixed(0)).join(', ')}; the occupier's own land ${home.mean.map((c) => c.toFixed(0)).join(', ')}; home has stripes of ${home.contrast.toFixed(1)}`);
  expect(apart, 'occupied land against the occupier\'s own, the largest difference of a channel').toBeGreaterThan(12);
  expect(home.contrast, 'no hatching on the occupier\'s own land').toBeLessThan(0.1 * t1.contrast);
});
