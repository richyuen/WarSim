import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.28a: the T0 map at production quality. Regression check for the dashed stair lines
// that appeared inside nations (border width from fwidth() in a divergent branch): pixels deep
// inside a nation show its fill only. Evidence shots of Poland, Europe and the world.

const { w: W, h: H } = SIZE_1938;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

test('no border artefacts inside nations; T0 evidence shots', async ({ page }, info) => {
  test.setTimeout(120_000);
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const ctl = node.world.cells.controller;
  // Polish cells in the band where the stair lines appeared: every cell within 2 is Polish (the
  // true border is ≥ 2.5 cells = 25 px away at 10 px/cell), but a foreign cell lies within 4.
  const allPol = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (ctl[(y + dy) * W + x + dx] !== POL) return false;
    return true;
  };
  // Formation markers have dark detail: skip cells within 2 cells of one.
  const f = node.world.formations.cols;
  const nearUnit = (x: number, y: number): boolean => node.world.formations.ids().some((id) => Math.abs(f.x[id]! - x) < 2.5 && Math.abs(f.y[id]! - y) < 2.5);
  const interior: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (allPol(x, y, 2) && !allPol(x, y, 4) && !nearUnit(x + 0.5, y + 0.5)) interior.push([x + 0.5, y + 0.5]);
  expect(interior.length).toBeGreaterThan(30);
  const c = node.world.nations.cols.color[POL]!;
  const fill = [(c >> 16) & 255, (c >> 8) & 255, c & 255];

  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  // Each band cell centred at 10 px/cell (the zoom where the stairs showed): a 21×21 px patch
  // (±1 cell) must show the Polish fill only.
  const dark = await page.evaluate(
    ({ cells }) => {
      const v = window.__warsim!.view!;
      const cv = document.getElementById('map') as HTMLCanvasElement;
      const gl = cv.getContext('webgl2')!;
      const p = new Uint8Array(21 * 21 * 4);
      let n = 0;
      for (const [x, y] of cells) {
        v.controller.set({ cx: x, cy: y, scale: 10 });
        v.draw();
        gl.readPixels(Math.floor(cv.width / 2) - 10, Math.floor(cv.height / 2) - 10, 21, 21, gl.RGBA, gl.UNSIGNED_BYTE, p);
        for (let i = 0; i < p.length; i += 4) if (p[i]! + p[i + 1]! + p[i + 2]! < 120) n++;
      }
      return n;
    },
    { cells: interior.filter((_, i) => i % Math.max(1, Math.floor(interior.length / 80)) === 0) },
  );
  expect(dark, `dark (border-coloured) pixels inside Poland, fill ${fill}`).toBe(0);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.28') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shots: [string, number, number, number][] = [
    ['t0-poland', 19.5, 52, 10],
    ['t0-europe', 15, 48, 3.2],
    ['t0-world', 30, 25, 0.75],
  ];
  for (const [name, lon, lat, scale] of shots) {
    const [cx, cy] = cellOf(lon, lat, W, H);
    await page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx, cy, scale });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
});
