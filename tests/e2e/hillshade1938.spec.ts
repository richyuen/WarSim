import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open, open1938 } from './mapView';
import { settle } from './settle';

// PLAN 2.8a (ADR-78): hillshade. At T2 the map shades the land by the slope of the elevation
// data, the light from the north-west. It comes in with the T1 → T2 handover and is not there at
// T0 and T1; it is a function of the place, so a reload draws the same picture.
//
// The map canvas is read as it is drawn, with the layer and without it (`view.relief`).

const { w: W, h: H } = SIZE_1938;


/**
 * The map canvas at rest, drawn with the layer and without it: whether the two are the same
 * picture, a hash of each, and what the layer does to the fill of the nation that has most of
 * the view (found in the picture without it, where a nation's fill is one colour):
 * - `spread`: the standard deviation of its brightness with the layer (0–255);
 * - `towards`, `away`: its mean brightness where the ground rises to the south-east by more
 *   than 300 m over two cells (it faces the light, which comes from the north-west) and where
 *   it falls by as much (it faces away), by the elevation the worker sent.
 */
function measure(page: Page): Promise<{ same: boolean; hashOn: string; hashOff: string; fill: number; spread: number; towards: number; away: number; nTowards: number; nAway: number }> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const now = performance.now() + 1e6; // every fade is over
    v.instances = false; // the ground alone: what stands on it has a spec of its own (groundThings1938)
    const read = (relief: boolean): Uint8Array => {
      v.relief = relief;
      v.draw(now);
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const hash = (px: Uint8Array): string => {
      let h = 0x811c9dc5;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i]!, 0x01000193);
      return (h >>> 0).toString(16).padStart(8, '0');
    };
    const off = read(false);
    const on = read(true);
    let same = true;
    for (let i = 0; i < on.length && same; i++) same = on[i] === off[i];
    // The fill that has most of the view, by its colour without the layer.
    const counts = new Map<number, number>();
    for (let i = 0; i < off.length; i += 4) {
      const k = (off[i]! << 16) | (off[i + 1]! << 8) | off[i + 2]!;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const [fill, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
    const elev = window.__warsim!.sim.elevation;
    const cam = v.controller.cam;
    const at = (x: number, y: number): number => (elev ? Math.max(0, elev.data[Math.min(elev.h - 1, Math.max(0, y)) * elev.w + (((x % elev.w) + elev.w) % elev.w)]!) : 0);
    let sum = 0;
    let sq = 0;
    const lit = { towards: 0, nTowards: 0, away: 0, nAway: 0 };
    for (let row = 0; row < c.height; row++) {
      for (let col = 0; col < c.width; col++) {
        const i = (row * c.width + col) * 4;
        if (((off[i]! << 16) | (off[i + 1]! << 8) | off[i + 2]!) !== fill) continue;
        const lum = 0.2126 * on[i]! + 0.7152 * on[i + 1]! + 0.0722 * on[i + 2]!;
        sum += lum;
        sq += lum * lum;
        if (!elev) continue;
        // The cell under this pixel (rows are read from the bottom), and the rise to the south-east there.
        const x = Math.floor(cam.cx + (col + 0.5 - c.width / 2) / cam.scale);
        const y = Math.floor(cam.cy + (c.height - row - 0.5 - c.height / 2) / cam.scale);
        const rise = at(x + 1, y) - at(x - 1, y) + at(x, y + 1) - at(x, y - 1);
        if (rise > 300) {
          lit.towards += lum;
          lit.nTowards++;
        } else if (rise < -300) {
          lit.away += lum;
          lit.nAway++;
        }
      }
    }
    const mean = sum / Math.max(1, n);
    return {
      same,
      hashOn: hash(on),
      hashOff: hash(off),
      fill: n / (c.width * c.height),
      spread: Math.sqrt(Math.max(0, sq / Math.max(1, n) - mean * mean)),
      towards: lit.towards / Math.max(1, lit.nTowards),
      away: lit.away / Math.max(1, lit.nAway),
      nTowards: lit.nTowards,
      nAway: lit.nAway,
    };
  });
}

test('at T2 the land is shaded by its relief, lit from the north-west; at T0 and T1 the map is as it was', async ({ page }, info) => {
  test.setTimeout(150_000);
  await open1938(page);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.8') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [ax, ay] = cellOf(10.5, 46.6, W, H); // the central Alps

  // T2, two zooms: the layer is there, and the slopes that face the light are the brighter.
  for (const mPerPx of [250, 100]) {
    await lookAt(page, ax, ay, mPerPx);
    const m = await measure(page);
    console.log(`the Alps, ${mPerPx} m/px: the largest fill has ${(m.fill * 100).toFixed(0)}% of the view; its brightness varies by ${m.spread.toFixed(1)} of 255; facing the light ${m.towards.toFixed(1)} (${m.nTowards} px), facing away ${m.away.toFixed(1)} (${m.nAway} px)`);
    await page.screenshot({ path: path.join(out, `hillshade-alps-${mPerPx}m.png`) });
    expect(m.fill, `${mPerPx} m/px: a fill to measure`).toBeGreaterThan(0.1);
    expect(m.same, `${mPerPx} m/px: the layer changes the picture`).toBe(false);
    expect(m.spread, `${mPerPx} m/px: the spread of the fill's brightness`).toBeGreaterThan(4);
    expect(Math.min(m.nTowards, m.nAway), `${mPerPx} m/px: slopes of both kinds in the fill`).toBeGreaterThan(2000);
    expect(m.towards - m.away, `${mPerPx} m/px: slopes facing the light against those facing away`).toBeGreaterThan(6);
  }

  // T1 and T0: the layer adds nothing, pixel for pixel.
  for (const mPerPx of [1000, 4000]) {
    await lookAt(page, ax, ay, mPerPx);
    const m = await measure(page);
    console.log(`the Alps, ${mPerPx} m/px: with the layer ${m.hashOn}, without it ${m.hashOff}`);
    expect(m.same, `${mPerPx} m/px: the map with the layer and without it`).toBe(true);
  }
});

test('the hillshade of a place is the same after a reload', async ({ page }) => {
  test.setTimeout(150_000);
  const [rx, ry] = cellOf(-106.5, 39.5, W, H); // the Rockies: no army stands there in 1938
  const hashes: string[] = [];
  for (let load = 0; load < 2; load++) {
    await open1938(page);
    await lookAt(page, rx, ry, 150);
    const m = await measure(page);
    expect(await page.evaluate(() => window.__warsim!.view!.elementCount), 'no sprites in the view').toBe(0);
    expect(m.same, 'the layer is there').toBe(false);
    hashes.push(m.hashOn);
  }
  console.log(`the Rockies at 150 m/px, two loads: ${hashes.join(', ')}`);
  expect(hashes[1]).toBe(hashes[0]);
});

test('a world without elevation draws as before', async ({ page }) => {
  await open(page, '/?scenario=toy&paused=1');
  await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = v.controller.cam;
    v.controller.set({ cx: c.cx, cy: c.cy, scale: (v.metresPerPx * c.scale) / 150 });
  });
  await settle(page);
  const m = await measure(page);
  expect(m.same, 'the toy world at T2, with the layer and without it').toBe(true);
});
