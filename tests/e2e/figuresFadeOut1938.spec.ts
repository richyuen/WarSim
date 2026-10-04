import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { ZOOM_HYSTERESIS } from '../../src/render/timing';
import { T3_MAX_M } from '../../src/render/units/individuals';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7j (ADR-74, finding 5): the figures that fade out are of the snapshot in hand. Leaving T3
// the figures are drawn for another 250 ms. A snapshot that arrived in that time was not turned
// into figures (the close tier no longer wanted them): the figures of the tick before went on,
// drawn with the new tick's clock, over element sprites that were of the new tick.
//
// Two divisions where nothing else is, the camera at the outer edge of T3. It steps out; one
// division is removed and a tick is stepped while the figures fade; a frame in the middle of the
// fade is drawn. What that frame's figures are built from is read directly: a division that is
// no longer in the snapshot has no figures.

const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const JAP = nation('JAP');
const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1] - 0.3, strength: 0, template: infantry },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1] + 0.3, strength: 0, template: infantry },
];

/** Sends `cmds`, steps one tick and waits for the view to have it. */
async function step(page: Page, cmds: Command[]): Promise<void> {
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, cmds);
}

/** Puts the camera on the site at `mPerPx`, waits for the elements subscribed at that zoom, and rests. */
async function at(page: Page, mPerPx: number): Promise<void> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: SITE[0], y: SITE[1], m: mPerPx });
  await page.waitForFunction((m) => {
    const v = window.__warsim!.view!;
    return v.elementCount > 0 && Math.abs(v.elementsZoom / m - 1) < 0.01;
  }, mPerPx, { timeout: 15_000 });
  await settle(page);
}

/**
 * The figures of the last build: how many, and how many of them belong to each formation.
 * `stepTo`: the camera steps to that zoom first and the frame of the step is drawn; `drawAt`: a
 * frame is drawn at that time first. The step, the frame and the reading are one call into the
 * page: between two calls the view's own loop draws at the time it is, and on a slow machine
 * that is after the fade (seen in a gate run under load: the share read 0 where the frame of the
 * step had 1).
 */
const figures = (page: Page, frame: { stepTo?: number; drawAt?: number } = {}): Promise<{ count: number; byFormation: Record<number, number>; share: number; shown: boolean; buildMs: number; now: number }> =>
  page.evaluate(({ x, y, stepTo, drawAt }) => {
    const v = window.__warsim!.view!;
    let now = drawAt;
    if (stepTo !== undefined) {
      now = performance.now();
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / stepTo });
    }
    if (now !== undefined) v.drawUnitLayers(now);
    const formationOf = new Map<number, number>();
    for (let i = 0; i < v.elementCount; i++) formationOf.set(v.elementId[i]!, v.elementFormation[i]!);
    const byFormation: Record<number, number> = {};
    // A figure whose element is not in the snapshot in hand is counted under 0.
    for (let i = 0; i < v.individualCount; i++) {
      const f = formationOf.get(v.individualOwner[i]!) ?? 0;
      byFormation[f] = (byFormation[f] ?? 0) + 1;
    }
    return { count: v.individualCount, byFormation, share: v.shares.individuals, shown: v.individualsShown, buildMs: v.individualsBuildMs, now: now ?? 0 };
  }, { x: SITE[0], y: SITE[1], ...frame });

test('figures fading out of T3 are built from the snapshot in hand', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await step(page, SETUP);
  const spawned = await page.evaluate(async ([x, y]) => (await window.__warsim!.sim.inspect(true)).formations.filter((f) => Math.abs(f.x - x!) < 2 && Math.abs(f.y - y!) < 2).map((f) => f.id), SITE);
  expect(spawned).toHaveLength(2);
  const [gone, stays] = spawned as [number, number];

  // Into T3, then out to its outer edge: still T3, by the hysteresis.
  await at(page, T3_MAX_M * 0.9998);
  await at(page, T3_MAX_M * ZOOM_HYSTERESIS * 0.9998);
  const before = await figures(page);
  expect(before).toMatchObject({ share: 1, shown: true });
  expect(before.byFormation[gone]).toBeGreaterThan(1000);
  expect(before.byFormation[stays]).toBeGreaterThan(1000);
  expect(before.count).toBe(before.byFormation[gone]! + before.byFormation[stays]!);

  // The step out of T3: the figures begin to fade at `now`.
  const stepped = await figures(page, { stepTo: T3_MAX_M * ZOOM_HYSTERESIS * 1.0002 });
  expect(stepped).toMatchObject({ share: 1, shown: false, count: before.count });
  const now = stepped.now;

  // A tick arrives while they fade, without one of the divisions.
  await step(page, [{ kind: 'removeFormation', id: gone }]);
  expect(await page.evaluate(() => new Set(window.__warsim!.view!.elementFormation).size)).toBe(1);

  // A frame in the middle of the fade.
  const fading = await figures(page, { drawAt: now + 100 });
  console.log(`mid-fade (share ${fading.share.toFixed(2)}): ${fading.count} figures, ${fading.byFormation[stays] ?? 0} of the division that stays, ${fading.byFormation[0] ?? 0} of elements no longer in the snapshot (before: ${before.count}); the build took ${fading.buildMs.toFixed(2)} ms`);
  expect(fading.share).toBeGreaterThan(0.2);
  expect(fading.share).toBeLessThan(0.9);
  expect(fading.byFormation[0] ?? 0, 'figures of elements that are gone').toBe(0);
  expect(fading.count).toBe(before.byFormation[stays]);
  expect(fading.byFormation[stays]).toBe(before.byFormation[stays]);
});
