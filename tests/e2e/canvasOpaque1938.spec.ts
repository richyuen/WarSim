import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 2.11m (a suspicion of the fifth independent read, settled in the browser). The element
// sprites, the figures and the ground's instances blended their alpha as they blend their
// colour, into a canvas that has alpha: under a tree's shadow or a sprite's soft edge the
// canvas ended at an alpha of 0.54 to 0.78, and the page's background showed through there.
// What `readPixels` gives a test was not what the page shows.
//
// So the page is looked at: a screenshot, with everything but the map's canvas hidden, against
// the canvas's own pixels.

const { w: W, h: H } = SIZE_1938;
const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const SETUP: Command[] = [
  { kind: 'setAi', nation: nation('JAP'), enabled: false },
  { kind: 'spawnFormation', nation: nation('JAP'), x: SITE[0], y: SITE[1] - 0.3, strength: 0, template: template('infantry_div') },
  { kind: 'spawnFormation', nation: nation('JAP'), x: SITE[0], y: SITE[1] + 0.3, strength: 0, template: template('panzer_div') },
];

interface Look {
  /** Pixels of the canvas with alpha under 255, and the least alpha. */
  under: number;
  least: number;
  /** Pixels of the page that are not the canvas's colour (by more than 1 of 255 in a channel), and the largest difference. */
  differ: number;
  worst: number;
  total: number;
  instances: number;
  sprites: number;
  figures: number;
}

/** The view at rest, drawn once with its loop stopped: the canvas's pixels, and the page's. */
async function pageAgainstCanvas(page: Page): Promise<Look> {
  const canvas = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.dispose();
    const map = document.getElementById('map') as HTMLCanvasElement;
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) if (el !== map && !el.contains(map)) el.style.visibility = 'hidden';
    v.draw(performance.now() + 1e6);
    const gl = map.getContext('webgl2')!;
    const px = new Uint8Array(map.width * map.height * 4);
    gl.readPixels(0, 0, map.width, map.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    (window as unknown as { __canvasPx: Uint8Array }).__canvasPx = px;
    let under = 0;
    let least = 255;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i]! < 255) under++;
      if (px[i]! < least) least = px[i]!;
    }
    return { under, least, total: px.length / 4, instances: v.groundScatter?.count ?? 0, sprites: v.elementCount, figures: v.individualCount, size: [map.width, map.height, map.clientWidth, map.clientHeight] };
  });
  // One device pixel to a CSS pixel: the screenshot and the canvas are the same grid.
  expect(canvas.size.slice(0, 2)).toEqual(canvas.size.slice(2));
  const shot = (await page.screenshot({ type: 'png' })).toString('base64');
  const page_ = await page.evaluate(async (b64) => {
    const map = document.getElementById('map') as HTMLCanvasElement;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    [c.width, c.height] = [bitmap.width, bitmap.height];
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    const r = map.getBoundingClientRect();
    const got = ctx.getImageData(Math.round(r.left), Math.round(r.top), map.width, map.height).data;
    const px = (window as unknown as { __canvasPx: Uint8Array }).__canvasPx;
    let differ = 0;
    let worst = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const a = (y * map.width + x) * 4;
        const b = ((map.height - 1 - y) * map.width + x) * 4; // the canvas's rows are bottom up
        const d = Math.max(Math.abs(got[a]! - px[b]!), Math.abs(got[a + 1]! - px[b + 1]!), Math.abs(got[a + 2]! - px[b + 2]!));
        if (d > 1) differ++;
        if (d > worst) worst = d;
      }
    }
    return { differ, worst };
  }, shot);
  return { under: canvas.under, least: canvas.least, total: canvas.total, instances: canvas.instances, sprites: canvas.sprites, figures: canvas.figures, ...page_ };
}

test('the map canvas is opaque: the page shows the colours the canvas has, under trees and under sprites', async ({ page }) => {
  test.setTimeout(240_000);
  const views: { name: string; at: readonly [number, number]; m: number; setup?: Command[] }[] = [
    { name: 'a forest at T2', at: cellOf(26.0, 62.5, W, H), m: 100 },
    { name: 'a forest at T3', at: cellOf(26.0, 62.5, W, H), m: 10 },
    { name: 'two divisions at T2', at: SITE, m: 60, setup: SETUP },
    { name: 'two divisions at T3', at: SITE, m: 12, setup: SETUP },
  ];
  for (const v of views) {
    // A page to a view: the look stops the view's loop and hides the rest of the page.
    await open1938(page);
    if (v.setup) {
      await page.evaluate(async (cmds) => {
        const sim = window.__warsim!.sim;
        for (const c of cmds) sim.command(c);
        const tick = (await sim.step(1)).tick;
        await new Promise<void>((done) => {
          const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
          wait();
        });
      }, v.setup);
    }
    await lookAt(page, v.at[0], v.at[1], v.m);
    if (v.setup) await page.waitForFunction((t3) => window.__warsim!.view!.elementCount > 0 && (!t3 || window.__warsim!.view!.individualCount > 0), v.m < 30, { timeout: 15_000 });
    await lookAt(page, v.at[0], v.at[1], v.m);
    const got = await pageAgainstCanvas(page);
    console.log(`${v.name}, ${v.m} m/px: ${got.instances} instances, ${got.sprites} sprites, ${got.figures} figures; ${got.under} of ${got.total} px of the canvas with alpha under 255 (the least ${got.least}); ${got.differ} px of the page are not the canvas's colour (the largest difference ${got.worst} of 255)`);
    // Something that blends is in the view.
    if (v.setup) expect(v.m < 30 ? got.figures : got.sprites, v.name).toBeGreaterThan(40);
    else expect(got.instances, v.name).toBeGreaterThan(1000);
    expect(got.under, `${v.name}: px of the canvas with alpha under 255`).toBe(0);
    expect(got.differ, `${v.name}: px of the page that are not the canvas's colour`).toBe(0);
  }
});
