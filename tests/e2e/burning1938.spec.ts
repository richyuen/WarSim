import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { FLAME_MS, HULL_LIFE_MS } from '../../src/render/fx/hulls';
import { figureCells, figureCount, figureOffsets, gridSide } from '../../src/render/units/individuals';
import { turretOf } from '../../src/shared/unitLooks';
import { armourLosses } from '../helpers/armourLosses';

// PLAN 3.6d AT: as many hulls as tanks lost in the view, burning where the sim had the element
// fired at in that hour and left behind where it had not (a breakdown, attrition). Ground where
// armour loses tanks is found in Node, once under fire and once without, the camera is put on
// it at T3, and the hours are stepped one by one: each hour's new hulls are the figures that
// the view's elements of tanks had before it and have no more, each on its figure's place, and
// the strengths are the sim's.

const FIRST_DAY = 14;
const LAST_DAY = 120;
const HOURS = 12;
/** Tanks lost in the way a test asks for on the ground the camera is put on, of elements that live on. */
const LEAST = 5;
const M_PER_PX = 4;
const NEAR_M_PER_PX = 1.5;

interface Hull {
  element: number;
  figure: number;
  x: number;
  y: number;
  born: number;
}
const key = (h: { element: number; figure: number }): string => `${h.element}:${h.figure}`;

test('T3: a tank lost under fire burns where it stood', async ({ page }, info) => {
  test.setTimeout(300_000);
  await watch(page, info, true);
});

test('T3: a tank lost without fire is left where it stood, and does not burn', async ({ page }, info) => {
  test.setTimeout(300_000);
  await watch(page, info, false);
});

