import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { strikeHit } from '../helpers/strikeHit';

// PLAN 5.9 (the critic's R5-B1, first of three): no plane, bomb or flak was drawn at T3 (in 17
// live hours of a war at 20 m/px). A strike's bombs now burst over the men of the formation it
// hit, as drawn at T3, and the sorties, fights and flak are drawn at every tier.
//
// The hour: the first in which a strike hits a land formation, from day 3 of seed 1938, found in
// Node (`strikeHit`); the camera at T3 over that formation.

const M_PER_PX = 20;

test('T3: a strike\'s bombs burst over the men it hit, and the planes are drawn', async ({ page }, info) => {
  test.setTimeout(300_000);
  const node = strikeHit(1938, 3, 60);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.9') : info.outputPath();
  mkdirSync(out, { recursive: true });
  expect(await page.evaluate((n) => window.__warsim!.sim.step(n).then(() => window.__warsim!.sim.hash()), node.start)).toEqual({ tick: node.start, hash: node.before });

  // At T3 over the formation the strike will hit, its men drawn.
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: node.x, y: node.y, m: M_PER_PX });
  await page.waitForFunction((f) => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.elementPlaces(f).length > 0;
  }, node.formation, { timeout: 30_000 });
  // On the middle of its men as drawn (its block stands off its place in contact).
  await page.evaluate(({ f, m }) => {
    const v = window.__warsim!.view!;
    const p = v.elementPlaces(f);
    const x = p.reduce((s, q) => s + q[0], 0) / p.length;
    const y = p.reduce((s, q) => s + q[1], 0) / p.length;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { f: node.formation, m: M_PER_PX });
  await page.waitForTimeout(500);

  // The hour of the strike.
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, node.start + 1);
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: node.start + 1, hash: node.after });
  // A little into the bombs' life, the frame held for its picture.
  const got = await page.evaluate((f) => {
    const v = window.__warsim!.view!;
    const hit = v.airFx.marks.find((m) => m.kind === 3 && m.formation === f);
    if (!hit) return null;
    (v as unknown as { frameAt: (t: number) => boolean }).frameAt = () => false;
    v.draw(hit.born + 500);
    return { shown: v.airFx.shown.slice(), planes: v.sortieMarks.length, men: v.elementPlaces(f).length, figures: v.shares.individuals, born: hit.born };
  }, node.formation);
  expect(got, 'a mark of the strike on the formation').not.toBeNull();
  await page.screenshot({ path: path.join(out, 'strike-t3-20m.png') });
  process.stderr.write(`strike on formation ${node.formation} by wing ${node.wing}, hour ${node.start}: at T3 (${M_PER_PX} m/px, figures ${got!.figures.toFixed(2)}) bombs on its ${got!.men} elements ${got!.shown[3]}, other marks ${got!.shown.slice(0, 3).join('/')}, planes ${got!.planes}\n`);
  expect(got!.figures, 'T3: the figures drawn').toBeGreaterThan(0.99);
  expect(got!.shown[3], 'bombs over the men hit').toBeGreaterThan(0);
  // About its target, of T0 to T2: none at T3.
  expect(got!.shown[1], 'no bombs about the target cell at T3').toBe(0);
  // And none after their time.
  expect(await page.evaluate((born) => {
    const v = window.__warsim!.view!;
    v.draw(born + 2300);
    return v.airFx.shown[3];
  }, got!.born)).toBe(0);

  // The planes at T3: a sortie seen further out (400 m/px and up) is drawn still with the camera at T3 on
  // where it is, at the same time of the frame (a sortie's place is not of the subscribed box).
  const planes = await page.evaluate(({ x, y, born }) => {
    const v = window.__warsim!.view!;
    const t = born + 500;
    const at = (m: number, cx: number, cy: number): void => v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    let far: (typeof v.sortieMarks)[number] | undefined;
    for (const m of [400, 1500, 6000]) {
      at(m, x, y);
      v.draw(t);
      far = v.sortieMarks.find((p) => p.x > 100 && p.x < window.innerWidth - 100 && p.y > 100 && p.y < window.innerHeight - 100);
      if (far) break;
    }
    if (!far) return null;
    const cam = v.controller.cam;
    const wx = cam.cx + (far.x - window.innerWidth / 2) / cam.scale;
    const wy = cam.cy + (far.y - window.innerHeight / 2) / cam.scale;
    at(20, wx, wy);
    v.draw(t);
    return { far: v.sortieMarks.length, close: v.sortieMarks.length, nation: far.nation };
  }, { x: node.x, y: node.y, born: got!.born });
  await page.evaluate(() => delete (window.__warsim!.view! as unknown as { frameAt?: unknown }).frameAt);
  expect(planes, 'a sortie in the air about the strike').not.toBeNull();
  expect(planes!.close, 'drawn at T3 where it is').toBeGreaterThan(0);
});
