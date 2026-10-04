import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { strengthText } from '../../src/render/units/markers';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7s1: T1 markers of one nation that stand on each other are one marker.
//
// A marker stands on its formation's centre, and formations of one nation often stand on one
// spot. On Spain's front after two weeks, at 1200 m/px, 13 pairs of markers of one nation were
// more than a quarter under each other (7 at 600 m/px): the number of the one underneath could
// not be read. The strongest of such markers now stands for all of them, with the men of all as
// its number and "×n" beside it.
//
// (Markers of two nations on each other, across a front at the far end of T1, are PLAN 2.7s2.)

const { w: W, h: H } = SIZE_1938;
interface Marker { id: number; nation: number; x: number; y: number; w: number; h: number; alpha: number; text: string; members: number[] }

async function look(page: Page, lon: number, lat: number, mPerPx: number): Promise<Marker[]> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  await settle(page);
  return page.evaluate(() => window.__warsim!.view!.markerRects.map((r) => ({ id: r.id, nation: r.nation, x: r.x, y: r.y, w: r.w, h: r.h, alpha: r.alpha, text: r.text, members: r.members })));
}
/** The share of the smaller of two boxes that lies under the other. */
const under = (a: Marker, b: Marker): number => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox <= 0 || oy <= 0 ? 0 : (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
};

test('T1 markers of one nation that stand on each other are one marker, with the men of all', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // The Spanish Civil War after two weeks: a front with formations on each other's spots.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 14));
  const world = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  const men = new Map(world.formations.map((f) => [f.id, f.elementMen]));

  for (const mPerPx of [1200, 600]) {
    const markers = await look(page, -3, 40.5, mPerPx);
    expect(markers.length, `${mPerPx} m/px`).toBeGreaterThan(20);
    // At rest a marker is drawn in full or not at all.
    expect([...new Set(markers.map((m) => m.alpha))], `${mPerPx} m/px`).toEqual([1]);

    // No marker of a nation is more than a quarter under another of that nation.
    const deep: string[] = [];
    for (let i = 0; i < markers.length; i++)
      for (let j = i + 1; j < markers.length; j++) {
        const [a, b] = [markers[i]!, markers[j]!];
        if (a.nation === b.nation && under(a, b) > 0.25) deep.push(`${a.id} (${a.text}) and ${b.id} (${b.text}): ${(under(a, b) * 100).toFixed(0)}%`);
      }
    const stacks = markers.filter((m) => m.members.length > 1);
    console.log(`${mPerPx} m/px: ${markers.length} markers for ${markers.reduce((n, m) => n + m.members.length, 0)} formations; stacks of ${stacks.map((m) => m.members.length).sort((a, b) => b - a).join(', ') || 'none'}; pairs of one nation more than a quarter under each other: ${deep.length}`);
    expect(deep, `${mPerPx} m/px`).toEqual([]);

    // One truth: a marker's number is the men of the formations it stands for (each formation's
    // men are the sum over its elements), itself first; and every formation whose marker would
    // be in view is stood for by exactly one marker.
    const stoodFor = markers.flatMap((m) => m.members);
    expect(new Set(stoodFor).size, `${mPerPx} m/px: a formation in two markers`).toBe(stoodFor.length);
    for (const m of markers) {
      expect(m.members[0], `marker ${m.id}`).toBe(m.id);
      expect(m.text, `marker ${m.id} for ${m.members.join(', ')}`).toBe(strengthText(m.members.reduce((a, id) => a + men.get(id)!, 0)));
    }
    // There are stacks here: the picture is not as it was.
    expect(stacks.length, `${mPerPx} m/px: stacks`).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: path.join(out, `marker-stacks-spain-${mPerPx}m.png`) });
  }
});