/** Watches the ground where armour loses the most tanks, under fire or without. */
async function watch(page: Page, info: TestInfo, underFire: boolean): Promise<void> {
  const node = armourLosses(FIRST_DAY, LAST_DAY, HOURS, LEAST, underFire);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, node.start)).toEqual({ tick: node.start, hash: node.before });
  // Weeks of war at the world view leave no hull: the view held no element.
  expect(await page.evaluate(() => window.__warsim!.view!.hulls.hulls.length)).toBe(0);

  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: node.x, y: node.y, m: M_PER_PX });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    // A column on the march comes to this ground in the hours that are stepped: the view may hold no element yet.
    return v.subscription?.tier === 3 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.snapshots > 0 && v.elementsZoom < 1.01 * v.metresPerPx && v.individualsShown && v.shares.individuals === 1;
  }, { x: node.x, y: node.y }, { timeout: 15_000 });
  // Elements first seen: no hull, whatever they have lost in the weeks before.
  expect(await page.evaluate(() => window.__warsim!.view!.hulls.hulls.length)).toBe(0);

  /** Steps one hour and reads the view's elements before and after it, the hulls it brought and how they are drawn. */
  const hour = (tick: number) => page.evaluate(async ({ tick, flameMs, lifeMs }) => {
    const v = window.__warsim!.view!;
    const elements = (): { id: number; strength: number; size: number; frame: number; x: number; y: number; facing: number }[] =>
      Array.from(v.elementId, (id, i) => ({ id, strength: v.elementStrength[i]!, size: v.elementSize[i]!, frame: v.elementFrame(i), x: v.elementX[i]!, y: v.elementY[i]!, facing: v.elementFacing(i) }));
    const before = elements();
    const had = new Set(v.hulls.hulls);
    await window.__warsim!.sim.step(1);
    await new Promise<void>((done) => {
      const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    const fresh = v.hulls.hulls.filter((h) => !had.has(h));
    const born = fresh[0]?.born ?? 0;
    // What a frame at `at` draws: the hulls of this hour, the flames, and the hulls drawn that
    // were lost under fire no longer ago than a flame lasts (those of the hours before too).
    const draw = (at: number): { shown: string[]; flames: number; alight: number } => {
      v.drawUnitLayers(at);
      return { shown: v.hulls.shown.filter((h) => fresh.includes(h)).map((h) => `${h.element}:${h.figure}`), flames: v.hulls.flames, alight: v.hulls.shown.filter((h) => h.burns && at - h.born < flameMs).length };
    };
    const burning = fresh.length > 0 ? draw(born + 100) : null;
    // The figures of the frame that has the hulls burning.
    const figures = fresh.length > 0 ? Array.from({ length: v.individualCount }, (_, j) => ({ id: v.individualOwner[j]!, x: v.individualX[j]!, y: v.individualY[j]! })) : [];
    const c = document.querySelector('canvas')!;
    return {
      before,
      after: elements(),
      fresh: fresh.map((h) => ({ element: h.element, figure: h.figure, x: h.x, y: h.y, born: h.born, cells: h.cells, frame: h.frame, burns: h.burns })),
      sameBirth: fresh.every((h) => h.born === born),
      burning,
      smoking: fresh.length > 0 ? draw(born + flameMs + 100) : null,
      gone: fresh.length > 0 ? draw(born + lifeMs) : null,
      figures,
      share: v.shares.individuals,
      cam: { ...v.controller.cam },
      size: [c.clientWidth, c.clientHeight] as const,
    };
  }, { tick, flameMs: FLAME_MS, lifeMs: HULL_LIFE_MS });

  /** The hulls an hour must bring: the figures its elements of tanks in both snapshots have lost, where they stood. */
  const wanted = (got: Awaited<ReturnType<typeof hour>>): Hull[] => {
    const now = new Map(got.after.map((e) => [e.id, e]));
    const out: Hull[] = [];
    for (const e of got.before) {
      const a = now.get(e.id);
      if (!a || turretOf(e.frame) < 0) continue;
      const side = gridSide(e.frame, figureCount(e.size, e.size));
      const had = figureCount(e.strength, e.size);
      const off = figureOffsets(e.id, side, had, e.facing);
      for (let k = figureCount(a.strength, a.size); k < had; k++) out.push({ element: e.id, figure: k, x: e.x + off[k * 2]!, y: e.y + off[k * 2 + 1]!, born: 0 });
    }
    return out;
  };

  let hulls = 0;
  let burning = 0;
  let burningInView = 0;
  let inView = 0;
  let tanksHeld = 0;
  let endedInView = 0;
  for (let h = 0; h < HOURS; h++) {
    const got = await hour(node.start + h + 1);
    const want = wanted(got);
    expect(got.fresh.map(key).sort(), `hour ${h + 1}`).toEqual(want.map(key).sort());
    expect(got.sameBirth).toBe(true);
    const byKey = new Map(got.fresh.map((f) => [key(f), f]));
    for (const w of want) {
      const f = byKey.get(key(w))!;
      expect(f.x, `hull ${key(w)}, x`).toBeCloseTo(w.x, 9);
      expect(f.y, `hull ${key(w)}, y`).toBeCloseTo(w.y, 9);
      // It burns if the sim had its element fired at in this hour, and only then.
      expect(f.burns, `hull ${key(w)} burns`).toBe(node.hours[h]!.get(w.element)![2]);
    }
    // The strengths the view compared are the sim's, for every element of tanks it held.
    const now = new Map(got.after.map((e) => [e.id, e.strength]));
    for (const e of got.before) {
      if (turretOf(e.frame) < 0) continue;
      tanksHeld++;
      const sim = node.hours[h]!.get(e.id);
      expect(sim, `element ${e.id} of tanks in the sim, hour ${h + 1}`).toBeDefined();
      expect(sim![0]).toBe(e.strength);
      if (now.has(e.id)) expect(sim![1]).toBe(now.get(e.id));
      // An element that is gone leaves no hull: it left the view's box, or it left a wreck.
      else {
        expect(got.fresh.some((f) => f.element === e.id)).toBe(false);
        if (sim![1] === 0) endedInView++;
      }
    }
    hulls += got.fresh.length;
    if (got.fresh.length === 0) continue;
    expect(got.share).toBe(1);
    const [vw, vh] = got.size;
    const seen = got.fresh.filter((f) => Math.abs(f.x - got.cam.cx) * got.cam.scale < vw / 2 && Math.abs(f.y - got.cam.cy) * got.cam.scale < vh / 2);
    const visible = seen.map(key);
    inView += visible.length;
    burning += got.fresh.filter((f) => f.burns).length;
    burningInView += seen.filter((f) => f.burns).length;
    // Drawn: burning at once, smoking when the flame is out, nothing after its life.
    for (const k of visible) {
      expect(got.burning!.shown, `hull ${k}, burning`).toContain(k);
      expect(got.smoking!.shown, `hull ${k}, smoking`).toContain(k);
    }
    // A flame for each hull lost under fire, and for no other.
    expect(got.burning!.flames).toBe(got.burning!.alight);
    expect(got.burning!.flames).toBeGreaterThanOrEqual(seen.filter((f) => f.burns).length);
    expect(got.smoking!.flames).toBe(0);
    expect(got.gone).toEqual({ shown: [], flames: 0, alight: 0 });
    // No tank of the element stands on the hull, and the element has a figure for each tank left.
    for (const f of got.fresh) {
      const own = got.figures.filter((g) => g.id === f.element);
      expect(own.length, `figures of ${f.element}`).toBe(now.get(f.element));
      expect(f.cells).toBe(figureCells(gridSide(f.frame, 10)));
      for (const g of own) expect(Math.hypot(g.x - f.x, g.y - f.y), `a tank of ${f.element} on hull ${key(f)}`).toBeGreaterThan(f.cells / 2);
    }
  }
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: node.start + HOURS, hash: node.after });
  expect(underFire ? burning : hulls - burning).toBeGreaterThanOrEqual(3);
  expect(underFire ? burningInView : inView - burningInView).toBeGreaterThanOrEqual(1);
  console.log(`${underFire ? 'burning' : 'left behind'}: day ${(node.start / 24).toFixed(1)}, ${HOURS} h at (${node.x.toFixed(2)}, ${node.y.toFixed(2)}): ${hulls} hulls for ${hulls} tanks lost by elements the view held (${inView} in the viewport), ${burning} of them burning (${burningInView} in the viewport), ${hulls - burning} left behind; ${node.lost} lost ${underFire ? 'under fire' : 'without fire'} on that ground in the sim; ${tanksHeld} element-hours of tanks compared with the sim, ${endedInView} elements ended`);

  // Evidence: the frame loop stopped, the camera on the last hull of the kind that the view has
  // made, a second and a half after. The hulls of the hours before it are older on the same clock.
  const at = await page.evaluate((burns) => {
    const v = window.__warsim!.view!;
    v.dispose();
    const h = v.hulls.hulls.filter((h) => h.burns === burns).pop();
    return h ? { x: h.x, y: h.y, born: h.born } : null;
  }, underFire);
  expect(at, 'a hull of the kind still held at the end of the window').not.toBeNull();
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.6') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shoot = async (m: number, ms: number, name: string): Promise<void> => {
    const drawn = await page.evaluate(({ x, y, m, t }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      v.draw(t);
      return { shown: v.hulls.shown.length, flames: v.hulls.flames };
    }, { x: at!.x, y: at!.y, m, t: at!.born + ms });
    expect(drawn.shown, name).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(out, name) });
  };
  const name = underFire ? 'burning' : 'left-behind';
  await shoot(M_PER_PX, 1500, `${name}-4m.png`);
  await shoot(NEAR_M_PER_PX, 1500, `${name}-1.5m.png`);
  if (underFire) await shoot(NEAR_M_PER_PX, FLAME_MS + 3000, 'burning-1.5m-smoke.png');
}
