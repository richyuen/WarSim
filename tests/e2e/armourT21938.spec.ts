import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 7.9d (critic run 7, tanks 5: "at T2 nothing tells armour from infantry but the counter's
// text"): where elements are at their least size (5 px, from about 100 m/px out) a tank element
// and a battalion were the same few pixels, and a division's block one patch either way. A tank
// element is now the tank's small mark, a solid slab, at TANK_ELEMENT_MIN_PX (8). A German panzer
// division and a German infantry division at rest, side by side west of Berlin, at 120 m/px: the
// pixels unlike the ground about each, per element: the panzer division's 1.8 times the other's (an
// 8-px slab at most (8 / 5)² of a 5-px mark; without the least size 1.55, with it 2.07).

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const PANZER = TEMPLATES_LAND.findIndex((t) => t.id === 'panzer_div');
const INFANTRY = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const { w: W, h: H } = SIZE_1938;

test('T2: a panzer division is a larger patch than an infantry division, element for element', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  // West of Berlin, a cell and a half apart.
  const at = { x: Math.floor(bx) - 4 + 0.5, y: Math.floor(by) + 0.5 };
  const ids = await page.evaluate(async ({ GER, PANZER, INFANTRY, at }) => {
    const { sim, view } = window.__warsim!;
    const before = new Set(view!.formationsOf(GER));
    sim.command({ kind: 'spawnFormation', nation: GER, x: at.x - 0.75, y: at.y, strength: 0, template: PANZER });
    sim.command({ kind: 'spawnFormation', nation: GER, x: at.x + 0.75, y: at.y, strength: 0, template: INFANTRY });
    const tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    return view!.formationsOf(GER).filter((f) => !before.has(f));
  }, { GER, PANZER, INFANTRY, at });
  expect(ids).toHaveLength(2);
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 120 });
  }, at);
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 2 && window.__warsim!.view!.elementCount > 0, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);

  const got = await page.evaluate((ids) => {
    const v = window.__warsim!.view!;
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    v.draw(performance.now());
    const dpr = canvas.width / canvas.clientWidth;
    const cam = v.controller.cam;
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    const R = 60;
    return ids.map((f) => {
      let [x, y, n] = [0, 0, 0];
      for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === f) [x, y, n] = [x + v.elementX[i]!, y + v.elementY[i]!, n + 1];
      const sx = (x / n - cam.cx) * cam.scale + vw / 2;
      const sy = (y / n - cam.cy) * cam.scale + vh / 2;
      const side = Math.round(2 * R * dpr);
      const px = new Uint8Array(4 * side * side);
      gl.readPixels(Math.round((sx - R) * dpr), canvas.height - Math.round((sy + R) * dpr), side, side, gl.RGBA, gl.UNSIGNED_BYTE, px);
      // The ground: the box's edge, its mean colour.
      const g = [0, 0, 0];
      let e = 0;
      for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) if (i === 0 || j === 0 || i === side - 1 || j === side - 1) {
        for (let c = 0; c < 3; c++) g[c] = g[c]! + px[(j * side + i) * 4 + c]!;
        e++;
      }
      let unlike = 0;
      for (let k = 0; k < side * side; k++) if (Math.hypot(px[k * 4]! - g[0]! / e, px[k * 4 + 1]! - g[1]! / e, px[k * 4 + 2]! - g[2]! / e) > 40) unlike++;
      return { f, elements: n, perElement: unlike / (dpr * dpr) / n, kind: v.formationTitle(f)?.kind ?? '' };
    });
  }, ids);
  const panzer = got.find((g) => /Armou?red|Panzer|Tank/i.test(g.kind))!;
  const infantry = got.find((g) => g !== panzer)!;
  const px = await page.evaluate(() => window.__warsim!.view!.elementPx);
  console.log(`at 120 m/px (element ${px.toFixed(1)} px): ${panzer.kind} ${panzer.elements} elements, ${panzer.perElement.toFixed(1)} px² each unlike the ground; ${infantry.kind} ${infantry.elements}, ${infantry.perElement.toFixed(1)}`);
  await page.screenshot({ path: path.resolve('docs/evidence/7.9/d-armour-t2-120m.png'), clip: { x: 450, y: 250, width: 500, height: 300 } });
  expect(panzer.perElement, 'a panzer division against an infantry division, pixels per element').toBeGreaterThan(1.8 * infantry.perElement);
});
