import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { HULL_LIFE_MS } from '../../src/render/fx/hulls';
import { figureCount } from '../../src/render/units/individuals';
import { Frame, Wreck } from '../../src/shared/unitLooks';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 3.11d (the critic's R3-B3: "No wreck was ever drawn. In 230 sim hours of the largest
// fight `wrecks` and `shown` stayed 0", `critic/c3_m.json`): the critic's game (seed 4242,
// Germany against Poland by God Mode) from day 21, a day of it at T3 on Polish division 550,
// which stands front to front with German division 3. A battalion there loses a figure or two
// in a day and dies whole in none. What an element that is not of tanks loses now lies where
// its figure stood: the fallen, a broken gun.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = nation('GER');
const POL = nation('POL');
const POLE = 550;
const VIEW = { width: 1600, height: 900 };
const HOURS = 24;
const key = (h: { element: number; figure: number }): string => `${h.element}:${h.figure}`;
/** By the frame a sprite was uploaded with: infantry in contact is down (`shownFrame`). */
const kindOf = (frame: number): number => (frame === Frame.infantry || frame === Frame.prone ? Wreck.men : frame === Frame.gun ? Wreck.gun : frame === Frame.halftrack ? Wreck.vehicle : -1);

test('T3: within a day of a fight that costs strength, what a battalion and a battery lose lies where it stood', async ({ page }, info) => {
  test.setTimeout(420_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=4242');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const start = await page.evaluate(async ({ GER, POL }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
    let tick = 0;
    for (let d = 0; d < 21; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    return tick;
  }, { GER, POL });
  // Three weeks of war at the world view leave no mark: the view held no element.
  expect(await page.evaluate(() => window.__warsim!.view!.hulls.fallen.length)).toBe(0);
  expect(await page.evaluate(async (id) => (await window.__warsim!.sim.formation(id))?.engaged, POLE)).toBe(true);

  /** The view on (x, y) at `m` metres a pixel, with the section of that zoom drawn. */
  const goTo = (x: number, y: number, m: number): Promise<void> =>
    page.evaluate(async ({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { x, y, m });

  // The middle of the division's block, from its elements; then the close tier on it.
  const [fx, fy] = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), POLE))!;
  await goTo(fx, fy, 20);
  const centre = await page.evaluate((id) => {
    const v = window.__warsim!.view!;
    let [x, y, n] = [0, 0, 0];
    for (let i = 0; i < v.elementCount; i++) {
      if (v.elementFormation[i] !== id) continue;
      x += v.elementX[i]!;
      y += v.elementY[i]!;
      n++;
    }
    return { x: x / n, y: y / n, n };
  }, POLE);
  expect(centre.n, `elements of formation ${POLE} at 20 m/px`).toBeGreaterThan(20);
  await goTo(centre.x, centre.y, 6);
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.individualCount > 0;
  }, null, { timeout: 15_000 });
  // Elements first seen: no mark, whatever they have lost in the weeks before.
  expect(await page.evaluate(() => window.__warsim!.view!.hulls.fallen.length)).toBe(0);

  /** Steps one hour and reads the view's elements before and after it, the marks it brought and whether they are drawn. */
  const hour = (tick: number) => page.evaluate(async ({ tick, lifeMs }) => {
    const v = window.__warsim!.view!;
    const elements = (): { id: number; strength: number; size: number; frame: number }[] =>
      Array.from(v.elementId, (id, i) => ({ id, strength: v.elementStrength[i]!, size: v.elementSize[i]!, frame: v.elementFrame(i) }));
    const before = elements();
    // The frame before the step: the figures of the snapshot in hand, an element's in their order.
    v.drawUnitLayers(performance.now());
    const stood = Array.from({ length: v.individualCount }, (_, j) => ({ id: v.individualOwner[j]!, x: v.individualX[j]!, y: v.individualY[j]! }));
    const had = new Set(v.hulls.fallen);
    await window.__warsim!.sim.step(1);
    await new Promise<void>((done) => {
      const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    const fresh = v.hulls.fallen.filter((m) => !had.has(m));
    const born = fresh[0]?.born ?? 0;
    const draw = (at: number): string[] => {
      v.drawUnitLayers(at);
      return v.hulls.fallenShown.filter((m) => fresh.includes(m)).map((m) => `${m.element}:${m.figure}`);
    };
    const c = document.querySelector('canvas')!;
    const lying = fresh.length > 0 ? draw(born + 100) : [];
    const gone = fresh.length > 0 ? draw(born + lifeMs) : [];
    // The frame the page goes on with is of now.
    v.drawUnitLayers(performance.now());
    return {
      before,
      stood,
      after: elements(),
      fresh: fresh.map((m) => ({ element: m.element, figure: m.figure, kind: m.kind, x: m.x, y: m.y, burns: m.burns })),
      lying,
      gone,
      share: v.shares.individuals,
      cam: { ...v.controller.cam },
      size: [c.clientWidth, c.clientHeight] as const,
    };
  }, { tick, lifeMs: HULL_LIFE_MS });

  let [men, guns, unfired, inView, lostFigures] = [0, 0, 0, 0, 0];
  let firstAt = -1;
  let shot = false;
  for (let h = 0; h < HOURS; h++) {
    const got = await hour(start + h + 1);
    expect(got.share).toBe(1);
    // What the hour took: the figures an element in both snapshots has no more, each where the frame before had it.
    const now = new Map(got.after.map((e) => [e.id, e]));
    const want = new Map<string, { kind: number; x: number; y: number }>();
    for (const e of got.before) {
      const a = now.get(e.id);
      const kind = kindOf(e.frame);
      if (!a || kind < 0) continue;
      const own = got.stood.filter((g) => g.id === e.id);
      expect(own.length, `figures of ${e.id} in the frame before the step`).toBe(figureCount(e.strength, e.size));
      for (let k = figureCount(a.strength, a.size); k < own.length; k++) want.set(key({ element: e.id, figure: k }), { kind, x: own[k]!.x, y: own[k]!.y });
    }
    lostFigures += want.size;
    // Every mark is of such a figure, of its kind and on its place. A gun is marked whether
    // fired at or not; men lost in an hour with no fire on their battalion leave none.
    for (const m of got.fresh) {
      const w = want.get(key(m));
      expect(w, `mark ${key(m)} of hour ${h + 1} is of a figure lost`).toBeDefined();
      expect(m.kind).toBe(w!.kind);
      expect(m.x, `mark ${key(m)}, x`).toBeCloseTo(w!.x, 9);
      expect(m.y, `mark ${key(m)}, y`).toBeCloseTo(w!.y, 9);
      if (m.kind === Wreck.men) expect(m.burns).toBe(true);
    }
    const marked = new Set(got.fresh.map(key));
    for (const [k, w] of want) {
      if (w.kind !== Wreck.men) expect(marked.has(k), `the gun or half-track ${k} of hour ${h + 1} has its mark`).toBe(true);
      else if (!marked.has(k)) unfired++;
    }
    men += got.fresh.filter((m) => m.kind === Wreck.men).length;
    guns += got.fresh.filter((m) => m.kind !== Wreck.men).length;
    if (got.fresh.length === 0) continue;
    if (firstAt < 0) firstAt = h + 1;
    const [vw, vh] = got.size;
    const seen = got.fresh.filter((m) => Math.abs(m.x - got.cam.cx) * got.cam.scale < vw / 2 && Math.abs(m.y - got.cam.cy) * got.cam.scale < vh / 2);
    inView += seen.length;
    // Drawn while it lies, those in the view at least; gone when its time is over.
    for (const m of seen) expect(got.lying, `mark ${key(m)} drawn`).toContain(key(m));
    expect(got.gone).toEqual([]);
    if (!shot && seen.length >= 3) {
      shot = true;
      await page.screenshot({ path: path.join(out, 'd-the-fallen-6m.png') });
      // Nearer, on the mark with the most of the others about it.
      const about = (m: (typeof seen)[number]): number => seen.filter((o) => Math.hypot(o.x - m.x, o.y - m.y) < 0.02).length;
      const mid = seen.reduce((best, m) => (about(m) > about(best) ? m : best));
      await goTo(mid.x, mid.y, 2);
      expect(await page.evaluate(() => window.__warsim!.view!.hulls.fallenShown.length), 'marks drawn at 2 m/px').toBeGreaterThanOrEqual(1);
      await page.screenshot({ path: path.join(out, 'd-the-fallen-2m.png') });
      await goTo(centre.x, centre.y, 6);
    }
  }
  // What lies there at the day's end: the marks of its last hours (a mark lies 17.5 s, an hour of this test takes two or three).
  const lying = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.drawUnitLayers(performance.now());
    return v.hulls.fallenShown.length;
  });
  await page.screenshot({ path: path.join(out, 'd-the-fallen-after-a-day-6m.png') });
  expect(lying, 'marks drawn at the day\'s end').toBeGreaterThanOrEqual(3);
  info.annotations.push({ type: 'fallen', description: `day 22 on formation ${POLE} at 6 m/px: ${lostFigures} figures lost by elements the view held; ${men} of the fallen and ${guns} guns or half-tracks marked, ${inView} of the marks in the view, the first in hour ${firstAt}, ${lying} drawn at the day's end; ${unfired} figures of men lost in hours with no fire on their battalion left none` });
  console.log(info.annotations.at(-1)!.description);
  // The critic's bar: within a day of a fight that costs strength.
  expect(firstAt, 'the hour of the first mark').toBeGreaterThan(0);
  expect(men, 'marks of the fallen in a day').toBeGreaterThanOrEqual(10);
  expect(inView, 'marks in the view in a day').toBeGreaterThanOrEqual(10);
  expect(shot, 'an hour with three marks in the view, for the pictures').toBe(true);
});
