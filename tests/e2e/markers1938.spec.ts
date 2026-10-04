import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { strengthText } from '../../src/render/units/markers';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.1 AT: at T1 every formation marker's strength number equals the sim's Σ element
// strength (the e2e reads both: the drawn label and the element sum from the worker). Order
// arrows follow move orders; engaged formations and Major Battles are marked.
//
// Since PLAN 2.7s1 markers of one nation that stand on each other are one marker, which stands
// for all of them. "Every marker's number is its formation's element sum" is, said for stacks
// too: a marker's number is the element sum of the formations it stands for, and no formation
// is stood for twice (`oneTruth`). For a marker that stands for itself alone that is the
// sentence as it was (ADR-77).

const { w: W, h: H } = SIZE_1938;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const full = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect(true));

/** One truth: each drawn number is the element sum of the formations its marker stands for, and each formation is in one marker. */
function oneTruth(rects: readonly { id: number; text: string; members: number[] }[], world: Inspection): void {
  const byId = new Map(world.formations.map((f) => [f.id, f]));
  const seen = new Set<number>();
  for (const r of rects) {
    expect(r.members[0], `marker ${r.id} stands for itself first`).toBe(r.id);
    let men = 0;
    for (const id of r.members) {
      const f = byId.get(id)!;
      expect(f, `formation ${id}`).toBeTruthy();
      expect(f.strength).toBe(f.elementMen);
      expect(seen.has(id), `formation ${id} in two markers`).toBe(false);
      seen.add(id);
      men += f.elementMen;
    }
    expect(r.text, `marker ${r.id} for ${r.members.join(', ')}`).toBe(strengthText(men));
  }
}

async function look(page: Page, lon: number, lat: number, mPerPx: number): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  // The camera jump may start the T0 ↔ T1 handover (PLAN 1.45a, 250 ms) and counter splits: draw
  // until they have finished, and leave the state they end in on screen.
  await settle(page);
}

test('T1 markers: numbers equal Σ element strength; arrows and battle markers', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });

  // T0 (world): no markers. T1 over Poland: markers.
  await look(page, 20, 52, 6000);
  expect(await page.evaluate(() => window.__warsim!.view!.markerRects.length)).toBe(0);
  await look(page, 20, 52, 1000);
  expect(await page.evaluate(() => window.__warsim!.view!.markerOpacity)).toBe(1);
  const rects = await page.evaluate(() => window.__warsim!.view!.markerRects);
  expect(rects.length).toBeGreaterThan(20);

  // One truth: each drawn number is the element sum (and the formation strength equals it).
  const s = await full(page);
  oneTruth(rects, s);

  // Order arrow: a Polish formation ordered west gets a target in the snapshot and an arrow.
  const pol = s.formations.find((f) => f.nation === POL)!;
  const [tx, ty] = cellOf(18.0, 52.4, W, H);
  await page.evaluate(({ id, tx, ty }) => window.__warsim!.sim.command({ kind: 'moveFormation', id, x: tx, y: ty }), { id: pol.id, tx, ty });
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await expect
    .poll(() => page.evaluate((id) => {
      const v = window.__warsim!.view!;
      v.draw();
      return v.markerRects.some((r) => r.members.includes(id));
    }, pol.id))
    .toBe(true);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.1') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'markers-poland-1000m.png') });

  // A front with fighting: the Spanish Civil War after two weeks (engaged outlines, battles).
  await page.evaluate(() => window.__warsim!.sim.step(24 * 14));
  await look(page, -3.7, 40.4, 1200);
  await page.screenshot({ path: path.join(out, 'markers-spain-1200m.png') });
  const after = await full(page);
  const spain = await page.evaluate(() => window.__warsim!.view!.markerRects);
  expect(spain.length).toBeGreaterThan(5);
  oneTruth(spain, after);

  // T2 (close): markers fade out again.
  await look(page, -3.7, 40.4, 120);
  expect(await page.evaluate(() => window.__warsim!.view!.markerRects.length)).toBe(0);
});
