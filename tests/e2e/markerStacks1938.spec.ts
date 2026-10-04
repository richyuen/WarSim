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

/** A marker's box centre, and where its formation is on screen. */
interface Placed extends Marker { fx: number; fy: number }

async function look(page: Page, lon: number, lat: number, mPerPx: number): Promise<Placed[]> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  await settle(page);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    return v.markerRects.map((r) => ({ id: r.id, nation: r.nation, x: r.x, y: r.y, w: r.w, h: r.h, alpha: r.alpha, text: r.text, members: r.members, fx: (r.wx - cam.cx) * cam.scale + window.innerWidth / 2, fy: (r.wy - cam.cy) * cam.scale + window.innerHeight / 2 }));
  });
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

// PLAN 2.7s2: at the far end of T1 a cell is 10 px and a marker 26: the markers of two nations
// that face each other across a front stand on each other. They are never one marker (who faces
// whom is what the tier shows), so their boxes move apart, by a few px.
test('T1 markers of two nations that stand on each other move apart by a few px', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__warsim!.sim.step(24 * 14));

  for (const mPerPx of [1900, 1800, 1200]) {
    const markers = await look(page, -3, 40.5, mPerPx);
    expect(markers.length, `${mPerPx} m/px`).toBeGreaterThan(20);
    expect([...new Set(markers.map((m) => m.alpha))], `${mPerPx} m/px`).toEqual([1]);
    // No marker is more than a quarter under another, of whatever nation.
    const deep: string[] = [];
    for (let i = 0; i < markers.length; i++)
      for (let j = i + 1; j < markers.length; j++) {
        const [a, b] = [markers[i]!, markers[j]!];
        if (under(a, b) > 0.25) deep.push(`${a.id} (nation ${a.nation}) and ${b.id} (nation ${b.nation}): ${(under(a, b) * 100).toFixed(0)}%`);
      }
    // A box stands on its formation, or a few px from it.
    const off = markers.map((m) => Math.hypot(m.x + m.w / 2 - m.fx, m.y + 17 / 2 - m.fy));
    console.log(`${mPerPx} m/px: ${markers.length} markers; more than a quarter under another: ${deep.length} pairs; ${off.filter((d) => d > 0.75).length} boxes off their formations, the furthest ${Math.max(...off).toFixed(1)} px`);
    expect(deep, `${mPerPx} m/px`).toEqual([]);
    // (A box is drawn on whole px: up to 0.71 px from its formation with no move at all.)
    expect(Math.max(...off), `${mPerPx} m/px: the furthest box from its formation`).toBeLessThanOrEqual(6.75);
    if (mPerPx !== 1200) await page.screenshot({ path: path.join(out, `markers-apart-spain-${mPerPx}m.png`) });
  }
});

// PLAN 2.7v (ADR-74, third read, finding 1): the markers come to rest in a game that has run.
// The two tests above look at day 14, where they did. At day 90 of this game three formations of
// two nations stand within a few cells of (1080, 306), in China: their boxes cannot be parted
// within the 6 px a box may move, and the moves, which started from those of the frame before,
// went round a cycle. The view drew every frame for ever.
test('the T1 markers come to rest in a game that has run: 1938, seed 99, day 90', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=99');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async () => {
    const tick = (await window.__warsim!.sim.step(24 * 90)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 20));
      wait();
    });
  });
  // Frames 16 ms apart, at times the test gives, until two in a row leave nothing animating.
  const rests = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    let now = performance.now() + 60_000;
    return [1950, 1700, 1400, 1100, 800, 500].map((m) => {
      v.controller.set({ cx: 1080, cy: 306, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      let frames = 0;
      for (let quiet = 0; quiet < 2 && frames < 400; now += 16, frames++) {
        v.draw(now);
        quiet = v.unitsAnimating(now) ? 0 : quiet + 1;
      }
      return { m, frames, markers: v.markerRects.length };
    });
  });
  console.log(`day 90, frames until the view rests: ${rests.map((r) => `${r.m} m/px: ${r.frames} (${r.markers} markers)`).join('; ')}`);
  for (const r of rests) {
    expect(r.markers, `${r.m} m/px`).toBeGreaterThan(5);
    // A handover and its fades are 250 ms and a tail: 20 frames. 400 is the test's limit.
    expect(r.frames, `${r.m} m/px: frames until rest`).toBeLessThan(60);
  }
});

