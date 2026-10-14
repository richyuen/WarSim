import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 4.10b (the critic's R4-B4): a sea battle lasts a few hours of the game, seconds at ×1, and
// its shots are small and brief: in the critic's war (seed 6131, Germany on Britain and Japan on
// the United States) no shot was seen. A sea battle is now marked at its place at T0 to T2 for
// as long as it lasts, the ticker lists it, and its row flies to a view of both fleets, where
// their fire is drawn.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

test('the first sea battle of the critic\'s war: marked through its hours, listed, and its row shows both fleets firing', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=6131');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.10') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d, c, e }) => {
    window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d });
    window.__warsim!.sim.command({ kind: 'declareWar', attacker: c, defender: e });
  }, { a: id('GER'), d: id('ENG'), c: id('JAP'), e: id('USA') });
  // To the first battle (hour 41 of this war), at the world view (T0).
  await page.evaluate(() => window.__warsim!.view!.controller.set({ cx: 1024, cy: 400, scale: 0.7 }));
  await page.evaluate(() => window.__warsim!.sim.step(40));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 40);
  let hour = 40;
  while (hour < 60 && (await page.evaluate(() => window.__warsim!.view!.seaBattles().length)) === 0) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((h) => window.__warsim!.view!.lastTick >= h, hour);
  }
  const first = await page.evaluate(() => window.__warsim!.view!.seaBattles()[0]);
  expect(first, 'a sea battle by hour 60').toBeTruthy();
  // Marked at T0, and listed in the ticker.
  await expect.poll(async () => page.evaluate(() => { window.__warsim!.view!.draw(); return window.__warsim!.view!.seaMarks.length; })).toBeGreaterThan(0);
  await expect(page.getByTestId('sea-battle-row').first()).toContainText('Sea battle');
  await page.screenshot({ path: path.join(out, 'sea-battle-mark-t0.png') });
  // Its row flies to a view of both fleets (T2), where the battle is still marked and its fire is drawn.
  await page.getByTestId('sea-battle-row').first().click();
  await page.waitForTimeout(2500);
  const view = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    return { m: v.metresPerPx, cx: v.controller.cam.cx, cy: v.controller.cam.cy };
  });
  // Over the middle of its fleets, and both sides' fleets in it on the screen (PLAN 4.12a: the
  // row flew to the battle's place, by one side, the other's 23.7 cells off in the critic's).
  // (The middle of their box is the middle of the band between the panels at the view's sides.)
  expect(await page.evaluate((b) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const x = (b.cx - cam.cx) * cam.scale + window.innerWidth / 2;
    const y = (b.cy - cam.cy) * cam.scale + window.innerHeight / 2;
    return document.elementFromPoint(x, y)?.tagName;
  }, first!), 'the middle of the battle\'s fleets on the map, under no panel').toBe('CANVAS');
  const sides = await page.evaluate(async (b) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const out: { nation: number; x: number; y: number; on: boolean }[] = [];
    for (const f of (await window.__warsim!.sim.inspect(true)).formations) {
      if ((f.nation !== b.a && f.nation !== b.b) || !v.formationAfloat(f.id) || !v.formationEngaged(f.id)) continue;
      const p = v.formationPos(f.id);
      if (!p || Math.abs(p[0] - b.cx) > b.span[0] / 2 + 1 || Math.abs(p[1] - b.cy) > b.span[1] / 2 + 1) continue;
      const x = (p[0] - cam.cx) * cam.scale + window.innerWidth / 2;
      const y = (p[1] - cam.cy) * cam.scale + window.innerHeight / 2;
      // On the screen and under no panel of the page: the map is what is at its point.
      const on = x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight && document.elementFromPoint(x, y)?.tagName === 'CANVAS';
      out.push({ nation: f.nation, x: Math.round(x), y: Math.round(y), on });
    }
    return out;
  }, first!);
  console.log(`sea battle of ${first!.a} and ${first!.b}: its fleets' box ${first!.span[0].toFixed(1)} × ${first!.span[1].toFixed(1)} cells, viewed at ${view.m.toFixed(0)} m/px; ${sides.length} engaged fleets of the two in it, ${sides.filter((s) => s.on).length} on the screen`);
  expect(sides.some((s) => s.nation === first!.a), 'a fleet of the one side').toBe(true);
  expect(sides.some((s) => s.nation === first!.b), 'a fleet of the other').toBe(true);
  expect(sides.filter((s) => !s.on), 'engaged fleets of the battle off the screen or under a panel').toEqual([]);
  let shots = 0;
  let marked = 0;
  for (let h = 0; h < 6 && (await page.evaluate(() => window.__warsim!.view!.seaBattles().length)) > 0; h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, hour);
    const r = await page.evaluate(() => {
      const v = window.__warsim!.view! as unknown as { fire: { shots: unknown[] }; draw(): void; seaMarks: unknown[]; seaBattles(): unknown[] };
      v.draw();
      return { shots: v.fire.shots.length, marks: v.seaMarks.length, battles: v.seaBattles().length };
    });
    shots = Math.max(shots, r.shots);
    if (r.battles > 0 && r.marks > 0) marked++;
    if (h === 0) await page.screenshot({ path: path.join(out, 'sea-battle-t2.png') });
  }
  expect(marked, 'marked in every hour it went on in the view').toBeGreaterThan(0);
  expect(shots, 'fire drawn in its hours').toBeGreaterThan(0);
});
