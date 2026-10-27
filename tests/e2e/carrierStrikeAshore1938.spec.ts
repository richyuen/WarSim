import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.145 (ADR-738): a carrier's wings, their fleet at war and in no sea battle, strike ashore from the deck.
// Seed 99: Japan, at war with China from the start, sends its carriers' naval bombers at the Chinese divisions in
// range from hour 1 (`.cache/probe7145.ts`). The page draws the flight from the fleet at sea to the land and the
// planes over the target, as a land-based wing's.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

test("a carrier's naval bombers strike a Chinese division from the deck, drawn from the fleet to the land (seed 99)", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=99');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.145') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const jap = id('JAP');
  // Hour by hour to a Japanese naval bomber sortie launched at sea (from a Japanese fleet's place) at a land
  // formation of an enemy, over its target: the sorties of the snapshot (SORTIE_STRIDE 11: bx, by, tx, ty,
  // launch, kmh, km, over, nation, aircraft, role) against the formations' places.
  const find = (jap: number): Promise<{ tick: number; bx: number; by: number; tx: number; ty: number; over: boolean } | null> =>
    (async () => {
      const { sim, view } = window.__warsim!;
      const t = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick >= t ? done() : void setTimeout(wait, 5));
        wait();
      });
      const rows = (view as unknown as { sorties: Float32Array }).sorties;
      const all = (await sim.inspect(true)).formations as { id: number; x: number; y: number; nation: number }[];
      const fleets = all.filter((f) => f.nation === jap && view!.formationAfloat(f.id));
      const land = all.filter((f) => f.nation !== jap && !view!.formationAfloat(f.id));
      for (let i = 0; i + 11 <= rows.length; i += 11) {
        const [bx, by, tx, ty, launch, kmh, km] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!, rows[i + 4]!, rows[i + 5]!, rows[i + 6]!];
        if (rows[i + 8] !== jap || rows[i + 10] !== 4) continue;
        if (!fleets.some((f) => Math.hypot(f.x - bx, f.y - by) < 1.5)) continue;
        if (!land.some((f) => Math.hypot(f.x - tx, f.y - ty) < 0.05)) continue;
        // Over its target in the hour the snapshot ends (launch is hours from the snapshot's tick).
        const arrive = launch + km / kmh;
        return { tick: t, bx, by, tx, ty, over: arrive <= 0 };
      }
      return null;
    })();
  let hit = null;
  for (let h = 0; h < 72 && !(hit?.over ?? false); h++) hit = await page.evaluate(find, jap);
  expect(hit, 'a Japanese carrier sortie at a land formation over its target within 72 hours').not.toBeNull();
  expect(hit!.over).toBe(true);
  // The view on the target, at the operational tier: the planes over it.
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 24 }), { x: hit!.tx, y: hit!.ty });
  await page.waitForTimeout(800);
  const planes = await page.evaluate((jap) => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    return v.sortieMarks.filter((s) => s.nation === jap && s.x >= 0 && s.x <= window.innerWidth && s.y >= 0 && s.y <= window.innerHeight).length;
  }, jap);
  await page.screenshot({ path: path.join(out, 'a-carrier-strike-ashore-99.png') });
  // And framed from the fleet to the target: the flight across the sea.
  await page.evaluate(({ bx, by, tx, ty }) => window.__warsim!.view!.controller.set({ cx: (bx + tx) / 2, cy: (by + ty) / 2, scale: 7 }), hit!);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'b-carrier-to-shore-99.png') });
  console.log(`seed 99, hour ${hit!.tick}: a Japanese carrier sortie from (${hit!.bx.toFixed(1)}, ${hit!.by.toFixed(1)}) over (${hit!.tx.toFixed(1)}, ${hit!.ty.toFixed(1)}), ${planes} Japanese sorties on the screen`);
  expect(planes, "the carrier's planes over the target on the screen").toBeGreaterThan(0);
});
