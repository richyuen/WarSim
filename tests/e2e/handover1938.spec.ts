import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 1.45a AT (critic B7, the "ghost counters"): wherever the camera rests over Europe, in the
// band where the T0 counters and the T1 markers used to cross-fade by zoom (2000–2600 m/px),
// paused or running, one unit layer is drawn at full opacity and the other not at all once the
// unit animations have run. Before: at 8 px per cell (2446 m/px) the counters stood at 0.84 and
// 356 markers at 0.16 behind them, for as long as the camera stayed.

const { w: W, h: H } = SIZE_1938;
const [CX, CY] = cellOf(19.5, 52, W, H); // central Poland

interface Layers {
  mPerPx: number;
  counters: number;
  counterAlphas: number[];
  markers: number;
  markerAlphas: number[];
}

/**
 * Moves the camera to `scale` px per cell, lets the unit animations run, and reads both layers.
 * `running`: the counters never all stand still then, so only the handover is waited for.
 */
async function rest(page: Page, scale: number, running = false): Promise<Layers> {
  await page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx: CX, cy: CY, scale });
  await page.evaluate(() => window.__warsim!.view!.draw()); // the frame that sees the new zoom
  if (running) await page.waitForFunction(() => !window.__warsim!.view!.handover.animating(performance.now()));
  else await settle(page);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw();
    const unique = (a: number[]): number[] => [...new Set(a)];
    return { mPerPx: Math.round(v.metresPerPx), counters: v.counters.drawn.length, counterAlphas: unique(v.counters.drawn.map((d) => d.alpha)), markers: v.markerRects.length, markerAlphas: unique(v.markerRects.map((r) => r.alpha)) };
  });
}
/**
 * `running`: while the armies move, counters keep folding into their neighbours and coming out
 * again (PLAN 1.45b), each with a short fade of its own, so the layer is in full when its most
 * opaque counter is; paused, every counter is. The same for the markers since PLAN 2.7s1: they
 * go into the stacks of their nation and come out of them, each by a fade of its own.
 */
const countersOnly = (l: Layers, what: string, running = false): void => {
  expect(l.counters, what).toBeGreaterThan(20);
  if (running) expect(Math.max(...l.counterAlphas), what).toBe(1);
  else expect(l.counterAlphas, what).toEqual([1]);
  expect(l.markers, what).toBe(0);
};
const markersOnly = (l: Layers, what: string, running = false): void => {
  expect(l.markers, what).toBeGreaterThan(20);
  if (running) expect(Math.max(...l.markerAlphas), what).toBe(1);
  else expect(l.markerAlphas, what).toEqual([1]);
  expect(l.counters, what).toBe(0);
};

test('T0 ↔ T1: a resting camera shows one unit layer in full, never a half-faded copy of the other', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.45') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // Paused, coming from the world view: counters all the way down the old cross-fade band
  // (7.6, 8, 9 and 9.7 px per cell are 2575, 2446, 2174 and 2017 m/px), markers below 2000 m/px.
  countersOnly(await rest(page, 4), 'T0');
  for (const scale of [7.6, 8, 9, 9.7]) {
    const l = await rest(page, scale);
    expect(l.mPerPx).toBeGreaterThan(2000);
    countersOnly(l, `in from T0 at ${l.mPerPx} m/px`);
    if (scale === 8) await page.screenshot({ path: path.join(out, 'europe-2446m-paused.png') });
  }
  markersOnly(await rest(page, 10), 'T1 at 1957 m/px');
  await page.screenshot({ path: path.join(out, 'europe-1957m-paused.png') });

  // Zooming out again the markers stay through the hysteresis (to 2300 m/px), in full, and then
  // the counters have the map alone.
  for (const scale of [9.7, 9]) {
    const l = await rest(page, scale);
    markersOnly(l, `out from T1 at ${l.mPerPx} m/px`);
  }
  countersOnly(await rest(page, 8), 'out from T1 at 2446 m/px');

  // The handover itself: 250 ms of cross-fade, the two layers adding up to one, no pop.
  const frames = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    let now = performance.now();
    v.controller.set({ cx, cy, scale: 10 });
    const res: { counters: number; markers: number }[] = [];
    for (let i = 0; i < 22; i++) {
      v.drawUnitLayers(now);
      // The layer's opacity is its most opaque counter's: counters folding into a neighbour or
      // coming out of one (PLAN 1.45b) fade on their own.
      res.push({ counters: Math.max(0, ...v.counters.drawn.map((d) => d.alpha)), markers: v.markerRects[0]?.alpha ?? 0 });
      now += 16;
    }
    return res;
  }, { cx: CX, cy: CY });
  expect(frames[0]).toEqual({ counters: 1, markers: 0 });
  for (let i = 1; i < frames.length; i++) {
    const [a, b] = [frames[i - 1]!, frames[i]!];
    expect(b.markers, `frame ${i}`).toBeGreaterThanOrEqual(a.markers);
    expect(b.markers - a.markers, `frame ${i}`).toBeLessThan(0.12);
    // A layer below 1% is not drawn at all.
    if (b.counters > 0 && b.markers > 0) expect(b.counters + b.markers, `frame ${i}`).toBeCloseTo(1, 6);
  }
  expect(frames[16]).toEqual({ counters: 0, markers: 1 }); // 256 ms on
  expect(frames[21]).toEqual({ counters: 0, markers: 1 });
  await page.waitForFunction(() => !window.__warsim!.view!.unitsAnimating());

  // Running: the same, while the armies move. A month passes at the top speed, then the camera
  // rests in the band from both sides.
  await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    hud.setSpeedLevel(99);
    if (hud.paused.value) hud.togglePause();
  });
  await page.waitForFunction(() => window.__warsim!.hud.tick.value > 24 * 30, null, { timeout: 120_000 });
  countersOnly(await rest(page, 4, true), 'running, T0', true);
  countersOnly(await rest(page, 8, true), 'running, in from T0 at 2446 m/px', true);
  markersOnly(await rest(page, 10, true), 'running, T1', true);
  markersOnly(await rest(page, 9, true), 'running, out from T1 at 2174 m/px', true);
  countersOnly(await rest(page, 8, true), 'running, out from T1 at 2446 m/px', true);
  await page.screenshot({ path: path.join(out, 'europe-2446m-running.png') });
  await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    if (!hud.paused.value) hud.togglePause();
    hud.setSpeedLevel(4);
  });
});
