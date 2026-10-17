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

// PLAN 7.4f43: two Soviet divisions on Chukotka either side of the seam, a fraction of a cell
// apart: on the screen their markers lay on each other, a map's width apart in its cells, and
// were never stacked. They are one marker of two now.
test('markers of one nation either side of the seam stack', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const spots = [cellOf(-179.94, 65.6, W, H), cellOf(179.94, 65.6, W, H)];
  const ids = await page.evaluate(async ({ spots, SOV, INF }) => {
    const sim = window.__warsim!.sim;
    const v = window.__warsim!.view!;
    const before = new Set(v.formationsOf(SOV));
    for (const [x, y] of spots) sim.command({ kind: 'spawnFormation', nation: SOV, x: x!, y: y!, strength: 0, template: INF });
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    return v.formationsOf(SOV).filter((f) => !before.has(f));
  }, { spots, SOV, INF });
  expect(ids).toHaveLength(2);
  const places = await page.evaluate((ids) => ids.map((f) => window.__warsim!.view!.formationPos(f)!), ids);
  // A map's width apart in its cells, under a cell apart across the seam.
  expect(Math.abs(places[0]![0] - places[1]![0])).toBeGreaterThan(W - 2);
  await page.evaluate(({ cy }) => window.__warsim!.view!.controller.set({ cx: 0, cy, scale: 12 }), { cy: places[0]![1] });
  await page.waitForTimeout(900);
  const markers = await page.evaluate((ids) => window.__warsim!.view!.markerRects.filter((m) => m.alpha > 0.5 && m.members.some((f) => ids.includes(f))).map((m) => m.members), ids);
  console.log(`markers of the two: ${JSON.stringify(markers)}`);
  expect(markers.some((m) => ids.every((f) => m.includes(f))), 'one marker standing for both').toBe(true);
});

// PLAN 7.4f44: a capital flag's state (its rise above what is in its way, and the fade of it) was
// kept by the wrap offset of its copy. The camera folds its x at the seam, and the copy in view
// then had another offset: its state began again from nothing. A nation set down on Chukotka has
// its capital by the seam; the camera crosses the seam with the flag in view, and its state is
// the same entry before and after.
test('a capital flag keeps its state as the camera crosses the seam', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const [x, y] = cellOf(-179.9, 65.6, W, H);
  // A nation of one province set down there (God Mode's Spawn nation): its capital by the seam.
  const nation = await page.evaluate(async ({ x, y }) => {
    const { sim, view } = window.__warsim!;
    const province = view!.provinceAt(Math.floor(x), Math.floor(y));
    const before = new Set(window.__warsim!.hud.stats.value!.nations.map((n) => n.id));
    sim.command({ kind: 'spawnNation', province, size: 1 });
    await sim.step(1);
    const t0 = performance.now();
    while (performance.now() - t0 < 5000) {
      const now = window.__warsim!.hud.stats.value!.nations.find((n) => !before.has(n.id));
      if (now) return now.id;
      await new Promise((d) => setTimeout(d, 50));
    }
    return 0;
  }, { x, y });
  expect(nation, 'a nation set down on Chukotka').toBeGreaterThan(0);
  const keys = (): Promise<string[]> =>
    page.evaluate((n) => [...(window.__warsim!.view! as unknown as { flagPlace: Map<string, unknown> }).flagPlace.keys()].filter((k) => k.startsWith(`${n}:`)), nation);
  // The camera just west of the seam, then just east of it (folded to x 1), at 6 px a cell.
  const views: string[][] = [];
  for (const cx of [W - 1, W + 1]) {
    await page.evaluate(({ cx, cy }) => window.__warsim!.view!.controller.set({ cx, cy, scale: 6 }), { cx, cy: y });
    await page.waitForTimeout(500);
    views.push(await keys());
  }
  console.log(`the flag's state keys: west of the seam ${JSON.stringify(views[0])}, east ${JSON.stringify(views[1])}`);
  expect(views[0]!.length, 'its flag in view').toBeGreaterThan(0);
  expect(views[1], 'the same state across the seam').toEqual(views[0]);
});
