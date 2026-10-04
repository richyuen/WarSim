import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { nameTextBox } from '../../src/render/labels/cityLabels';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7r: city names stay readable among the T0 counters and the capital flags.
//
// The counters are drawn over the city names, and a capital's name stood to the right of the dot
// that its nation's army often stands on. Over Europe at the 1938 start Paris, Berlin, Prague
// and Budapest read as fragments: of the 31 names shown at 4000 m/px, a counter's box touched
// the box of 18.
//
// "On a name" is judged by the name's letters (`nameTextBox`), not by its box with the padding
// and the line spacing: a capital's own flag, 8 px above its dot, touches that box by a pixel
// and covers nothing.

const { w: W, h: H } = SIZE_1938;
const [EX, EY] = cellOf(15, 50, W, H); // Europe
interface Rect { x: number; y: number; w: number; h: number }
const touches = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('city names are not under the T0 counters or the capital flags, and are not simply left out', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // Four in five of the names that were shown before, covered or not: 31, 27 and 18.
  for (const [mPerPx, atLeast] of [[4000, 25], [3000, 22], [2300, 14]] as const) {
    await page.evaluate(({ cx, cy, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { cx: EX, cy: EY, m: mPerPx });
    await settle(page);
    const got = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      return {
        names: v.cityLabels.lastPlaced.filter((l) => l.nameAlpha > 0 && l.box && !l.ghost).map((l) => ({ name: v.cityLabels.city(l.index).name, alpha: l.nameAlpha, box: l.box! })),
        counters: v.counters.boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, alpha: b.alpha })),
        // A flag with its frame of 1 px.
        flags: v.flagRects.map((f) => ({ x: f.x - 1, y: f.y - 1, w: f.w + 2, h: f.h + 2 })),
      };
    });
    // At rest a name is in full or absent, and so is a counter.
    expect([...new Set(got.names.map((n) => n.alpha))], `${mPerPx} m/px`).toEqual([1]);
    expect([...new Set(got.counters.map((c) => c.alpha))], `${mPerPx} m/px`).toEqual([1]);
    const underCounter = got.names.filter((n) => got.counters.some((c) => touches(nameTextBox(n.box), c))).map((n) => n.name);
    const underFlag = got.names.filter((n) => got.flags.some((f) => touches(nameTextBox(n.box), f))).map((n) => n.name);
    const byBox = got.names.filter((n) => got.flags.some((f) => touches(n.box, f))).length;
    console.log(`${mPerPx} m/px: ${got.names.length} city names, ${got.counters.length} counters, ${got.flags.length} flags; a counter on ${underCounter.length} (${underCounter.join(', ')}); a flag on ${underFlag.length} (${underFlag.join(', ')}); a flag touches the box of ${byBox}`);
    await page.screenshot({ path: path.join(out, `city-names-${mPerPx}m.png`) });
    expect(underCounter, `${mPerPx} m/px: names with a counter on them`).toEqual([]);
    expect(underFlag, `${mPerPx} m/px: names with a flag on them`).toEqual([]);
    expect(got.names.length, `${mPerPx} m/px: names shown`).toBeGreaterThanOrEqual(atLeast);
  }

  // While the game runs the counters move, fold and come out, at top speed in every frame. A name
  // they come to stand on goes out by its fade and comes in at another place by its fade: it
  // never jumps, and it does not follow a counter. The view's own frames, read as they are
  // drawn, for four seconds: the camera rests, so a name's box may not move at all.
  await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 4000 });
  }, { cx: EX, cy: EY });
  await settle(page);
  const running = await page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const hud = window.__warsim!.hud;
    hud.setSpeedLevel(99);
    if (hud.paused.value) hud.togglePause();
    const last = new Map<number, { x: number; y: number; alpha: number }>();
    const jumps: string[] = [];
    let frames = 0;
    let fades = 0;
    const tick = v.lastTick;
    for (const t0 = performance.now(); performance.now() - t0 < 4000; ) {
      await new Promise((done) => requestAnimationFrame(done));
      frames++;
      for (const l of v.cityLabels.lastPlaced) {
        // (Not what still shows at a place a name has left: that is a label of its own, going out.)
        if (!l.box || l.ghost) continue;
        const was = last.get(l.index);
        if (was) {
          const moved = Math.hypot(l.box.x - was.x, l.box.y - was.y);
          // A name that is gone may be anywhere next; one that shows may not move.
          if (moved > 0.5 && Math.min(l.nameAlpha, was.alpha) > 0.02) jumps.push(`${v.cityLabels.city(l.index).name}: ${moved.toFixed(0)} px at opacity ${l.nameAlpha.toFixed(2)}`);
          if ((was.alpha === 1 && l.nameAlpha < 1) || (was.alpha === 0 && l.nameAlpha > 0)) fades++;
        }
        last.set(l.index, { x: l.box.x, y: l.box.y, alpha: l.nameAlpha });
      }
    }
    if (!hud.paused.value) hud.togglePause();
    hud.setSpeedLevel(4);
    return { frames, ticks: v.lastTick - tick, fades, jumps, names: v.cityLabels.lastPlaced.filter((l) => l.nameAlpha > 0 && !l.ghost).length };
  });
  console.log(`running at top speed, 4000 m/px: ${running.frames} frames, ${running.ticks} ticks; ${running.names} names, ${running.fades} fades begun, ${running.jumps.length} jumps`);
  // (How many frames and ticks four seconds hold depends on the machine: enough of both to have seen names go and come.)
  expect(running.ticks).toBeGreaterThan(50);
  expect(running.frames).toBeGreaterThan(8);
  expect(running.fades).toBeGreaterThan(0);
  expect(running.jumps).toEqual([]);
});

