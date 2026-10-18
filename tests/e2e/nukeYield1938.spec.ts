import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.20 (critic R8-B3, `critic/shots/c8b_berlin_A_vs_H_300m.png`: an atomic and a hydrogen bomb's
// ruins at Berlin could not be told apart at 300 m/px): each bomb on Berlin in a world of its own
// (seed 4711, the critic's), ten days after, at 300 m/px. The scorch is the blast's radius: about
// 83 px a fission bomb's, the cube root of THERMO_YIELD times that a thermonuclear one's. Measured on
// the effects overlay in eight directions from the burst: the median alpha at 50 px (both dark) and at
// 160 px (past the atomic ruin, inside the hydrogen one).

const { w: W, h: H } = SIZE_1938;
const M = 300;
const NEAR = 50;
const PAST = 160;

async function ruinAt(page: Page, thermonuclear: boolean): Promise<{ near: number; past: number }> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=4711');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  await page.evaluate(async ({ x, y, thermonuclear }) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'godNuke', x, y, thermonuclear });
    const tick = (await sim.step(24 * 10)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { x: bx, y: by, thermonuclear });
  await page.waitForFunction(() => window.__warsim!.view!.ruins.length > 0, null, { timeout: 15_000 });
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: bx, y: by, m: M });
  await page.waitForTimeout(1500);
  // The ruin alone: the burst's flash and cloud (the render clock's, seconds) cleared.
  const a = await page.evaluate(({ near, past }) => {
    const v = window.__warsim!.view!;
    v.nukeFx.clear();
    v.draw(performance.now());
    const c = (v as unknown as { overlay: HTMLCanvasElement }).overlay;
    const dpr = c.width / c.clientWidth;
    const ctx = c.getContext('2d')!;
    const median = (d: number): number => {
      const xs: number[] = [];
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2;
        const px = ctx.getImageData(Math.round((c.clientWidth / 2 + Math.cos(t) * d) * dpr), Math.round((c.clientHeight / 2 + Math.sin(t) * d) * dpr), 1, 1).data;
        xs.push(px[3]!);
      }
      xs.sort((p, q) => p - q);
      return (xs[3]! + xs[4]!) / 2;
    };
    return { near: median(near), past: median(past) };
  }, { near: NEAR, past: PAST });
  await page.screenshot({ path: path.resolve(`docs/evidence/7.20/berlin-${thermonuclear ? 'H' : 'A'}-300m-day10.png`), clip: { x: 300, y: 50, width: 800, height: 700 } });
  return a;
}

test('a hydrogen bomb\'s ruin is told from an atomic one\'s at 300 m/px (Berlin, ten days after)', async ({ page }) => {
  test.setTimeout(300_000);
  const atomic = await ruinAt(page, false);
  const hydrogen = await ruinAt(page, true);
  console.log(`Berlin at ${M} m/px, the overlay's median alpha at ${NEAR} and ${PAST} px: atomic ${atomic.near}, ${atomic.past}; hydrogen ${hydrogen.near}, ${hydrogen.past}`);
  // Both dark at the middle.
  expect(atomic.near).toBeGreaterThan(60);
  expect(hydrogen.near).toBeGreaterThan(60);
  // Past the atomic ruin's edge: clear for it, dark for the hydrogen one.
  expect(atomic.past).toBeLessThan(20);
  expect(hydrogen.past).toBeGreaterThan(60);
});
