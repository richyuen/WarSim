import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { muzzleOf } from '../../src/render/units/atlas';
import { figureCells } from '../../src/render/units/individuals';
import { turretOf, Weapon } from '../../src/shared/unitLooks';
import { armourFires, busiest } from '../helpers/armourFire';

// PLAN 3.6c AT: at T3 every cannon flash is within a figure's reach of a figure of its shooter.
// Two weeks into 1938 the armour that fires nearest the square with the most of it is found in
// Node, the camera is put on it at T3, one hour is stepped, and each shot's flash is read from
// the frame drawn as it starts.

const START = 24 * 14;
const M_PER_PX = 4;
const NEAR_M_PER_PX = 1.5;

test('T3: a shot leaves the muzzle of one of its shooter\'s figures', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = armourFires(START);
  expect(node.fires.length).toBeGreaterThan(30);
  const [bx, by] = busiest(node.fires);
  const at = node.fires.reduce((a, b) => (Math.hypot(a.x0 - bx, a.y0 - by) <= Math.hypot(b.x0 - bx, b.y0 - by) ? a : b));

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, START)).toEqual({ tick: START, hash: node.before });

  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: at.x0, y: at.y0, m: M_PER_PX });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    // The armour comes to this ground in the hour that is stepped: the view holds no element yet.
    return v.subscription?.tier === 3 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.snapshots > 0 && v.elementsZoom < 1.01 * v.metresPerPx && v.individualsShown && v.shares.individuals === 1;
  }, { x: at.x0, y: at.y0 }, { timeout: 15_000 });
  expect(await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.step(1);
    return sim.hash();
  })).toEqual({ tick: START + 1, hash: node.after });
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick === t && window.__warsim!.view!.elementCount > 0, START + 1);

  // The frame loop is stopped: every frame from here on is drawn at a time of the test's choosing.
  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.dispose();
    const flashes = v.fire.shots.map((s) => {
      v.draw(s.start + 1);
      const f = v.fire.flashAt.find((f) => f.shot === s);
      // The turrets of the shooter's tanks in this frame.
      const turrets: number[] = [];
      for (let k = 0; k < v.individualTurrets; k++) if (v.individualOwner[v.individualTurretOwner[k]!] === s.shooter) turrets.push(v.individualTurretFacing(k));
      return { shooter: s.shooter, weapon: s.weapon, start: s.start, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, from: s.from, flash: f ? { x: f.x, y: f.y } : null, turrets };
    });
    return {
      flashes,
      shown: v.individualsShown,
      share: v.shares.individuals,
      scale: v.controller.cam.scale,
      cx: v.controller.cam.cx,
      cy: v.controller.cam.cy,
      unitScale: v.unitScale,
      skipped: v.fire.skipped,
      figures: Array.from({ length: v.individualCount }, (_, j) => ({ id: v.individualOwner[j]!, x: v.individualX[j]!, y: v.individualY[j]! })),
    };
  });
  expect(got.shown).toBe(true);
  expect(got.share).toBe(1);
  expect(got.skipped).toBe(0);
  expect(got.unitScale).toBe(1);

  const figuresOf = new Map<number, { x: number; y: number }[]>();
  for (const f of got.figures) figuresOf.set(f.id, [...(figuresOf.get(f.id) ?? []), f]);
  const tanks = new Set(node.fires.map((f) => f.shooter));
  let cannons = 0;
  let fromTanks = 0;
  let fromOthers = 0;
  let unheld = 0;
  let outside = 0;
  let farthest = 0;
  // Tanks whose turret is on the line to the target as the shot starts, and the furthest off of the others (rad).
  let onTarget = 0;
  let worstOff = 0;
  for (const s of got.flashes) {
    // A shot is drawn when an end of it is in the viewport (1400 x 800): the view holds elements beyond it.
    const inView = Math.abs(s.x0 - got.cx) * got.scale < 700 && Math.abs(s.y0 - got.cy) * got.scale < 400;
    if (!s.flash) {
      expect(inView, `the flash of ${s.shooter}, in the viewport`).toBe(false);
      outside++;
      continue;
    }
    const figures = figuresOf.get(s.shooter);
    if (!figures) {
      // A shooter the view does not hold (its target is in view): the shot starts where the sim has it.
      expect(s.from, `figure of ${s.shooter}, not held`).toBeNull();
      expect(s.flash).toEqual({ x: s.x0, y: s.y0 });
      unheld++;
      continue;
    }
    expect(s.from, `figure of ${s.shooter}`).not.toBeNull();
    const from = s.from!;
    // At this zoom a figure is drawn at its size in cells, not at its least size.
    const side = figureCells(from.side);
    expect(side * got.scale).toBeGreaterThan(2.5);
    const [mx, my] = muzzleOf(from.frame);
    const tank = turretOf(from.frame) >= 0;
    expect(tank, `${s.shooter} is armour`).toBe(tanks.has(s.shooter));
    // The muzzle of each of the shooter's figures, as it is drawn in this frame.
    const angle = tank ? s.turrets[0]! : from.facing;
    if (tank) for (const t of s.turrets) expect(t).toBe(angle);
    const muzzles = figures.map((f) => ({ x: f.x + (Math.cos(angle) * mx - Math.sin(angle) * my) * side, y: f.y + (Math.sin(angle) * mx + Math.cos(angle) * my) * side }));
    const toMuzzle = Math.min(...muzzles.map((m) => Math.hypot(m.x - s.flash!.x, m.y - s.flash!.y)));
    const toFigure = Math.min(...figures.map((f) => Math.hypot(f.x - s.flash!.x, f.y - s.flash!.y)));
    // The AT: within a figure's reach of a figure of its shooter (half a figure: no barrel is longer).
    expect(toFigure, `flash of ${s.shooter} from its nearest figure, figures`).toBeLessThanOrEqual(side / 2);
    // And at that figure's muzzle, to a hundredth of a pixel.
    expect(toMuzzle * got.scale, `flash of ${s.shooter} from the nearest muzzle, px`).toBeLessThan(0.01);
    farthest = Math.max(farthest, toFigure / side);
    if (s.weapon === Weapon.cannon) cannons++;
    if (tank) {
      fromTanks++;
      const line = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
      const offLine = Math.abs(Math.atan2(Math.sin(angle - line), Math.cos(angle - line)));
      // PLAN 3.6e1: the shot has waited for its turret, which is on the line to the target as the flash begins.
      expect(offLine, `turret of ${s.shooter} off the line to its target as its shot starts, rad`).toBeLessThan(1e-6);
      if (offLine < 0.02) onTarget++;
      worstOff = Math.max(worstOff, offLine);
      // Not at the middle of the hull, and not at the middle of the element's footprint.
      expect(toFigure).toBeGreaterThan(0.3 * side);
      expect(Math.hypot(s.flash!.x - s.x0, s.flash!.y - s.y0) * got.scale).toBeGreaterThan(1);
    } else fromOthers++;
  }
  expect(cannons).toBeGreaterThan(3);
  expect(fromTanks).toBeGreaterThan(3);
  expect(onTarget).toBe(fromTanks);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.6') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // The pictures: as a tank's shot is a third on its way, the tank that fires nearest the middle.
  const shown = got.flashes.filter((s) => tanks.has(s.shooter) && s.flash).reduce((a, b) => (Math.hypot(a.x0 - at.x0, a.y0 - at.y0) <= Math.hypot(b.x0 - at.x0, b.y0 - at.y0) ? a : b));
  await page.evaluate((t) => window.__warsim!.view!.draw(t), shown.start + 30);
  await page.screenshot({ path: path.join(out, 'muzzle-4m.png') });
  // Nearer, without a new subscription: the figures drawn are those of the section in hand.
  await page.evaluate(({ x, y, m, t }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    v.draw(t);
  }, { x: shown.flash!.x, y: shown.flash!.y, m: NEAR_M_PER_PX, t: shown.start + 30 });
  await page.screenshot({ path: path.join(out, 'muzzle-1.5m.png') });
  console.log(`muzzles at ${M_PER_PX} m/px: ${got.flashes.length} shots, ${cannons} of cannon; ${fromTanks} at a tank's muzzle (${onTarget} with the turret on the target's line as the shot starts, the furthest ${worstOff.toFixed(2)} rad off it), ${fromOthers} at another figure's, ${unheld} of shooters the view does not hold, ${outside} not drawn (outside the viewport); the farthest ${farthest.toFixed(3)} of a figure from its figure; ${got.figures.length} figures`);
});
