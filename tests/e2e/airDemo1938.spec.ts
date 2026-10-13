import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 5.7d, the AT of PLAN 5.7: the air battle demo. Germany declares war on Poland (seed 1):
// the air AI tasks both sides' wings over the front (PLAN 5.6), and the first hour of the war with
// an air fight is looked at:
//   T0 (4,000 m/px): the sorties of the war over Europe, small, under the counters;
//   T1 (1,000 m/px): the planes over the front, the fight's tracers and flak, the bombs; and the
//     air-superiority mode;
//   T2 (150 m/px): the fight close, its tracers, flak and smoke.
// The marks of an hour live seconds of the page's clock and the test's steps take seconds: each
// picture is drawn at a set time into the hour's marks, the frame loop held for it.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** Steps an hour and waits for its snapshot. */
async function hour(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + 1;
    await w.sim.step(1);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 4));
      wait();
    });
  });
}

/**
 * Draws the fight's hour's air marks (kept by the test: a camera's move brings a snapshot, which
 * lets marks of seconds ago go) at `ms` into their life, the frame loop held; takes the picture,
 * lets the loop go; what was drawn.
 */
async function picture(page: Page, file: string, ms = 400): Promise<{ sorties: number; shown: number[] }> {
  const drawn = await page.evaluate((ms) => {
    const v = window.__warsim!.view!;
    const now = performance.now();
    const kept = (window as unknown as { airMarks: typeof v.airFx.marks }).airMarks;
    v.airFx.marks = kept.map((m) => ({ ...m, born: now - ms }));
    (v as unknown as { frameAt: (t: number) => boolean }).frameAt = () => false;
    v.draw(now);
    return { sorties: v.sortieMarks.length, shown: v.airFx.shown.slice() };
  }, ms);
  await page.screenshot({ path: file });
  await page.evaluate(() => void delete (window.__warsim!.view! as unknown as { frameAt?: unknown }).frameAt);
  return drawn;
}

test('the air battle demo: the first air fight of a war at T0, T1 and T2, and the air-superiority mode', async ({ page }, info) => {
  test.setTimeout(500_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  // An hour at a time, up to four days, until an air fight's mark comes with sorties of two
  // nations by it at T1: a fight is where its foes met, and by the next hour (the snapshot's) they
  // may have flown on.
  let fight: { x: number; y: number } | null = null;
  let tick = 0;
  let fights = 0;
  for (let h = 0; h < 96 && !fight; h++) {
    await hour(page);
    // The hour's marks (the last snapshot's), kept before the camera moves bring others.
    const marks = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const last = Math.max(...v.airFx.marks.map((k) => k.born), -Infinity);
      const hour = v.airFx.marks.filter((k) => k.born === last).map((k) => ({ ...k }));
      (window as unknown as { hourMarks: unknown }).hourMarks = hour;
      return hour.filter((k) => k.kind === 0).map((k) => ({ x: k.x, y: k.y }));
    });
    fights += marks.length;
    for (const m of marks) {
      await lookAt(page, m.x, m.y, 1000);
      const seen = await page.evaluate(() => {
        const v = window.__warsim!.view!;
        v.draw();
        const [cx, cy] = [700, 400];
        return { near: new Set(v.sortieMarks.filter((s) => Math.hypot(s.x - cx, s.y - cy) < 70).map((s) => s.nation)).size };
      });
      const near = seen.near;
      if (near >= 2) {
        fight = m;
        // The hour's marks, for the pictures.
        await page.evaluate(() => {
          const w = window as unknown as { airMarks: unknown; hourMarks: unknown };
          w.airMarks = w.hourMarks;
        });
        break;
      }
    }
    tick = await page.evaluate(() => window.__warsim!.view!.lastTick);
  }
  expect(fight, 'an air fight with both sides\' planes by it in the first four days').not.toBeNull();
  // Its hour, at each tier: the camera set first, then the hour's marks drawn at 400 ms.
  await lookAt(page, fight!.x, fight!.y, 4000);
  const t0 = await picture(page, path.join(out, 'air-demo-t0.png'));
  await lookAt(page, fight!.x, fight!.y, 1000);
  const t1 = await picture(page, path.join(out, 'air-demo-t1.png'));
  await lookAt(page, fight!.x, fight!.y, 150);
  const t2 = await picture(page, path.join(out, 'air-demo-t2.png'), 900);
  await page.evaluate(() => window.__warsim!.hud.setMapMode('airControl'));
  await lookAt(page, fight!.x, fight!.y, 2500);
  await page.waitForTimeout(250);
  const mode = await picture(page, path.join(out, 'air-demo-superiority.png'));
  await page.evaluate(() => window.__warsim!.hud.setMapMode('political'));
  console.log(`air demo: ${fights} fights told before; the first with both sides by it at tick ${tick}, at ${fight!.x.toFixed(1)}, ${fight!.y.toFixed(1)}; drawn [sorties; fights, bombs, flak]: T0 ${t0.sorties}; ${t0.shown}, T1 ${t1.sorties}; ${t1.shown}, T2 ${t2.sorties}; ${t2.shown}, mode ${mode.sorties}`);
  expect(t0.sorties).toBeGreaterThan(0);
  expect(t1.sorties).toBeGreaterThan(0);
  expect(t1.shown[0], 'the fight at T1').toBeGreaterThan(0);
  expect(t1.sorties).toBeGreaterThan(1);
  expect(t2.shown[0], 'the fight at T2').toBeGreaterThan(0);
});
