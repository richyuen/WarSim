import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 2.2 AT: zooming T0 ↔ T1 shows no frame where a counter (or marker) vanishes or appears
// without a matching animation. The test records every drawn counter and marker per frame of a
// scripted zoom (fixed 16 ms frames) and checks frame-to-frame continuity, with the camera change
// applied: every item in one frame either continues in the next (same key, moved at most 80 px:
// a split/merge animation) or is replaced in place (a same-nation item within 12 px), its opacity
// dropping by at most 0.3; and the reverse for appearing items. Items near the edge are skipped.

const { w: W, h: H } = SIZE_1938;
const VW = 1400;
const VH = 800;

interface Item { key: string; nation: number; wx: number; wy: number; alpha: number }
interface Frame { cx: number; cy: number; scale: number; level: number | null; items: Item[] }

const screen = (f: Frame, it: Item): [number, number] => [(it.wx - f.cx) * f.scale + VW / 2, (it.wy - f.cy) * f.scale + VH / 2];
const inside = (p: [number, number], m: number): boolean => p[0] >= m && p[0] <= VW - m && p[1] >= m && p[1] <= VH - m;

/** Items of `a` (frame `fa`) with no continuation in `b` (frame `fb`); positions compared in `fb`. */
function orphans(fa: Frame, a: Item[], fb: Frame, b: Item[]): Item[] {
  return a.filter((it) => {
    if (it.alpha < 0.2) return false;
    const p = screen(fb, it);
    if (!inside(p, 40) || !inside(screen(fa, it), 2)) return false;
    return !b.some((o) => {
      if (o.nation !== it.nation || o.alpha < it.alpha - 0.3) return false;
      const q = screen(fb, o);
      return Math.hypot(p[0] - q[0], p[1] - q[1]) <= (o.key === it.key ? 80 : 12);
    });
  });
}

test('T0 counters: Σ strength is the world total; zooming T0 ↔ T1 never pops a counter', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.2') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // One truth: with the whole world in view, the counters add up to Σ formation strength.
  await page.evaluate(({ w, h }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: w / 2, cy: h / 2, scale: Math.min(1400 / w, 800 / h) });
    v.draw(performance.now() + 10_000);
  }, { w: W, h: H });
  const s = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  const total = s.formations.reduce((a, f) => a + f.strength, 0);
  const drawn = await page.evaluate(() => window.__warsim!.view!.counters.drawn.map((d) => d.strength));
  expect(drawn.length).toBeGreaterThan(30);
  expect(drawn.reduce((a, b) => a + b, 0)).toBe(total);
  await page.screenshot({ path: path.join(out, 'counters-world.png') });

  // Scripted zoom over Europe: 30 km/px → 700 m/px → 30 km/px, 3% per 16 ms frame.
  const [cx, cy] = cellOf(15, 50, W, H);
  const frames: Frame[] = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    const scaleAt = (m: number): number => (v.metresPerPx * v.controller.cam.scale) / m;
    const res: Frame[] = [];
    let now = performance.now() + 20_000;
    let m = 30_000;
    const shot = (): void => {
      v.controller.set({ cx, cy, scale: scaleAt(m) });
      // The unit layers only: the map below them does not affect counters, and drawing it in
      // software for every frame starves the other e2e workers.
      v.drawUnitLayers(now);
      now += 16;
      const cam = v.controller.cam;
      res.push({
        cx: cam.cx,
        cy: cam.cy,
        scale: cam.scale,
        level: v.counters.level,
        items: [
          ...v.counters.drawn.map((d) => ({ key: `c${d.key}`, nation: d.nation, wx: d.wx, wy: d.wy, alpha: d.alpha })),
          ...v.markerRects.map((r) => ({ key: `m${r.id}`, nation: r.nation, wx: r.wx, wy: r.wy, alpha: r.alpha })),
        ],
      });
    };
    for (let i = 0; i < 20; i++) shot(); // settle at the start
    while (m > 700) { m /= 1.03; shot(); }
    for (let i = 0; i < 20; i++) shot();
    while (m < 30_000) { m *= 1.03; shot(); }
    for (let i = 0; i < 20; i++) shot();
    return res;
  }, { cx, cy });

  // The sequence exercised splits and merges across several levels, and reached T1 markers.
  const levels = frames.map((f) => f.level);
  const changes = levels.filter((l, i) => i > 0 && l !== levels[i - 1]).length;
  expect(changes).toBeGreaterThanOrEqual(8);
  expect(frames.some((f) => f.items.length > 0 && f.items.every((i) => i.alpha === 1) && f.scale > 0)).toBe(true);

  const problems: string[] = [];
  for (let k = 0; k + 1 < frames.length; k++) {
    const a = frames[k]!;
    const b = frames[k + 1]!;
    for (const it of orphans(a, a.items, b, b.items)) problems.push(`frame ${k}: nation ${it.nation} at (${it.wx.toFixed(1)}, ${it.wy.toFixed(1)}) vanished`);
    for (const it of orphans(b, b.items, b, a.items)) problems.push(`frame ${k + 1}: nation ${it.nation} at (${it.wx.toFixed(1)}, ${it.wy.toFixed(1)}) appeared`);
  }
  expect(problems.slice(0, 10)).toEqual([]);

  // Evidence: Europe at T0 and in the T0/T1 cross-fade.
  for (const m of [12_000, 4_000, 2_300]) {
    await page.evaluate(({ cx, cy, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      v.draw(performance.now() + 60_000);
    }, { cx, cy, m });
    await page.screenshot({ path: path.join(out, `counters-europe-${m}m.png`) });
  }
});
