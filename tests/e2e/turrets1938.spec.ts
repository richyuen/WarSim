import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { armourFires, busiest } from '../helpers/armourFire';

// PLAN 3.6b AT: the turrets of tanks in contact are not all at their hulls' facing. Two weeks
// into 1938 the square with the most armour firing is found in Node, the camera is put on it at
// T2, one hour is stepped, and the turrets are read from the instance data of frames drawn at
// chosen times: before the shots, as the last has left, and after the silence.

const START = 24 * 14;
const M_PER_PX = 60;
const CLOSE_M_PER_PX = 4;
const NEAR_M_PER_PX = 1.5;

/** The angle from `a` to `b`, in (−π, π]. */
const off = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

test('T2 and T3: a tank that fires has its turret on its target, and back on its hull after a silence', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = armourFires(START);
  expect(node.fires.length).toBeGreaterThan(30);
  const [cx, cy] = busiest(node.fires);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, START)).toEqual({ tick: START, hash: node.before });

  const lookAt = async (m: number, x: number, y: number, tier: number): Promise<void> => {
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x, y, m });
    await page.waitForFunction(({ x, y, tier }) => {
      const v = window.__warsim!.view!;
      // The view's own loop, or a turn of it once the test has stopped it: it subscribes.
      v.frameAt(performance.now());
      const b = v.subscription?.bbox;
      return v.subscription?.tier === tier && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.elementCount > 0 && v.elementsZoom < 1.01 * v.metresPerPx;
    }, { x, y, tier }, { timeout: 15_000 });
  };
  await lookAt(M_PER_PX, cx, cy, 2);
  expect(await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.step(1);
    return sim.hash();
  })).toEqual({ tick: START + 1, hash: node.after });
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick === t, START + 1);

  // The frame loop is stopped: every frame from here on is drawn at a time of the test's choosing.
  const t2 = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.dispose();
    const turrets = (now: number): { id: number; hull: number; turret: number }[] => {
      v.draw(now);
      return Array.from({ length: v.elementTurrets }, (_, k) => {
        const i = v.elementTurretOwner[k]!;
        return { id: v.elementId[i]!, hull: v.elementFacing(i), turret: v.elementTurretFacing(k) };
      });
    };
    const fired = Math.max(...v.fire.shots.map((s) => s.start));
    const before = turrets(v.fire.from);
    const animatingAtShot = v.unitsAnimating(fired);
    const at = turrets(fired);
    const over = v.turretAims.until + 100;
    const after = turrets(over);
    v.draw(fired);
    return { before, at, after, animatingAtShot, animatingAfter: v.unitsAnimating(over), fired, shots: v.fire.shots.map((s) => ({ ...s })), skipped: v.fire.skipped, wait: over - v.fire.from };
  });
  expect(t2.skipped).toBe(0);
  const tanks = new Set(node.fires.map((f) => f.shooter));
  const shotOf = new Map(t2.shots.map((s) => [s.shooter, s]));
  const firing = t2.at.filter((t) => tanks.has(t.id));
  expect(firing.length).toBeGreaterThan(20);
  expect(t2.at.length).toBeGreaterThan(firing.length); // some tanks in the view do not fire

  // Before the first shot every turret is at its hull's facing.
  for (const t of t2.before) expect(t.turret, `turret of ${t.id} before`).toBe(t.hull);
  // As the last shot leaves, a tank that fired has its turret along the line to its target, and
  // one that did not has it on its hull.
  let turned = 0;
  for (const t of t2.at) {
    const s = shotOf.get(t.id);
    if (!tanks.has(t.id)) {
      expect(t.turret, `turret of ${t.id}, silent`).toBe(t.hull);
      continue;
    }
    expect(s, `the shot of ${t.id}`).toBeDefined();
    expect(Math.abs(off(t.turret, Math.atan2(s!.y1 - s!.y0, s!.x1 - s!.x0))), `turret of ${t.id}`).toBeLessThan(1e-5);
    if (Math.abs(off(t.hull, t.turret)) > 0.02) turned++;
  }
  // The AT: the turrets of a division in contact are not all at the hull's facing.
  expect(turned).toBeGreaterThan(firing.length / 2);
  expect(t2.animatingAtShot).toBe(true);
  // After the silence they are back, and the view is at rest.
  for (const t of t2.after) expect(t.turret, `turret of ${t.id} after`).toBe(t.hull);
  expect(t2.animatingAfter).toBe(false);
  expect(t2.wait).toBeLessThan(3500);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.6') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'turrets-60m.png') });

  // T3: every tank of an element that fired has its turret where the element's is. The tank
  // looked at is the one whose turret is furthest off its hull.
  const far = firing.reduce((a, b) => (Math.abs(off(a.hull, a.turret)) >= Math.abs(off(b.hull, b.turret)) ? a : b));
  const shot = shotOf.get(far.id)!;
  await lookAt(CLOSE_M_PER_PX, shot.x0, shot.y0, 3);
  const t3 = await page.evaluate(({ fired, id }) => {
    const v = window.__warsim!.view!;
    v.draw(fired);
    const all = Array.from({ length: v.individualTurrets }, (_, k) => {
      const j = v.individualTurretOwner[k]!;
      return { id: v.individualOwner[j]!, turret: v.individualTurretFacing(k) };
    });
    return { shown: v.individualsShown, figures: v.individualCount, mine: all.filter((t) => t.id === id).map((t) => t.turret), others: all.filter((t) => t.id !== id).length };
  }, { fired: t2.fired, id: far.id });
  expect(t3.shown).toBe(true);
  expect(t3.mine.length).toBeGreaterThan(3);
  for (const a of t3.mine) expect(a).toBe(far.turret);
  await page.screenshot({ path: path.join(out, 'turrets-4m.png') });
  await lookAt(NEAR_M_PER_PX, shot.x0, shot.y0, 3);
  await page.evaluate((fired) => window.__warsim!.view!.draw(fired), t2.fired);
  await page.screenshot({ path: path.join(out, 'turrets-1.5m.png') });
  console.log(`turrets at ${M_PER_PX} m/px: ${t2.at.length} in view, ${firing.length} of tanks that fired, ${turned} more than 0.02 rad off the hull; back after ${Math.round(t2.wait)} ms. At ${CLOSE_M_PER_PX} m/px: ${t3.mine.length} tanks of element ${far.id} at ${far.turret.toFixed(2)} rad (hull ${far.hull.toFixed(2)}), ${t3.others} other turrets, ${t3.figures} figures`);
});
