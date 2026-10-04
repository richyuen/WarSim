import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { strengthText } from '../../src/render/units/markers';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 2.1 AT: at T1 every formation marker's strength number equals the sim's Σ element
// strength (the e2e reads both: the drawn label and the element sum from the worker). Order
// arrows follow move orders; engaged formations and Major Battles are marked.

const { w: W, h: H } = SIZE_1938;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const full = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect(true));

async function look(page: Page, lon: number, lat: number, mPerPx: number): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    v.draw();
  }, { x, y, m: mPerPx });
  // The camera jump may start the T0 ↔ T1 handover (PLAN 1.45a, 250 ms) and counter splits: let
  // them finish, then draw the state they end in.
  await page.waitForFunction(() => !window.__warsim!.view!.unitsAnimating());
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.waitForTimeout(150);
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
  const byId = new Map(s.formations.map((f) => [f.id, f]));
  for (const r of rects) {
    const f = byId.get(r.id)!;
    expect(f, `formation ${r.id}`).toBeTruthy();
    expect(f.strength).toBe(f.elementMen);
    expect(r.text).toBe(strengthText(f.elementMen));
  }

  // Order arrow: a Polish formation ordered west gets a target in the snapshot and an arrow.
  const pol = s.formations.find((f) => f.nation === POL)!;
  const [tx, ty] = cellOf(18.0, 52.4, W, H);
  await page.evaluate(({ id, tx, ty }) => window.__warsim!.sim.command({ kind: 'moveFormation', id, x: tx, y: ty }), { id: pol.id, tx, ty });
  await page.evaluate(() => window.__warsim!.sim.step(2));
  await expect
    .poll(() => page.evaluate((id) => {
      const v = window.__warsim!.view!;
      v.draw();
      return v.markerRects.some((r) => r.id === id);
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
  const byId2 = new Map(after.formations.map((f) => [f.id, f]));
  const spain = await page.evaluate(() => window.__warsim!.view!.markerRects);
  expect(spain.length).toBeGreaterThan(5);
  for (const r of spain) expect(r.text).toBe(strengthText(byId2.get(r.id)!.elementMen));

  // T2 (close): markers fade out again.
  await look(page, -3.7, 40.4, 120);
  expect(await page.evaluate(() => window.__warsim!.view!.markerRects.length)).toBe(0);
});
