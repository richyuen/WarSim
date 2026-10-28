import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

// PLAN 7.154a (critic run 17, seed 99 hour 3): a carrier's strike ashore, out of any sea battle (ADR-738), was drawn
// as land-based planes with no row in the ticker. Now the ticker has a row for it, by the carrier's nation and its
// target's ("Carrier strike ashore: Japan on China"), and a click on it frames the carrier's fleet and its target.

test("a carrier's strike ashore has a ticker row naming the carrier's nation and its target; its click frames both (seed 99)", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=99');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.154') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const raid = page.locator('[data-testid="carrier-raid-row"]');
  let hour = 0;
  for (; hour < 48 && (await raid.count()) === 0; hour++) {
    await page.evaluate(async () => {
      const { sim, view } = window.__warsim!;
      const t = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick >= t ? done() : void setTimeout(wait, 5));
        wait();
      });
    });
    await page.waitForTimeout(50);
  }
  expect(await raid.count(), 'a carrier strike row out of a battle within 48 hours').toBeGreaterThan(0);
  const first = raid.first();
  const text = (await first.textContent()) ?? '';
  const r = await page.evaluate(() => window.__warsim!.hud.carrierRaids.value[0]!);
  console.log(`seed 99, hour ${hour}: "${text.trim()}" (fleet ${r.fleet}, ashore ${r.ashore})`);
  expect([r.by, r.on, r.ashore]).toEqual([id('JAP'), id('CHI'), true]);
  expect(text).toContain('Carrier strike ashore: Japan on China');
  await page.screenshot({ path: path.join(out, 'a-raid-row-99.png') });
  await first.click();
  // Framed: the carrier's fleet and its target both on the screen once the camera's flight ends.
  await page.waitForFunction(
    ({ kx, ky, tx, ty }) => {
      const cam = window.__warsim!.view!.controller.cam;
      const inside = (x: number, y: number): boolean => {
        const [px, py] = [(x - cam.cx) * cam.scale + window.innerWidth / 2, (y - cam.cy) * cam.scale + window.innerHeight / 2];
        return px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight;
      };
      return inside(kx, ky) && inside(tx, ty) && cam.scale > 4;
    },
    r,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'b-raid-framed-99.png') });
});
