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

/**
 * The pips agree with the sim (PLAN 7.21c2): every marker on screen whose formation has elements
 * shows pips, a living one for each of its elements; the rest of its sockets are empty. Returns
 * the empty sockets counted, and the pips fainter for the men their elements lost.
 */
async function pipTruth(page: Page, rects: readonly { id: number }[], world: Inspection): Promise<{ sockets: number; faint: number }> {
  const pips = await page.evaluate((ids) => {
    const v = window.__warsim!.view!;
    return ids.map((id) => {
      const p = v.pipsOf.get(id);
      const share = p ? Array.from(p.share) : [];
      return { id, count: p ? p.count : -1, living: p ? share.filter((x) => x > 0).length : -1, faint: share.filter((x) => x > 0 && x < 1).length };
    });
  }, rects.map((r) => r.id));
  const byId = new Map(world.formations.map((f) => [f.id, f]));
  let sockets = 0;
  let faint = 0;
  for (const p of pips) {
    const f = byId.get(p.id)!;
    if (f.wing || f.elements === 0) continue;
    expect(p.count, `formation ${p.id}: pips`).toBeGreaterThan(0);
    expect(p.living, `formation ${p.id}: living pips`).toBe(f.elements);
    sockets += p.count - p.living;
    faint += p.faint;
  }
  return { sockets, faint };
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
  await pipTruth(page, rects, s);

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
  const lost = await pipTruth(page, spain, after);
  console.log(`Spain, day 14, 1200 m/px: ${spain.length} markers, ${lost.sockets} empty sockets (elements lost), ${lost.faint} pips fainter (men lost)`);
  // Two weeks of war show on the pips.
  expect(lost.sockets + lost.faint).toBeGreaterThan(0);

  // T2 (close): markers fade out again.
  await look(page, -3.7, 40.4, 120);
  expect(await page.evaluate(() => window.__warsim!.view!.markerRects.length)).toBe(0);
});

// PLAN 7.34b AT (critic run 9, ADR-535): at 900 m/px on the critic's case (seed 4483, Germany at
// war with Poland, the first German armoured formation in contact, day 3) the elements in hand are
// drawn, counted. At T1 an element is a pip under its formation's marker: they stand about 0.65 px
// apart there, a division's block under 5 px, under a marker 41 px high, so none is drawn where
// it stands. Of the elements the snapshot brought, each is a pip drawn, or of a formation a stack
// stands for ("×n"), or of a formation off the screen (the subscription's padded box).
test('T1 at 900 m/px: the elements in hand drawn as pips, counted (critic 4483)', async ({ page }, info) => {
  test.setTimeout(240_000);
  const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=4483');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: GER, d: POL });
  let armour: number | undefined;
  for (let day = 0; day < 12 && armour === undefined; day++) {
    await page.evaluate(async () => {
      const w = window.__warsim!;
      const target = w.view!.lastTick + 24;
      await w.sim.step(24);
      await new Promise<void>((done) => {
        const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 10));
        wait();
      });
    });
    armour = await page.evaluate((n) => {
      const v = window.__warsim!.view!;
      return v.formationsOf(n).find((f) => v.formationEngaged(f) && /Armoured/i.test(JSON.stringify(v.formationTitle(f))));
    }, GER);
  }
  expect(armour, 'a German armoured formation in contact').toBeDefined();
  const pos = await page.evaluate((f) => window.__warsim!.view!.formationPos(f)!, armour!);
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 900 });
  }, { x: pos[0], y: pos[1] });
  // The elements come a snapshot after the subscription; their pips fade in (250 ms).
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.elementCount), { timeout: 10_000 }).toBeGreaterThan(0);
  await settle(page);
  const r = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const leads = new Set<number>();
    const members = new Set<number>();
    for (const m of v.markerRects) {
      leads.add(m.members[0]!);
      for (const id of m.members) members.add(id);
    }
    let ofLeads = 0;
    let offScreen = 0;
    for (let i = 0; i < v.elementCount; i++) {
      const f = v.elementFormation[i]!;
      if (leads.has(f)) ofLeads++;
      else if (!members.has(f)) offScreen++;
    }
    return { mpp: v.metresPerPx, count: v.elementCount, ...v.elementsAtT1, ofLeads, offScreen, markers: v.markerRects.length, rects: v.markerRects };
  });
  console.log(`seed 4483, ${r.mpp.toFixed(0)} m/px: ${r.count} elements in hand; ${r.pips} drawn as pips of ${r.markers} markers, ${r.stoodFor} of formations in stacks, ${r.offScreen} off the screen`);
  expect(r.mpp).toBeCloseTo(900, 0);
  expect(r.pips).toBeGreaterThan(1000);
  // Every element of a marker's lead is a pip drawn, and every element in hand is accounted for.
  expect(r.pips).toBe(r.ofLeads);
  expect(r.pips + r.stoodFor + r.offScreen).toBe(r.count);
  await pipTruth(page, r.rects, await full(page));
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.34') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'b-4483-arm-900m.png') });
});
