import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.45b AT (critic B7, the wall of counters): on the 1938 start and after one year, at world
// zoom over Europe, paused and running, no two counter boxes overlap; what did not fit is folded
// into a neighbour, never hidden: the counters still add up to the sim's strength (PLAN 2.2).
// A counter that is fading into a neighbour, or back out of one, overlaps by its nature for the
// 250 ms of its fade: the rule is about the counters drawn in full.

const { w: W, h: H } = SIZE_1938;
const VW = 1400;
const VH = 800;
const WORLD = Math.min(VW / W, VH / H); // px per cell with the whole map in view
const [EX, EY] = cellOf(15, 50, W, H); // Europe

interface Box { key: string; x: number; y: number; w: number; h: number; alpha: number; strength: number; others: number; text: string }

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate(() => window.__warsim!.view!.counters.drawn.map((d) => ({ key: d.key, x: d.x, y: d.y, w: d.w, h: d.h, alpha: d.alpha, strength: d.strength, others: d.others, text: d.text })));
/** Pairs of boxes that share any area. */
function overlaps(b: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++) {
      const [p, q] = [b[i]!, b[j]!];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) out.push(`${p.key} (${p.text}) and ${q.key} (${q.text})`);
    }
  return out;
}
/** Moves the camera, lets the unit animations run out, draws, and returns the counters. */
async function rest(page: Page, cx: number, cy: number, scale: number): Promise<Box[]> {
  await page.evaluate(({ cx, cy, scale }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale });
    v.draw();
  }, { cx, cy, scale });
  await page.waitForFunction(() => !window.__warsim!.view!.unitsAnimating());
  await page.evaluate(() => window.__warsim!.view!.draw());
  return boxes(page);
}
const simStrength = (page: Page): Promise<number> => page.evaluate(async () => (await window.__warsim!.sim.inspect(true)).formations.reduce((a, f) => a + f.strength, 0));

test('T0 counters never overlap: what does not fit is folded into a neighbour, and the sum holds', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.45') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const europe = { x: 560, y: 150, width: 420, height: 320 }; // where the critic's crop of the pile-up was

  for (const when of ['start', 'after one year'] as const) {
    if (when === 'after one year') {
      await page.evaluate(() => window.__warsim!.sim.step(24 * 365));
      await expect(page.getByTestId('date-label')).toContainText('1939', { timeout: 60_000 });
    }
    // The whole world in view, paused, at rest.
    const world = await rest(page, W / 2, H / 2, WORLD);
    expect(world.length, when).toBeGreaterThan(30);
    expect([...new Set(world.map((b) => b.alpha))], when).toEqual([1]);
    expect(overlaps(world), when).toEqual([]);
    // Nothing hidden: the counters add up to every formation in the sim.
    expect(world.reduce((a, b) => a + b.strength, 0), when).toBe(await simStrength(page));
    // Europe is no longer one counter per nation on top of the next: several stand there, and
    // some of them say how many other nations they hold.
    const inEurope = world.filter((b) => b.x + b.w > europe.x && b.x < europe.x + europe.width && b.y + b.h > europe.y && b.y < europe.y + europe.height);
    expect(inEurope.length, when).toBeGreaterThanOrEqual(5);
    expect(inEurope.some((b) => b.others > 0), when).toBe(true);
    const tag = when === 'start' ? 'start' : 'year1';
    await page.screenshot({ path: path.join(out, `declutter-world-${tag}.png`) });
    await page.screenshot({ path: path.join(out, `declutter-europe-crop-${tag}.png`), clip: europe });

    // Closer over Europe, down to just above T1: still no overlap, and what was folded comes
    // out: central Europe (5°–25° E, 45°–55° N) shows more counters at each step.
    const [x0, y0] = cellOf(5, 55, W, H);
    const [x1, y1] = cellOf(25, 45, W, H);
    const central = (): Promise<number> => page.evaluate(({ x0, y0, x1, y1 }) => window.__warsim!.view!.counters.drawn.filter((d) => d.wx >= x0 && d.wx <= x1 && d.wy >= y0 && d.wy <= y1).length, { x0, y0, x1, y1 });
    let before = await central();
    for (const scale of [1.5, 3, 6, 8]) {
      const b = await rest(page, EX, EY, scale);
      expect(overlaps(b), `${when}, ${scale} px per cell`).toEqual([]);
      expect([...new Set(b.map((x) => x.alpha))], `${when}, ${scale} px per cell`).toEqual([1]);
      const now = await central();
      expect(now, `${when}, ${scale} px per cell`).toBeGreaterThan(before);
      before = now;
      if (scale === 3) await page.screenshot({ path: path.join(out, `declutter-europe-${tag}.png`) });
    }
  }

  // Running, a year in: among the counters drawn in full no two overlap, frame after frame.
  await rest(page, EX, EY, 3);
  await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    hud.setSpeedLevel(99);
    if (hud.paused.value) hud.togglePause();
  });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const b = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      v.draw();
      return v.counters.drawn.map((d) => ({ key: d.key, x: d.x, y: d.y, w: d.w, h: d.h, alpha: d.alpha, strength: d.strength, others: d.others, text: d.text }));
    });
    expect(overlaps(b.filter((x) => x.alpha === 1)), `running, sample ${i}`).toEqual([]);
    expect(b.filter((x) => x.alpha === 1).length, `running, sample ${i}`).toBeGreaterThan(10);
  }
  await page.screenshot({ path: path.join(out, 'declutter-europe-running.png') });
  await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    if (!hud.paused.value) hud.togglePause();
    hud.setSpeedLevel(4);
  });
});
