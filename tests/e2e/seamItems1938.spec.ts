import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 7.4f40 (a line of PLAN 7.4's "seam of the looping map"): a counter or marker within its
// half-width of the 180° meridian was drawn only once the view's edge had crossed the seam, and
// then half of it at once. A Soviet division just east of the seam, on Chukotka; the view's right
// edge a few px west of the seam. Its counter (T0) and its marker (T1) reach back over the seam
// into the view: part of each is drawn, as on a map with no seam.

const { w: W, h: H } = SIZE_1938;
const SOV = NATIONS_1938.findIndex((n) => n.tag === 'SOV') + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const VW = 1400;
const VH = 800;

test('a counter and a marker by the seam are drawn as they reach into the view', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const h = window.__warsim!.hud;
    if (h.showStats.value) h.toggleStats();
  });
  // Just east of the seam: x a little over 0.
  const [x, y] = cellOf(-179.92, 65.6, W, H);
  const id = await page.evaluate(async ({ x, y, SOV, INF }) => {
    const sim = window.__warsim!.sim;
    const before = new Set(window.__warsim!.view!.formationsOf(SOV));
    sim.command({ kind: 'spawnFormation', nation: SOV, x, y, strength: 0, template: INF });
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    return window.__warsim!.view!.formationsOf(SOV).find((f) => !before.has(f)) ?? 0;
  }, { x, y, SOV, INF });
  expect(id, 'the division spawned').toBeGreaterThan(0);
  const [fx, fy] = (await page.evaluate((f) => window.__warsim!.view!.formationPos(f), id))!;
  // Under a marker's half-width (13 px) of the seam at 12 px a cell.
  expect(((fx % W) + W) % W, 'cells east of the seam').toBeLessThan(1);

  // The view's right edge `short` px west of the seam: a counter is 44 px wide, a marker 26.
  for (const [layer, scale, short] of [['counter', 1.2, 10], ['marker', 12, 2]] as const) {
    const cx = W - (VW / 2 + short) / scale;
    await page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx, cy: fy, scale });
    await page.waitForTimeout(700);
    // How far east of the seam it stands, px: under a box's half-width.
    const east = (((fx % W) + W) % W) * scale;
    const boxes = await page.evaluate(({ layer, id }) => {
      const v = window.__warsim!.view!;
      return layer === 'counter' ? v.counters.boxes.filter((b) => b.alpha > 0.1).map((b) => ({ x: b.x, w: b.w })) : v.markerRects.filter((m) => m.members.includes(id) && m.alpha > 0.1).map((m) => ({ x: m.x, w: m.w }));
    }, { layer, id });
    // At the view's right edge: a box that begins in the view and ends past it.
    const atEdge = boxes.filter((b) => b.x < VW && b.x + b.w > VW - 10);
    console.log(`${layer}, ${scale} px a cell: the division ${east.toFixed(1)} px east of the seam; boxes at the right edge ${JSON.stringify(atEdge)}`);
    expect(atEdge.length, `a ${layer} over the seam at the view's right edge`).toBeGreaterThan(0);
  }
});
