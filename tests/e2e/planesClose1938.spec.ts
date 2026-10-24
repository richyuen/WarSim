import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Leg } from '../../src/shared/sorties';
import { spriteTint } from '../../src/render/units/tint';

// PLAN 7.108a (the critic's run 13, `critic/shots/c13z_5861_17.png`): the wheel zoom ended on three
// plane silhouettes about 140 px wide at 3 m/px, larger than a company. At 3 m/px over the
// Germany–Poland front of seed 7019 every plane drawn is now no wider on screen than SPAN_BAR × its
// wingspan at that scale: measured on the pixels of its nation's tint on the overlay, each given to
// the nearest plane's middle.

const SPAN_BAR = 1.5;
const M_PER_PX = 3;
const TINT_NEAR = 60;
/** Wingspans, metres, by role (a Bf 109's to a Ju 52's), as the page's `WINGSPAN_M`; the bar is read here, not from the code it tests. */
const WINGSPAN_M = [9.9, 13.8, 22.6, 31.6, 15.5, 29.3];
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [fx, fy] = cellOf(18.5, 52.3, SIZE_1938.w, SIZE_1938.h);

test('close: the planes over the 7019 front at 3 m/px are no wider than their wingspan', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=7019');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.108') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  await page.evaluate(() => window.__warsim!.sim.step(72));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 72);

  // The hour with a German or Polish sortie on its way over the front (not one circling its
  // target: that circle is the page's, a share of the view at each zoom), its place in cells.
  const sides = [id('GER'), id('POL')];
  let spot: { x: number; y: number; hour: number } | null = null;
  for (let h = 73; h <= 120 && !spot; h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, h);
    spot = await page.evaluate(({ x, y, sides, h, over }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 1500 });
      v.draw();
      const s = v.sortieMarks.find((p) => sides.includes(p.nation) && p.leg !== over && p.x > 200 && p.x < window.innerWidth - 200 && p.y > 200 && p.y < window.innerHeight - 200);
      if (!s) return null;
      const cam = v.controller.cam;
      return { x: cam.cx + (s.x - window.innerWidth / 2) / cam.scale, y: cam.cy + (s.y - window.innerHeight / 2) / cam.scale, hour: h };
    }, { x: fx, y: fy, sides, h, over: Leg.Over });
  }
  expect(spot, 'a sortie over the front in two days').not.toBeNull();

  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: spot!.x, y: spot!.y, m: M_PER_PX });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.shares.individuals > 0.99;
  }, null, { timeout: 30_000 });
  await page.waitForTimeout(300);

  // The planes and their nations' colours, then each tint pixel (opaque, within TINT_NEAR of its
  // plane's nation tint) given to the nearest plane's middle; a plane's drawn span is twice its
  // furthest pixel's distance.
  const marks = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw();
    const own = (v as unknown as { ownColor: Map<number, number> }).ownColor;
    return v.sortieMarks.flatMap((s) => s.at.map(([x, y]) => ({ x, y, nation: s.nation, role: (s as { role?: number }).role ?? 0, own: own.get(s.nation) ?? 0x888888 })));
  });
  const tints = marks.map((p) => {
    const t = spriteTint(p.own);
    return [(t >> 16) & 255, (t >> 8) & 255, t & 255] as [number, number, number];
  });
  const got = await page.evaluate(({ planes, tints, near }) => {
    const v = window.__warsim!.view!;
    v.draw();
    const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
    const ctx = overlay.getContext('2d')!;
    const dpr = overlay.width / overlay.clientWidth;
    const img = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    const W = overlay.width;
    const H = overlay.height;
    const box = 400;
    const reach = planes.map(() => 0);
    const pixels = planes.map(() => 0);
    for (let k = 0; k < planes.length; k++) {
      const p = planes[k]!;
      const t = tints[k]!;
      const x0 = Math.max(0, Math.floor((p.x - box) * dpr));
      const x1 = Math.min(W - 1, Math.ceil((p.x + box) * dpr));
      const y0 = Math.max(0, Math.floor((p.y - box) * dpr));
      const y1 = Math.min(H - 1, Math.ceil((p.y + box) * dpr));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const o = (py * W + px) * 4;
          if (img[o + 3]! < 128) continue;
          if (Math.abs(img[o]! - t[0]) + Math.abs(img[o + 1]! - t[1]) + Math.abs(img[o + 2]! - t[2]) > near) continue;
          const cx = px / dpr;
          const cy = py / dpr;
          const d = Math.hypot(cx - p.x, cy - p.y);
          if (planes.some((q) => Math.hypot(cx - q.x, cy - q.y) < d)) continue;
          pixels[k]!++;
          reach[k] = Math.max(reach[k]!, d);
        }
      }
    }
    return { reach, pixels, w: overlay.clientWidth, h: overlay.clientHeight, mpp: v.metresPerPx };
  }, { planes: marks, tints, near: TINT_NEAR });
  await page.screenshot({ path: path.join(out, `a-planes-close-${M_PER_PX}m${process.env['SHOT_TAG'] ?? ''}.png`) });

  const rows = marks
    .map((p, k) => ({ nation: NATIONS_1938[p.nation - 1]?.tag ?? p.nation, role: p.role, drawn: 2 * got.reach[k]!, pixels: got.pixels[k]!, bar: (SPAN_BAR * WINGSPAN_M[p.role]!) / got.mpp, inView: p.x >= 0 && p.y >= 0 && p.x < got.w && p.y < got.h }))
    .filter((r) => r.inView);
  process.stderr.write(`hour ${spot!.hour}, ${got.mpp.toFixed(2)} m/px; ${rows.length} planes drawn:\n${rows.map((r) => `  ${r.nation} role ${r.role}: ${r.pixels} px of its tint, drawn ${r.drawn.toFixed(1)} px wide, bar ${r.bar.toFixed(1)} px\n`).join('')}`);
  expect(got.mpp, 'the camera at 3 m/px').toBeLessThan(M_PER_PX * 1.05);
  expect(rows.length, 'planes drawn at 3 m/px').toBeGreaterThan(0);
  expect(rows.filter((r) => r.pixels > 0).length, 'planes seen in their tint').toBeGreaterThan(0);
  for (const r of rows) expect(r.drawn, `${r.nation}'s plane (role ${r.role}) on screen against ${SPAN_BAR} × its wingspan`).toBeLessThanOrEqual(r.bar);
});
