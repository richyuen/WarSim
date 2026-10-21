import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { LINE_CELLS } from '../../src/render/units/individuals';
import { Leg } from '../../src/shared/sorties';
import { spriteTint } from '../../src/render/units/tint';

// PLAN 7.51a (the critic's run 11, `critic/shots/c11c_7019_inf_0010m.png`): at 10 m/px over the
// Germany–Poland front of seed 7019 the aircraft were "three white glyphs the size of a squad, not
// in a nation's colour". Every plane drawn there now has its middle within TINT_NEAR (summed RGB)
// of its nation's sprite tint, as its men have it, and a span of at least SPAN_MEN men's figures.

const TINT_NEAR = 40;
const SPAN_MEN = 4;
const M_PER_PX = 10;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [fx, fy] = cellOf(18.5, 52.3, SIZE_1938.w, SIZE_1938.h);

test('T3: the planes over the 7019 front are in their nation\'s tint and wider than a squad', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=7019');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.51') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  await page.evaluate(() => window.__warsim!.sim.step(72));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 72);

  // The hour with a German or Polish sortie on its way over the front, seen at 1,500 m/px (paused,
  // the sorties stand where the hour left them); its place in cells. Not one circling its target:
  // that circle is the page's, its radius a share of the view at each zoom, so its place on screen
  // at 1,500 m/px is no place at 10.
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

  // At 10 m/px on it, T3's figures in.
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: spot!.x, y: spot!.y, m: M_PER_PX });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.shares.individuals > 0.99;
  }, null, { timeout: 30_000 });
  await page.waitForTimeout(300);

  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw();
    const own = (v as unknown as { ownColor: Map<number, number> }).ownColor;
    const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
    const ctx = overlay.getContext('2d')!;
    const dpr = overlay.width / overlay.clientWidth;
    const planes: { nation: number; own: number; span: number; rgb: number[] }[] = [];
    for (const s of v.sortieMarks) {
      for (const [x, y] of s.at) {
        if (x < 0 || y < 0 || x >= overlay.clientWidth || y >= overlay.clientHeight) continue;
        const p = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
        planes.push({ nation: s.nation, own: own.get(s.nation) ?? 0x888888, span: s.span, rgb: [p[0]!, p[1]!, p[2]!, p[3]!] });
      }
    }
    return { planes, scale: v.controller.cam.scale, unit: (v as unknown as { unitScale: number }).unitScale, mpp: v.metresPerPx };
  });
  await page.screenshot({ path: path.join(out, `a-planes-t3-${M_PER_PX}m${process.env['SHOT_TAG'] ?? ''}.png`) });
  const man = LINE_CELLS * SIZE_1938.scale * got.scale * got.unit;
  const rows = got.planes.map((p) => {
    const t = spriteTint(p.own);
    const want = [(t >> 16) & 255, (t >> 8) & 255, t & 255];
    const off = Math.abs(p.rgb[0]! - want[0]!) + Math.abs(p.rgb[1]! - want[1]!) + Math.abs(p.rgb[2]! - want[2]!);
    return { nation: NATIONS_1938[p.nation - 1]?.tag ?? p.nation, off, span: p.span, men: p.span / man, rgb: p.rgb.slice(0, 3).join(','), want: want.join(',') };
  });
  process.stderr.write(`hour ${spot!.hour}, ${got.mpp.toFixed(1)} m/px, a man's figure ${man.toFixed(2)} px; ${rows.length} planes drawn:\n${rows.map((r) => `  ${r.nation}: middle ${r.rgb} against ${r.want}, off ${r.off}; span ${r.span.toFixed(1)} px, ${r.men.toFixed(2)} men\n`).join('')}`);
  expect(rows.length, 'planes drawn at T3').toBeGreaterThan(0);
  for (const r of rows) {
    expect(r.off, `${r.nation}'s plane's middle against its tint`).toBeLessThanOrEqual(TINT_NEAR);
    expect(r.men, `${r.nation}'s plane's span in men's figures`).toBeGreaterThanOrEqual(SPAN_MEN);
  }
});
