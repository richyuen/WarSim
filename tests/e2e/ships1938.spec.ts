import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Frame } from '../../src/shared/unitLooks';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7b: ships by class and wakes. The Home Fleet's battle squadron at Scapa Flow, sent east
// into the North Sea: at T2 its elements are drawn as battleships, cruisers and destroyers, each
// class its own sprite, and while it is under way each ship has its wake astern.

const { w: W, h: H } = SIZE_1938;

test('a battle squadron at T2: a sprite for each class of its ships, and wakes while it sails', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // A battle squadron within four cells of Scapa Flow.
  const [sx, sy] = cellOf(-3.1, 58.9, W, H);
  const fleet = await page.evaluate(({ sx, sy }) => {
    const v = window.__warsim!.view!;
    for (const id of v.formationIds()) {
      if (!v.formationAfloat(id) || !/battle/i.test(v.formationTitle(id)?.kind ?? '')) continue;
      const [x, y] = v.formationPos(id)!;
      if (Math.abs(x - sx) <= 4 && Math.abs(y - sy) <= 4) return id;
    }
    return -1;
  }, { sx, sy });
  expect(fleet).toBeGreaterThan(0);
  const at = await page.evaluate((id) => window.__warsim!.view!.formationPos(id)!, fleet);
  // At rest: its sprites by class, no wake.
  await lookAt(page, at[0], at[1], 40);
  await page.waitForFunction((id) => {
    const v = window.__warsim!.view!;
    for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) return true;
    return false;
  }, fleet, { timeout: 30_000 });
  const frames = await page.evaluate((id) => {
    const v = window.__warsim!.view!;
    const out: number[] = [];
    for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) out.push(v.elementFrame(i));
    return out;
  }, fleet);
  expect(new Set(frames)).toEqual(new Set([Frame.battleship, Frame.ship, Frame.destroyer]));
  expect(await page.evaluate(() => window.__warsim!.view!.elementWakes)).toBe(0);
  await page.screenshot({ path: path.join(out, 'ships-t2-at-rest.png') });
  // Sent east into the North Sea, six hours on.
  const [tx, ty] = cellOf(2, 58, W, H);
  await page.evaluate(({ id, tx, ty }) => window.__warsim!.sim.command({ kind: 'moveFormation', id, x: tx, y: ty }), { id: fleet, tx, ty });
  await page.evaluate(() => window.__warsim!.sim.step(6));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 6, null, { timeout: 30_000 });
  const now = await page.evaluate((id) => window.__warsim!.view!.formationPos(id)!, fleet);
  await lookAt(page, now[0], now[1], 40);
  await page.waitForFunction(() => window.__warsim!.view!.elementWakes > 0, null, { timeout: 30_000 });
  const wakes = await page.evaluate(() => window.__warsim!.view!.elementWakes);
  expect(wakes).toBe(frames.length);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'ships-t2-under-way.png') });
  // T3: each ship its own length, its wake astern.
  await lookAt(page, now[0], now[1], 5);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'ships-t3-under-way.png') });
  // At 20 m/px, where a ship's length is a few px, it is drawn its least length (PLAN 4.12c).
  await lookAt(page, now[0], now[1], 20);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'ships-t3-20m.png') });
  console.log(`fleet ${fleet}: ${frames.length} ships (${[...new Set(frames)].join(', ')}), ${wakes} wakes under way`);
});
