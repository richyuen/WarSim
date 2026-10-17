import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.11b (critic run 7, semantic zoom 6 and map visuals 7: "a city that lost 1,025,202 people
// looks the same at 150 m/px ten days later: no scorch or ruin", `critic/shots/c7k_8217_00_berlin_150_before.png`
// against `c7k_8217_03_berlin_150_day10.png`): the bursts the sim remembers come to the page, and a
// struck city is a scorched disc with rubble at T2 and T3 and a mark at T0 and T1. Berlin before
// and ten days after a God Mode warhead: at 150 m/px the effects overlay is dark at Berlin's middle
// (it was clear before), and at 3,000 m/px the burst is a mark.

const { w: W, h: H } = SIZE_1938;

/** The camera on (x, y) at `m` m/px; the frame drawn; the overlay's pixel at the middle and the ruins drawn. */
async function look(page: Page, x: number, y: number, m: number): Promise<{ alpha: number; rgb: number[]; scorched: number; marked: number }> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    const c = (v as unknown as { overlay: HTMLCanvasElement }).overlay;
    const dpr = c.width / c.clientWidth;
    const p = c.getContext('2d')!.getImageData(Math.round((c.clientWidth / 2) * dpr), Math.round((c.clientHeight / 2) * dpr), 1, 1).data;
    return { alpha: p[3]!, rgb: [p[0]!, p[1]!, p[2]!], ...v.ruinsShown };
  });
}

test('a struck city shows it: Berlin before and ten days after a burst', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=8217');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  const before = await look(page, bx, by, 150);
  await page.screenshot({ path: path.resolve('docs/evidence/7.11/b-berlin-150m-before.png'), clip: { x: 400, y: 150, width: 600, height: 500 } });
  await page.evaluate(async ({ x, y }) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'godNuke', x, y, thermonuclear: false });
    const tick = (await sim.step(24 * 10)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { x: bx, y: by });
  await page.waitForFunction(() => window.__warsim!.view!.ruins.length > 0, null, { timeout: 15_000 });
  const after = await look(page, bx, by, 150);
  await page.screenshot({ path: path.resolve('docs/evidence/7.11/b-berlin-150m-day10.png'), clip: { x: 400, y: 150, width: 600, height: 500 } });
  const far = await look(page, bx, by, 3000);
  await page.screenshot({ path: path.resolve('docs/evidence/7.11/b-berlin-3000m-day10.png'), clip: { x: 400, y: 150, width: 600, height: 500 } });
  console.log(`Berlin at 150 m/px: the overlay's middle before ${JSON.stringify(before)}, ten days after ${JSON.stringify(after)}; at 3,000 m/px ${JSON.stringify(far)}`);
  expect(before.scorched + before.marked).toBe(0);
  expect(after.scorched).toBeGreaterThan(0);
  // The scorch over Berlin's middle: more than half opaque, and of a ruin's dark (scorch, or rubble at
  // 120 at most; the city's roofs and streets are lighter).
  expect(after.alpha).toBeGreaterThan(before.alpha + 100);
  expect(Math.max(...after.rgb)).toBeLessThan(130);
  expect(far.marked).toBeGreaterThan(0);
});