// PLAN 2.7z (ADR-74, fourth read, finding 1): on the way back from T2 the markers stand where
// they will rest. At T2 no markers are drawn, and the layer forgets how it had parted them. On
// the way back the boxes do not move while they grow, and they grew on their formations, markers
// of two nations on each other, for the 470 ms of the morph; then they eased apart. The city
// names (PLAN 2.7u), placed against the boxes not yet parted, changed places a second time.
test('back from T2 the T1 markers stand where they will rest: none on another, none moves when the morph ends', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.sim.step(24 * 14));
  // Spain's front, where boxes of two nations are parted at 1800 m/px (the test above): from T2.
  const atRest = await look(page, -3, 40.5, 1800);
  const parted = atRest.filter((m) => Math.hypot(m.x + m.w / 2 - m.fx, m.y + 17 / 2 - m.fy) > 1).length;
  expect((await look(page, -3, 40.5, 250)).length, 'markers at T2').toBe(0);

  // The step back out, and the view's frames 16 ms apart at times the test gives.
  const [cx, cy] = cellOf(-3, 40.5, W, H);
  const got = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 1800 });
    const cam = v.controller.cam;
    const first = new Map<number, [number, number]>();
    const deep: string[] = [];
    const moved: string[] = [];
    let frames = 0;
    let full = 0;
    let growing = 0;
    let worstMove = 0;
    let now = performance.now() + 60_000;
    for (let quiet = 0; quiet < 3 && frames < 200; now += 16, frames++) {
      v.draw(now);
      quiet = v.unitsAnimating(now) ? 0 : quiet + 1;
      const shown = v.markerRects.filter((r) => r.own === 1);
      if (shown.length === 0) continue;
      const scale = shown[0]!.scale;
      if (scale < 1) growing++;
      // Where each box stands from its formation, in every frame it is drawn in.
      for (const r of shown) {
        const off: [number, number] = [r.x + r.w / 2 - ((r.wx - cam.cx) * cam.scale + window.innerWidth / 2), r.y + 17 / 2 - ((r.wy - cam.cy) * cam.scale + window.innerHeight / 2)];
        const was = first.get(r.id);
        if (!was) first.set(r.id, off);
        else {
          const d = Math.hypot(off[0] - was[0], off[1] - was[1]);
          worstMove = Math.max(worstMove, d);
          if (d > 0.05 && moved.length < 5) moved.push(`marker ${r.id}: ${d.toFixed(2)} px from where it first stood, in frame ${frames}`);
        }
      }
      // With the boxes in full: no box of one nation more than a quarter on a box of another.
      if (scale === 1 && shown.every((r) => r.alpha === 1)) {
        full++;
        for (let i = 0; i < shown.length; i++)
          for (let j = i + 1; j < shown.length; j++) {
            const [a, b] = [shown[i]!, shown[j]!];
            if (a.nation === b.nation) continue;
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            const under = ox <= 0 || oy <= 0 ? 0 : (ox * oy) / (a.w * a.h);
            if (under > 0.2501 && deep.length < 5) deep.push(`${a.id} and ${b.id}: ${(under * 100).toFixed(0)}% in frame ${frames}`);
          }
      }
    }
    return { frames, growing, full, markers: first.size, worstMove, moved, deep };
  }, { cx, cy });
  console.log(`T2 → 1800 m/px: ${got.frames} frames, ${got.growing} of them with the boxes growing, ${got.full} with them in full; ${got.markers} markers, ${parted} of them parted at rest; a box moved from where it first stood by ${got.worstMove.toFixed(2)} px at most; pairs of two nations more than a quarter on each other: ${got.deep.length}`);
  // The case: the morph was seen, boxes in full after it, and boxes that rest off their formations.
  expect(parted, 'boxes parted at rest at 1800 m/px').toBeGreaterThan(5);
  expect(got.growing, 'frames of the morph').toBeGreaterThan(15);
  expect(got.full, 'frames with the boxes in full').toBeGreaterThan(2);
  expect(got.frames, 'the view comes to rest').toBeLessThan(200);
  expect(got.moved, 'boxes that moved after their first frame').toEqual([]);
  expect(got.deep, 'pairs of two nations more than a quarter on each other, the boxes in full').toEqual([]);
});
