import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 2.7m: the view finishes what a frame started, however late the next frame comes.
//
// The view's loop asked "is anything animating?" before it drew. For a change that the draw
// itself starts the answer is "no", and once the clock is past the change's end it is "no"
// again: a camera step and then a gap of more than 300 ms was followed by no draw at all. The
// counters stayed at the first frame of their split, on their parents' centroids; across the
// T0/T1 boundary the handover stayed at its first frame, the counters in full at a zoom of
// markers. `settle` in the specs draws by itself, so no spec saw it.
//
// The turns of the loop are made here, at times the test gives, in one call into the page: the
// browser's own frames cannot come between them.

const { w: W, h: H } = SIZE_1938;
const [EX, EY] = cellOf(15, 50, W, H); // Europe

test('a frame that comes late still draws the end of what a camera step started', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });

  const runs = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    let now = performance.now() + 60_000; // ahead of every frame the view's own loop has drawn
    const perCell = (m: number): number => (v.metresPerPx * v.controller.cam.scale) / m;
    /** A step of the camera, then turns of the loop `dt` ms apart until one draws nothing. */
    const step = (scale: number, dt: number): { drew: number; level: number | null; keys: string[]; full: boolean; animating: boolean; markers: number } => {
      v.controller.set({ cx, cy, scale });
      let drew = 0;
      for (; v.frameAt(now); now += dt) if (++drew > 500) throw new Error('the view never comes to rest');
      const d = v.counters.drawn;
      return { drew, level: v.counters.level, keys: d.map((c) => c.key).sort(), full: d.every((c) => c.alpha === 1), animating: v.unitsAnimating(now), markers: v.shares.markers };
    };
    // T0 at 1.5 px per cell; T0 closer, at another cluster level (a split); T1 (the handover);
    // back out to T0 (the handover again); and further out (a merge). The last stop is not the
    // first, so that the second run begins with a step too.
    const stops = [1.5, 6, perCell(1500), 6, 3];
    return [16, 400].map((dt) => stops.map((scale) => step(scale, dt)));
  }, { cx: EX, cy: EY });

  const [close, late] = runs as [typeof runs[number], typeof runs[number]];
  console.log(`turns of the loop that drew, frames 16 ms apart: ${close.map((s) => s.drew).join(', ')}; 400 ms apart: ${late.map((s) => s.drew).join(', ')}; levels ${late.map((s) => s.level).join(', ')}; markers' share ${late.map((s) => s.markers).join(', ')}`);
  // The stops are what the comment says: two T0 levels, then markers alone, then counters again.
  expect(close[0]!.level).not.toBe(close[1]!.level);
  expect(close.map((s) => s.markers)).toEqual([0, 0, 1, 0, 0]);
  expect(close[2]!.keys).toEqual([]);
  for (const k of [0, 1, 3, 4]) expect(close[k]!.keys.length, `stop ${k}`).toBeGreaterThan(20);
  for (const [k, s] of late.entries()) {
    // The step's frame started something, and frames came after it though they came late.
    expect(s.drew, `stop ${k}, frames 400 ms apart`).toBeGreaterThanOrEqual(2);
    // And the view rests on the end of it: the picture that close frames end with.
    expect({ ...s, drew: 0 }, `stop ${k}, frames 400 ms apart`).toEqual({ ...close[k]!, drew: 0 });
    expect(s.full && !s.animating, `stop ${k}: at rest, the counters in full`).toBe(true);
  }
});
