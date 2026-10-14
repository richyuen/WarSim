import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 6.6 AT (6.6b): a burst's flash, shockwave and mushroom cloud at every tier, scaled;
// screenshots at T0, T1 and T2, looked at. God Mode's bomb on Berlin, the game paused; each shot
// at an age of the burst held (`NukeFx.hold`: a screenshot takes a second and more, and the
// effect would run on meanwhile), so the shot shows what was meant: the flash and the ring at T0,
// the ring and the fireball at T1, the cloud at T2.

const { w: W, h: H } = SIZE_1938;
const berlin = cellOf(13.4, 52.52, W, H);

/** The view at (x, y) at `scale`, the burst `age` ms old, drawn; what the effect showed. */
async function shot(page: Page, scale: number, age: number, dy = 0): Promise<number[]> {
  return page.evaluate(
    ({ x, y, scale, age }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale });
      v.nukeFx.hold = age;
      v.draw();
      return [...v.nukeFx.shown];
    },
    { x: berlin[0], y: berlin[1] - dy, scale, age },
  );
}

test('a nuclear burst\'s flash, shockwave and cloud at T0, T1 and T2', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/6.6') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), { x: berlin[0], y: berlin[1] });
  // God Mode's command, as its tool sends it (`hud.command`: at once while paused, its snapshot with it).
  await page.evaluate(({ x, y }) => window.__warsim!.hud.command({ kind: 'godNuke', x, y, thermonuclear: false }), { x: berlin[0], y: berlin[1] });
  await page.waitForFunction(() => window.__warsim!.view!.nukeFx.bursts.length === 1, null, { timeout: 15_000 });
  // The alert closed: the effect alone in the shots.
  await page.getByTestId('nuke-close').click({ timeout: 15_000 });

  // T0 (6.5 km/px): the flash, the ring and the fireball, a mark at least MIN_PX.
  expect(await shot(page, 3, 180)).toEqual([1, 1, 1]);
  await page.screenshot({ path: path.join(out, 'nuke-t0.png') });
  // T1 (1.2 km/px): the ring running out, the fireball rising.
  expect(await shot(page, 16, 1300)).toEqual([0, 1, 1]);
  await page.screenshot({ path: path.join(out, 'nuke-t1.png') });
  // T2 (196 m/px): the cloud, smoke now; the view a little above the burst for its height.
  expect(await shot(page, 100, 4500, 2.2)).toEqual([0, 0, 1]);
  await page.screenshot({ path: path.join(out, 'nuke-t2.png') });
  // Gone after its time.
  expect(await shot(page, 16, 9500)).toEqual([0, 0, 0]);
});
