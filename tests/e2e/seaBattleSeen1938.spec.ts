import { expect, test, type Page } from '@playwright/test';
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

/** After a flight of the camera: until it is over (a fixed wait was short under load), and a snapshot of the new view. */
async function landed(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 60_000 });
  await page.waitForTimeout(700);
}

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
  // The first battle of Germany and the United Kingdom with a row (PLAN 7.19b: two fleets within
  // reach of a ship's weapon; the one of hour 41 is a carrier's wings alone, 279 km, and has none).
  const ofWar = { g: id('GER'), e: id('ENG') };
  const pick = ({ g, e }: { g: number; e: number }): number => window.__warsim!.view!.seaBattles().filter((b) => b.pair !== null).findIndex((b) => [b.a, b.b].includes(g) && [b.a, b.b].includes(e));
  while (hour < 72 && (await page.evaluate(pick, ofWar)) < 0) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((h) => window.__warsim!.view!.lastTick >= h, hour);
  }
  const k = await page.evaluate(pick, ofWar);
  expect(k, 'a sea battle of the two with a row by hour 72').toBeGreaterThanOrEqual(0);
  const first = await page.evaluate((k) => window.__warsim!.view!.seaBattles().filter((b) => b.pair !== null)[k]!, k);
  const pair = first.pair!;
  // Marked at T0, and listed in the ticker (the rows are the battles with a pair, in the view's order).
  await expect.poll(async () => page.evaluate(() => { window.__warsim!.view!.draw(); return window.__warsim!.view!.seaMarks.length; })).toBeGreaterThan(0);
  const row = page.getByTestId('sea-battle-row').nth(k);
  await expect(row).toContainText('Sea battle');
  await page.screenshot({ path: path.join(out, 'sea-battle-mark-t0.png') });
  // Its row flies to a view of both fleets (T2), where the battle is still marked and its fire is drawn.
  await row.click();
  await landed(page);
  const view = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    return { m: v.metresPerPx, cx: v.controller.cam.cx, cy: v.controller.cam.cy };
  });
  // Over the middle of the pair that fights, and both sides' fleets about it on the screen (PLAN
  // 4.12a: the row flew to the battle's place, by one side, the other's 23.7 cells off in the
  // critic's; since 7.10b it frames the pair, the box of all its fleets was 24 cells across).
  // (The pair's middle is the middle of the band between the panels at the view's sides.)
  expect(await page.evaluate((b) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const x = (b.x - cam.cx) * cam.scale + window.innerWidth / 2;
    const y = (b.y - cam.cy) * cam.scale + window.innerHeight / 2;
    return document.elementFromPoint(x, y)?.tagName;
  }, pair), 'the middle of the battle\'s pair on the map, under no panel').toBe('CANVAS');
  const sides = await page.evaluate(async ([b, pair]) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const out: { nation: number; x: number; y: number; on: boolean }[] = [];
    for (const f of (await window.__warsim!.sim.inspect(true)).formations) {
      if ((f.nation !== b.a && f.nation !== b.b) || !v.formationAfloat(f.id) || !v.formationEngaged(f.id)) continue;
      const p = v.formationPos(f.id);
      if (!p || Math.abs(p[0] - pair.x) > pair.w / 2 + 0.5 || Math.abs(p[1] - pair.y) > pair.h / 2 + 0.5) continue;
      const x = (p[0] - cam.cx) * cam.scale + window.innerWidth / 2;
      const y = (p[1] - cam.cy) * cam.scale + window.innerHeight / 2;
      // On the screen and under no panel of the page: the map is what is at its point.
      const on = x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight && document.elementFromPoint(x, y)?.tagName === 'CANVAS';
      // Its ships drawn: elements of it in the view's snapshot (PLAN 4.12 AT).
      let ships = 0;
      for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === f.id) ships++;
      out.push({ nation: f.nation, x: Math.round(x), y: Math.round(y), on: on && ships > 0 });
    }
    return out;
  }, [first!, pair] as const);
  console.log(`sea battle of ${first!.a} and ${first!.b} at hour ${hour}: its fleets' box ${first!.span[0].toFixed(1)} × ${first!.span[1].toFixed(1)} cells, its pair ${pair.w.toFixed(1)} × ${pair.h.toFixed(1)}, viewed at ${view.m.toFixed(0)} m/px; ${sides.length} engaged fleets of the two in it, ${sides.filter((s) => s.on).length} on the screen`);
  expect(sides.some((s) => s.nation === first!.a), 'a fleet of the one side').toBe(true);
  expect(sides.some((s) => s.nation === first!.b), 'a fleet of the other').toBe(true);
  expect(sides.filter((s) => !s.on), 'engaged fleets of the battle off the screen, under a panel or with no ship drawn').toEqual([]);
  let shots = 0;
  let marked = 0;
  // A carrier's strikes drawn (PLAN 4.12b): sorties from a fleet of the battle, in its hours. The
  // carrier stands a wing's reach off the fight the row frames (PLAN 7.19b), so its strikes are
  // looked for with the camera on the box of all the battle's fleets, as 4.12a's row had it.
  let planes = 0;
  const look = async (b: { a: number; b: number }): Promise<{ shots: number; marks: number; battles: number; planes: number }> => {
    const w = window.__warsim!.view!;
    const v = w as unknown as { fire: { shots: unknown[] }; draw(): void; seaMarks: unknown[]; seaBattles(): unknown[]; sortieMarks: unknown[]; sorties: Float32Array };
    v.draw();
    // The engaged fleets of the two, and the sorties of the snapshot that took off from one.
    const fleets: [number, number][] = [];
    for (const f of (await window.__warsim!.sim.inspect(true)).formations) {
      const p = w.formationPos(f.id);
      if ((f.nation === b.a || f.nation === b.b) && p && w.formationAfloat(f.id) && w.formationEngaged(f.id)) fleets.push(p);
    }
    let fromFleets = 0;
    for (let i = 0; i + 11 <= v.sorties.length; i += 11) if (fleets.some(([x, y]) => Math.hypot(v.sorties[i]! - x, v.sorties[i + 1]! - y) < 0.5)) fromFleets++;
    return { shots: v.fire.shots.length, marks: v.seaMarks.length, battles: v.seaBattles().length, planes: v.sortieMarks.length > 0 ? fromFleets : 0 };
  };
  for (let h = 0; h < 8 && (await page.evaluate(() => window.__warsim!.view!.seaBattles().length)) > 0; h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, hour);
    const r = await page.evaluate(look, first);
    shots = Math.max(shots, r.shots);
    if (r.battles > 0 && r.marks > 0) marked++;
    if (h === 0) await page.screenshot({ path: path.join(out, 'sea-battle-t2.png') });
    if (planes > 0) continue;
    await page.evaluate((b) => window.__warsim!.view!.showSeaBattle(b.cx, b.cy, b.span), first);
    await landed(page);
    const box = await page.evaluate(look, first);
    if (box.planes > 0) await page.screenshot({ path: path.join(out, 'sea-battle-strike.png') });
    planes = box.planes;
    await page.evaluate((p) => window.__warsim!.view!.showSeaBattle(p.x, p.y, [p.w + 1.2, p.h + 1.2]), pair);
    await landed(page);
  }
  expect(marked, 'marked in every hour it went on in the view').toBeGreaterThan(0);
  expect(shots, 'fire drawn in its hours').toBeGreaterThan(0);
  console.log(`in its hours: at most ${shots} shots and ${planes} sorties from the battle's fleets`);
  expect(planes, 'a carrier\'s strike drawn in its hours').toBeGreaterThan(0);
});
