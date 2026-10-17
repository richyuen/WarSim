import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { HULL_LIFE_MS } from '../../src/render/fx/hulls';
import { armourLosses } from '../helpers/armourLosses';

// PLAN 7.9a (critic run 7, tanks 5: "`wrecks` read `null` at every tier ... I saw no wreck"): the
// critic's hook read `wrecks.count`, which the view's wrecks had not, and a hull went in 17.5 s of
// the clock, paused or not. An armour fight at T3 (ground where armour loses tanks under fire,
// found in Node): the hours stepped until hulls lie there, then the game left paused for more than
// a hull's time on the clock: they are still counted and drawn (held until the game is
// WRECK_HOLD_HOURS past them), and both effects give a count.

const M_PER_PX = 4;

test('T3: the hulls of a fight are counted and stay while the game is paused', async ({ page }) => {
  test.setTimeout(300_000);
  const node = armourLosses(14, 120, 12, 5, true);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async (n) => {
    await window.__warsim!.sim.step(n);
  }, node.start);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: node.x, y: node.y, m: M_PER_PX });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.snapshots > 0 && v.individualsShown;
  }, null, { timeout: 15_000 });
  // Both effects give their count to the hook.
  expect(typeof (await page.evaluate(() => window.__warsim!.view!.wrecks.count))).toBe('number');
  // Hour by hour until hulls lie in the view.
  const first = await page.evaluate(async (start) => {
    const v = window.__warsim!.view!;
    for (let h = 1; h <= 12; h++) {
      const tick = start + h;
      await window.__warsim!.sim.step(1);
      await new Promise<void>((done) => {
        const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      if (v.hulls.count > 0) return { hours: h, count: v.hulls.count };
    }
    return null;
  }, node.start);
  expect(first, 'hulls within 12 hours on the ground where armour loses tanks').not.toBeNull();
  // Paused: more than a hull's time on the clock passes.
  await page.waitForTimeout(HULL_LIFE_MS + 2500);
  const later = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.drawUnitLayers(performance.now());
    return { count: v.hulls.count, shown: v.hulls.shown.length };
  });
  console.log(`hulls after ${first!.hours} h: ${first!.count}; ${(HULL_LIFE_MS + 2500) / 1000} s later, paused: ${later.count}, ${later.shown} drawn`);
  expect(later.count).toBe(first!.count);
  expect(later.shown).toBeGreaterThan(0);
  await page.screenshot({ path: path.resolve('docs/evidence/7.9/a-hulls-held-t3.png'), clip: { x: 300, y: 150, width: 800, height: 500 } });
});
