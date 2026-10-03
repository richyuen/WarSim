import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.33a AT: take control of Poland, order a move, and the formation moves. Selection is by a
// real click on the formation's marker and the order by a real click on the map; the player's
// nation has its AI off, so its other formations stay where they are.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

test('take control of Poland, select a formation, order a move: it marches', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });

  // Select Poland and take control from its panel.
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('release-control')).toBeVisible();
  await expect(page.getByTestId('player-label')).toContainText('Poland');
  await expect.poll(async () => (await page.evaluate(() => window.__warsim!.sim.inspect())).nations.find((n) => n.id === POL)!.aiOff).toBe(true);

  // Centre the camera on one Polish formation and click its marker.
  const ids = await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), POL);
  const unit = ids[0]!;
  const others = ids.slice(1);
  const start = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), unit))!;
  const othersBefore = await page.evaluate((os) => os.map((id) => window.__warsim!.view!.formationPos(id)), others);
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), start);
  await page.waitForTimeout(200);
  // The marker sits at the screen centre; other units may overlap, so pick whichever is nearest.
  const picked = await page.evaluate((p) => window.__warsim!.view!.formationAt(700, 400, p), POL);
  expect(picked).not.toBe(0);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  expect(await page.evaluate(() => [...window.__warsim!.view!.selectedFormations])).toEqual([picked]);

  // Order: a point 10 cells to the west (Polish land, 160 px at scale 16), clear of markers.
  const from = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), picked))!;
  const target = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const [tx, ty] = v.cellAt(540, 400)!;
    return [tx + 0.5, ty + 0.5] as const;
  });
  expect(await page.evaluate((p) => window.__warsim!.view!.formationAt(540, 400, p), POL)).toBe(0); // a move, not a reselect
  await page.mouse.click(540, 400);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.33') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'player-order.png') });

  // Run two days: the ordered formation approaches the target; the others stay put (AI off).
  await page.evaluate(() => window.__warsim!.sim.step(48));
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, 48, { timeout: 30_000 });
  const after = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), picked))!;
  const d0 = Math.hypot(from[0] - target[0], from[1] - target[1]);
  const d1 = Math.hypot(after[0] - target[0], after[1] - target[1]);
  expect(d1).toBeLessThan(d0 - 2);
  const othersAfter = await page.evaluate((os) => os.map((id) => window.__warsim!.view!.formationPos(id)), others);
  othersAfter.forEach((p, i) => {
    if (others[i] !== picked) expect(p).toEqual(othersBefore[i]);
  });
  await page.screenshot({ path: path.join(out, 'player-moved.png') });

  // Escape clears the selection; releasing control hands Poland back to its AI.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('player-label')).toContainText('0 selected');
  await page.getByTestId('release-control').click();
  await expect(page.getByTestId('player-label')).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => window.__warsim!.sim.inspect())).nations.find((n) => n.id === POL)!.aiOff).toBe(false);
});