// PLAN 2.7t: nothing is drawn over the letters of a city name. The curved nation names were
// drawn on the canvas above the city names: Berlin stood under the "y" of Germany, Warsaw under
// Poland, Budapest under Hungary. With the counters and the flags out of the way (PLAN 2.7r)
// that was what was left.
//
// Read from the canvases: the layer above the city names (the overlay: counters, markers, flags,
// and until now the nation names) has no pixel drawn inside the letters of a name that is shown.
test('nothing is drawn over the letters of a city name: not a nation name, a counter or a flag', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  for (const mPerPx of [4000, 3000, 2300]) {
    await page.evaluate(({ cx, cy, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { cx: EX, cy: EY, m: mPerPx });
    await settle(page);
    const got = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
      const px = overlay.getContext('2d')!.getImageData(0, 0, overlay.width, overlay.height).data;
      const dpr = overlay.width / overlay.clientWidth;
      const names = v.cityLabels.lastPlaced.filter((l) => l.nameAlpha === 1 && l.box && !l.ghost);
      const covered: string[] = [];
      for (const l of names) {
        // The letters: the box without its padding and its line spacing (`nameTextBox`), whole px inside it.
        const b = { x: l.box!.x + 2, y: l.box!.y + l.box!.h / 6, w: l.box!.w - 4, h: (l.box!.h * 2) / 3 };
        let over = 0;
        for (let y = Math.ceil(b.y * dpr); y < Math.floor((b.y + b.h) * dpr); y++)
          for (let x = Math.ceil(b.x * dpr); x < Math.floor((b.x + b.w) * dpr); x++) {
            if (x < 0 || y < 0 || x >= overlay.width || y >= overlay.height) continue;
            if (px[(y * overlay.width + x) * 4 + 3]! > 16) over++;
          }
        if (over > 0) covered.push(`${v.cityLabels.city(l.index).name} (${over} px)`);
      }
      return { names: names.length, covered, nations: v.nationLabels.filter((n) => n.alpha === 1).length };
    });
    console.log(`${mPerPx} m/px: ${got.names} city names, ${got.nations} nation names; something drawn over the letters of ${got.covered.length}: ${got.covered.join(', ')}`);
    expect(got.names, `${mPerPx} m/px`).toBeGreaterThanOrEqual(14);
    // The nation names are there as they were (their layout has a spec of its own: labels1938).
    expect(got.nations, `${mPerPx} m/px: nation names`).toBeGreaterThan(8);
    expect(got.covered, `${mPerPx} m/px`).toEqual([]);
  }
});

