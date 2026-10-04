import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { settle } from './settle';

// PLAN 2.7f (ADR-74, finding 1): after a burst of wheel notches at T0 the counters' cluster level
// went back and forth for ever at a resting camera, a split or a merge every 250 ms, and the
// view drew every frame. The level's rule is in tests/unit/counters.test.ts; this is the real
// path: wheel events, the camera's easing, the view's own frames.
//
// Four notches out from 4.3 levels end at 5.59: inside the band of level 5 (up to 5.65) and of
// level 6 (from 5.35), reached while a merge runs. The specs that place the camera in one step
// cannot get there.

const START_LEVEL = 4.3;
const NOTCHES = 4;

test('T0 counters come to rest after a burst of wheel notches', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  // Over central Europe, at the zoom where the counters' continuous level is 4.3.
  await page.evaluate((lv) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: v.controller.cam.cx, cy: v.controller.cam.cy, scale: 64 / 2 ** lv });
  }, START_LEVEL);
  await settle(page);
  const before = await page.evaluate(() => ({ level: window.__warsim!.view!.counters.level, mPerPx: window.__warsim!.view!.metresPerPx }));
  expect(before.level).toBe(4);
  expect(before.mPerPx).toBeGreaterThan(2000); // T0

  // The notches of one flick of the wheel, between two frames. (Sent one by one through
  // Playwright they are 50 ms and more apart: the first merge is over before the zoom is in
  // the overlap, and the old code came to rest too.)
  await page.evaluate((notches) => {
    const canvas = document.querySelector('canvas')!;
    for (let i = 0; i < notches; i++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: 700, clientY: 400, bubbles: true, cancelable: true }));
  }, NOTCHES);
  // The camera eases to its target; then a second for what the zoom started to run out.
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 10_000 });
  const rested = await page.evaluate(() => ({ scale: window.__warsim!.view!.controller.cam.scale, at: performance.now() }));
  expect(Math.log2(64 / rested.scale)).toBeCloseTo(START_LEVEL + NOTCHES * Math.log2(1.25), 2);
  await page.waitForFunction((at) => performance.now() > at + 1000, rested.at);

  // Two seconds at rest, in the view's own frames: one level, nothing animating, nothing drawn.
  const seen = await page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const levels = new Set<number | null>();
    let animating = 0;
    const frames = v.frames;
    const until = performance.now() + 2000;
    while (performance.now() < until) {
      levels.add(v.counters.level);
      if (v.unitsAnimating()) animating++;
      await new Promise((done) => requestAnimationFrame(done));
    }
    return { levels: [...levels], animating, drawn: v.frames - frames };
  });
  console.log(`at rest at ${Math.log2(64 / rested.scale).toFixed(2)} levels: level ${seen.levels.join(', ')}; ${seen.animating} samples animating; ${seen.drawn} frames drawn in 2 s`);
  expect(seen.levels).toHaveLength(1);
  expect(seen.animating).toBe(0);
  expect(seen.drawn).toBeLessThanOrEqual(2);
});
