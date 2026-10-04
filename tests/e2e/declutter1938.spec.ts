import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

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

interface Box { key: string; x: number; y: number; w: number; h: number; alpha: number; strength: number; others: number; text: string; folded?: boolean }

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
/** Moves the camera, draws until the unit animations have run out, and returns the counters. */
async function rest(page: Page, cx: number, cy: number, scale: number): Promise<Box[]> {
  await page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx, cy, scale });
  await settle(page);
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
  // A fade starts at full opacity. In the one frame in which a counter begins to fold into its
  // neighbour it still stands at alpha 1 on that neighbour, and a sample can be that frame (a
  // gate run was; a probe saw it in 2 of 283 samples, each pair with one counter "folded since
  // 0.0 ms"). So a sample is two frames, 17 ms apart, with no snapshot between them:
  // - in the first, the counters that are shown (not on their way out) do not overlap, whatever
  //   their opacity;
  // - in the second, every counter on its way out has begun to fade, and the counters drawn in
  //   full do not overlap.
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const [first, second] = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const now = performance.now();
      return [now, now + 17].map((at) => {
        v.draw(at);
        return v.counters.drawn.map((d) => ({ key: d.key, x: d.x, y: d.y, w: d.w, h: d.h, alpha: d.alpha, strength: d.strength, others: d.others, text: d.text, folded: d.folded }));
      });
    });
    expect(overlaps(first!.filter((x) => !x.folded)), `running, sample ${i}`).toEqual([]);
    expect(second!.filter((x) => x.folded && x.alpha === 1).map((x) => x.key), `running, sample ${i}: going out, not fading`).toEqual([]);
    expect(overlaps(second!.filter((x) => x.alpha === 1)), `running, sample ${i}, a frame on`).toEqual([]);
    expect(second!.filter((x) => x.alpha === 1).length, `running, sample ${i}`).toBeGreaterThan(10);
  }
  await page.screenshot({ path: path.join(out, 'declutter-europe-running.png') });
  await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    if (!hud.paused.value) hud.togglePause();
    hud.setSpeedLevel(4);
  });
});

// PLAN 2.7l: the counters at rest after a step of the camera do not depend on the frames drawn on
// the way. Seen in a gate run under load: "start, 1.5 px per cell" above had 2 counters over
// central Europe where every other run has 3. The frames here are drawn by the test, at times
// it gives, in one call into the page: the view's own loop cannot draw between them, so the
// time between frames is what the test says and not what the machine gives.
test('the T0 counters at rest after a step are the same whatever the time between the frames', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const [x0, y0] = cellOf(5, 55, W, H);
  const [x1, y1] = cellOf(25, 45, W, H);

  // The steps of the test above: the world, then closer over Europe. One run for each spacing.
  const runs = await page.evaluate(({ stops, spacings, x0, y0, x1, y1 }) => {
    const v = window.__warsim!.view!;
    let now = performance.now() + 60_000; // ahead of every frame the view's own loop has drawn
    /** Steps the camera and draws frames `dt` ms apart until two in a row leave nothing animating. */
    const rest = (cx: number, cy: number, scale: number, dt: number): { keys: string[]; central: number; level: number | null; frames: number } => {
      v.controller.set({ cx, cy, scale });
      let frames = 0;
      for (let quiet = 0; quiet < 2; now += dt, frames++) {
        v.drawUnitLayers(now);
        quiet = v.unitsAnimating(now) ? 0 : quiet + 1;
        if (frames > 2000) throw new Error('the counters did not come to rest');
      }
      const d = v.counters.drawn;
      if (d.some((c) => c.alpha !== 1)) throw new Error('a counter at rest is not in full');
      return { keys: d.map((c) => c.key).sort(), central: d.filter((c) => c.wx >= x0 && c.wx <= x1 && c.wy >= y0 && c.wy <= y1).length, level: v.counters.level, frames };
    };
    return spacings.map((dt) => stops.map(([cx, cy, scale]) => rest(cx, cy, scale, dt)));
  }, { stops: [[W / 2, H / 2, WORLD], [EX, EY, 1.5], [EX, EY, 3], [EX, EY, 6], [EX, EY, 8]] as [number, number, number][], spacings: [16, 60, 200, 1000], x0, y0, x1, y1 });

  const [ref, ...others] = runs;
  console.log(`counters at rest (cluster level; all in view, over central Europe): ${ref!.map((r) => `level ${r.level}: ${r.keys.length}, ${r.central}`).join(' → ')}`);
  // The steps do change the level, so every stop but the first is reached by a split in flight.
  expect(new Set(ref!.map((r) => r.level)).size).toBeGreaterThanOrEqual(3);
  for (const [i, run] of others.entries())
    for (const [k, stop] of run.entries()) expect(stop.keys, `stop ${k}, frames ${[60, 200, 1000][i]} ms apart`).toEqual(ref![k]!.keys);
  // With margin now: more counters over central Europe at each closer stop.
  for (let k = 1; k < ref!.length; k++) expect(ref![k]!.central, `stop ${k}`).toBeGreaterThan(ref![k - 1]!.central);
});