// PLAN 2.7u: city names keep clear of the T1 markers, as they do of the T0 counters. The markers
// are drawn over the city names, and a nation's armies stand where its cities are: over central
// Europe at the 1938 start something was drawn over the letters of 12 of the 30 names shown at
// 1800 m/px (Bern and Turin wholly, Berlin by 70%), of 8 of 25 at 1000 m/px and of 1 of 13 at 500.
//
// Read from the canvases as in the test above: the overlay has no pixel drawn inside the letters
// of a name that is shown. And the names are not simply left out: four in five of those that
// were shown before, covered or not.
test('city names keep clear of the T1 markers, and are not simply left out', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [PX, PY] = cellOf(20, 52, W, H); // Poland

  // Names shown before, covered or not: central Europe 30, 25 and 13; Poland 23, 16 and 9.
  const views = [
    ['central-europe', EX, EY, 1800, 24],
    ['central-europe', EX, EY, 1000, 20],
    ['central-europe', EX, EY, 500, 10],
    ['poland', PX, PY, 1800, 18],
    ['poland', PX, PY, 1000, 12],
    ['poland', PX, PY, 500, 7],
  ] as const;
  for (const [where, cx, cy, mPerPx, atLeast] of views) {
    await page.evaluate(({ cx, cy, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { cx, cy, m: mPerPx });
    await settle(page);
    const got = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
      const px = overlay.getContext('2d')!.getImageData(0, 0, overlay.width, overlay.height).data;
      const dpr = overlay.width / overlay.clientWidth;
      const names = v.cityLabels.lastPlaced.filter((l) => l.nameAlpha > 0 && l.box && !l.ghost);
      const covered: string[] = [];
      for (const l of names) {
        // The letters: the box without its padding and its line spacing (`nameTextBox`), whole px inside it.
        const b = { x: l.box!.x + 2, y: l.box!.y + l.box!.h / 6, w: l.box!.w - 4, h: (l.box!.h * 2) / 3 };
        let over = 0;
        let all = 0;
        for (let y = Math.ceil(b.y * dpr); y < Math.floor((b.y + b.h) * dpr); y++)
          for (let x = Math.ceil(b.x * dpr); x < Math.floor((b.x + b.w) * dpr); x++) {
            if (x < 0 || y < 0 || x >= overlay.width || y >= overlay.height) continue;
            all++;
            if (px[(y * overlay.width + x) * 4 + 3]! > 16) over++;
          }
        if (over > 0) covered.push(`${v.cityLabels.city(l.index).name} ${Math.round((100 * over) / Math.max(1, all))}%`);
      }
      return { names: names.length, alphas: [...new Set(names.map((l) => l.nameAlpha))], covered, markers: v.markerRects.length, markerAlphas: [...new Set(v.markerRects.map((r) => r.alpha))] };
    });
    console.log(`${where}, ${mPerPx} m/px: ${got.markers} markers, ${got.names} city names; something drawn over the letters of ${got.covered.length}: ${got.covered.join(', ')}`);
    await page.screenshot({ path: path.join(out, `city-names-t1-${where}-${mPerPx}m.png`) });
    // At rest a name is in full or absent, and so is a marker.
    expect(got.alphas, `${where}, ${mPerPx} m/px`).toEqual([1]);
    expect(got.markerAlphas, `${where}, ${mPerPx} m/px`).toEqual([1]);
    expect(got.markers, `${where}, ${mPerPx} m/px: markers`).toBeGreaterThan(15);
    expect(got.covered, `${where}, ${mPerPx} m/px: names with something drawn over their letters`).toEqual([]);
    expect(got.names, `${where}, ${mPerPx} m/px: names shown`).toBeGreaterThanOrEqual(atLeast);
  }

  // While the game runs the markers move with their armies, every tick. A name one comes to
  // stand on goes out by its fade and comes in at another place by its fade; it never jumps and
  // it does not follow a marker. The view's own frames for four seconds at top speed, the camera
  // at rest: a name's box may not move at all while it shows.
  await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 1000 });
  }, { cx: EX, cy: EY });
  await settle(page);
  const running = await page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const hud = window.__warsim!.hud;
    hud.setSpeedLevel(99);
    if (hud.paused.value) hud.togglePause();
    const last = new Map<number, { x: number; y: number; alpha: number }>();
    const jumps: string[] = [];
    const shown: number[] = [];
    let frames = 0;
    let fades = 0;
    const tick = v.lastTick;
    for (const t0 = performance.now(); performance.now() - t0 < 4000; ) {
      await new Promise((done) => requestAnimationFrame(done));
      frames++;
      let names = 0;
      for (const l of v.cityLabels.lastPlaced) {
        if (!l.box || l.ghost) continue;
        if (l.nameAlpha > 0.5) names++;
        const was = last.get(l.index);
        if (was) {
          const moved = Math.hypot(l.box.x - was.x, l.box.y - was.y);
          if (moved > 0.5 && Math.min(l.nameAlpha, was.alpha) > 0.02) jumps.push(`${v.cityLabels.city(l.index).name}: ${moved.toFixed(0)} px at opacity ${l.nameAlpha.toFixed(2)}`);
          if ((was.alpha === 1 && l.nameAlpha < 1) || (was.alpha === 0 && l.nameAlpha > 0)) fades++;
        }
        last.set(l.index, { x: l.box.x, y: l.box.y, alpha: l.nameAlpha });
      }
      shown.push(names);
    }
    if (!hud.paused.value) hud.togglePause();
    hud.setSpeedLevel(4);
    return { frames, ticks: v.lastTick - tick, fades, jumps, fewest: Math.min(...shown), most: Math.max(...shown), markers: v.markerRects.length };
  });
  console.log(`running at top speed, 1000 m/px: ${running.frames} frames, ${running.ticks} ticks; ${running.markers} markers; ${running.fewest} to ${running.most} names shown, ${running.fades} fades begun, ${running.jumps.length} jumps`);
  expect(running.ticks).toBeGreaterThan(50);
  expect(running.frames).toBeGreaterThan(8);
  expect(running.jumps).toEqual([]);
  // The names are still there while the armies march: four in five of the 25 of before.
  expect(running.fewest, 'names shown while running').toBeGreaterThanOrEqual(15);
  await settle(page);
  await page.screenshot({ path: path.join(out, 'city-names-t1-central-europe-1000m-after-running.png') });
});
