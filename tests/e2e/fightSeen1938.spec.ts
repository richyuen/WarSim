import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 3.11 (the critic's R3-B3: "zooming to a formation in contact shows its fight"), the
// task's own test, on a game no part of it was built on: seed 5381. Two wars of it: one nobody
// declared (Japan and its puppets against China, at war from the first day of 1938: infantry
// alone), and the critic's (Germany against Poland by God Mode: armour among them).
// After three weeks: the panel of each of their formations in contact leads to a view at T3
// with its elements and its enemy's; and a day watched on one fight leaves a mark (the fallen,
// a gun, a hull) where strength was lost.

const SEED = 5381;
const DAYS = 21;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
interface War {
  name: string;
  /** The file names of its pictures begin with it. */
  file: string;
  sides: number[];
  /** Declared by God Mode on the first day, or a war of the scenario's start. */
  declare: [number, number] | null;
  /** The fight watched for a day: of an armour formation, or any. */
  armour: boolean;
}
const WARS: War[] = [
  { name: 'Japan\'s war on China', file: 'f3-china', sides: ['JAP', 'MAN', 'MEN', 'CHI'].map(nation), declare: null, armour: false },
  { name: 'Germany\'s war on Poland', file: 'f3-poland', sides: ['GER', 'POL'].map(nation), declare: [nation('GER'), nation('POL')], armour: true },
];
const VIEW = { width: 1400, height: 800 };
const HOURS = 24;

interface Seen {
  id: number;
  enemy: number;
  nation: number;
  armour: boolean;
  /** The enemy's elements on the screen at 6 m/px on its own block, before the click. */
  before: number;
  /** After the flight: metres a pixel, its own elements and the enemy's (all, and on the screen), figures drawn, km between the two blocks. */
  m: number;
  own: number;
  ownOn: number;
  foe: number;
  foeOn: number;
  figures: number;
  km: number;
}

for (const war of WARS) test(`PLAN 3.11 on a seed not used: every formation in contact of ${war.name} is seen with its enemy at T3, and a day of a fight leaves its marks`, async ({ page }, info) => {
  test.setTimeout(900_000);
  const SIDES = war.sides;
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  for (const n of SIDES) expect(n, 'the nations of the war are in the scenario').toBeGreaterThan(0);
  await page.setViewportSize(VIEW);
  await page.goto(`/?scenario=1938&paused=1&seed=${SEED}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const start = await page.evaluate(async ({ days, declare }) => {
    const sim = window.__warsim!.sim;
    if (declare) sim.command({ kind: 'declareWar', attacker: declare[0], defender: declare[1] });
    let tick = 0;
    for (let d = 0; d < days; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    return tick;
  }, { days: DAYS, declare: war.declare });

  // The formations in contact of the war's nations, as the panel has them, and the enemy each faces.
  const engaged = await page.evaluate(async (nations) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const out: { id: number; nation: number; enemy: number; armour: boolean; km: number; fight: boolean; at: [number, number] | null }[] = [];
    for (const n of nations) {
      for (const id of view!.formationsOf(n)) {
        const d = await sim.formation(id);
        if (!d?.engaged) continue;
        out.push({ id, nation: n, enemy: d.fight?.enemy ?? 0, armour: templates[d.template]?.symbol === 'armour', km: d.fight ? (Math.hypot(...d.fight.span) * view!.metresPerPx * view!.controller.cam.scale) / 1000 : -1, fight: d.fight !== null, at: d.fight ? [d.fight.x, d.fight.y] : null });
      }
    }
    return out;
  }, SIDES);
  expect(engaged.length, `formations in contact of ${war.name} on day ${DAYS}`).toBeGreaterThanOrEqual(10);
  expect(new Set(engaged.map((e) => e.nation)).size, 'nations of the war with a formation in contact').toBeGreaterThanOrEqual(2);
  expect(engaged.every((e) => e.fight), 'every formation in contact has a fight to go to').toBe(true);

  /** The view on (x, y) at `m` metres a pixel, with the section of that zoom drawn. */
  const lookAt = (x: number, y: number, m: number): Promise<void> =>
    page.evaluate(async ({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { x, y, m });
  const goTo = async (id: number, m: number): Promise<void> => {
    const [x, y] = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), id))!;
    await lookAt(x, y, m);
  };
  /** Elements of formation `id` in the section, and those of them on the screen. */
  const count = (id: number): Promise<{ all: number; on: number }> =>
    page.evaluate((id) => {
      const v = window.__warsim!.view!;
      const cam = v.controller.cam;
      const s = { all: 0, on: 0 };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        s.all++;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
      }
      return s;
    }, id);
  /** Opens the panel of `id` and presses its way to the fight; returns when the flight is over and the section of its zoom is drawn. */
  const toFight = async (id: number): Promise<void> => {
    await page.evaluate((id) => {
      window.__warsim!.hud.selectFormation(0);
      window.__warsim!.hud.selectFormation(id);
    }, id);
    await expect(page.getByTestId('formation-panel')).toHaveAttribute('data-formation', String(id), { timeout: 20_000 });
    await expect(page.getByTestId('formation-status')).toHaveText('In contact');
    // Where the camera is before the press: the flight can be over before the wait for it
    // begins (a long frame ends it in one step; the press takes its time to come back), and is
    // then known by where it ended.
    const from = await page.evaluate(() => ({ ...window.__warsim!.view!.controller.cam }));
    await page.getByTestId('formation-fight').click();
    await page.evaluate(async (from) => {
      const v = window.__warsim!.view!;
      const c = v.controller;
      const asked = performance.now();
      while (!c.animating && c.cam.cx === from.cx && c.cam.cy === from.cy && c.cam.scale === from.scale) {
        if (performance.now() - asked > 20_000) throw new Error('no flight began');
        await new Promise((done) => setTimeout(done, 1));
      }
      while (c.animating) await new Promise((done) => requestAnimationFrame(done));
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / v.metresPerPx - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, from);
  };

  const seen: Seen[] = [];
  for (const e of engaged) {
    await goTo(e.id, 6);
    const before = (await count(e.enemy)).on;
    await toFight(e.id);
    const own = await count(e.id);
    const foe = await count(e.enemy);
    const at = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, figures: window.__warsim!.view!.individualCount }));
    seen.push({ id: e.id, enemy: e.enemy, nation: e.nation, armour: e.armour, before, m: at.m, own: own.all, ownOn: own.on, foe: foe.all, foeOn: foe.on, figures: at.figures, km: e.km });
  }
  const blind = seen.filter((s) => s.before === 0);
  info.annotations.push({ type: 'fights', description: `seed ${SEED}, day ${DAYS}: ${seen.length} formations in contact of ${new Set(seen.map((s) => s.nation)).size} nations of ${war.name}, ${seen.filter((s) => s.armour).length} of them armour; ${blind.length} with none of their enemy's elements on the screen at 6 m/px on their own block; after the way to the fight: ${Math.min(...seen.map((s) => s.m)).toFixed(1)} to ${Math.max(...seen.map((s) => s.m)).toFixed(1)} m/px, the blocks ${Math.min(...seen.map((s) => s.km)).toFixed(1)} to ${Math.max(...seen.map((s) => s.km)).toFixed(1)} km apart, own elements on the screen ${Math.min(...seen.map((s) => s.ownOn / s.own)).toFixed(2)} of them at least, the enemy's ${Math.min(...seen.map((s) => s.foeOn / s.foe)).toFixed(2)}` });
  console.log(info.annotations.at(-1)!.description);
  for (const s of seen) {
    const what = `formation ${s.id}${s.armour ? ' (armour)' : ''} against ${s.enemy}, ${s.km.toFixed(1)} km off`;
    // T3: figures are drawn. No closer than the battle's own zoom.
    expect(s.m, `${what}: metres a pixel`).toBeLessThanOrEqual(30);
    expect(s.m, `${what}: metres a pixel`).toBeGreaterThanOrEqual(19.99);
    expect(s.figures, `${what}: figures`).toBeGreaterThan(0);
    expect(s.own, `${what}: its elements in the section`).toBeGreaterThan(0);
    expect(s.foe, `${what}: the enemy's elements in the section`).toBeGreaterThan(0);
    // Both blocks, whole: every element of the two on the screen.
    expect(s.ownOn, `${what}: its elements on the screen`).toBe(s.own);
    expect(s.foeOn, `${what}: the enemy's elements on the screen`).toBe(s.foe);
  }

  // The pictures, and the day: the fight whose two blocks stand nearest each other (of an armour formation's, in the war that has them).
  const of = war.armour ? seen.filter((s) => s.armour) : seen;
  expect(of.length, war.armour ? 'armour formations in contact' : 'formations in contact').toBeGreaterThan(0);
  const near = of.reduce((a, b) => (b.km < a.km ? b : a));
  const [fx, fy] = engaged.find((e) => e.id === near.id)!.at!;
  await page.evaluate(() => window.__warsim!.hud.selectFormation(0));
  await lookAt(fx, fy, 80);
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  expect(await page.evaluate(() => window.__warsim!.view!.subscription?.tier), 'the tier at 80 m/px').toBe(2);
  await page.screenshot({ path: path.join(out, `${war.file}-a-fight-t2-80m.png`) });
  await lookAt(fx, fy, 20);
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, `${war.file}-a-fight-t3-20m.png`) });
  await lookAt(fx, fy, 6);
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.individualCount > 0;
  }, null, { timeout: 15_000 });
  expect((await count(near.id)).on, 'its elements on the screen at 6 m/px on the fight').toBeGreaterThan(0);
  expect((await count(near.enemy)).on, 'the enemy\'s elements on the screen at 6 m/px on the fight').toBeGreaterThan(0);
  // Elements first seen: no mark, whatever they lost in the weeks before.
  expect(await page.evaluate(() => window.__warsim!.view!.hulls.fallen.length + window.__warsim!.view!.hulls.hulls.length)).toBe(0);

  /** Steps one hour: the strength the view's elements lost in it, the marks it brought, and those of them drawn while they lie. */
  const hour = (tick: number) => page.evaluate(async (tick) => {
    const v = window.__warsim!.view!;
    const strengths = (): Map<number, number> => new Map(Array.from(v.elementId, (id, i) => [id, v.elementStrength[i]!]));
    const before = strengths();
    const had = new Set<object>([...v.hulls.fallen, ...v.hulls.hulls]);
    await window.__warsim!.sim.step(1);
    await new Promise<void>((done) => {
      const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    const after = strengths();
    let lost = 0;
    for (const [id, s] of before) if (after.has(id)) lost += Math.max(0, s - after.get(id)!);
    const fresh = [...v.hulls.fallen, ...v.hulls.hulls].filter((m) => !had.has(m));
    let lying = 0;
    if (fresh.length > 0) {
      v.drawUnitLayers(fresh[0]!.born + 100);
      lying = [...v.hulls.fallenShown, ...v.hulls.shown].filter((m) => fresh.includes(m)).length;
    }
    // The frame the page goes on with is of now.
    v.drawUnitLayers(performance.now());
    const c = document.querySelector('canvas')!;
    const cam = v.controller.cam;
    const inView = fresh.filter((m) => Math.abs(m.x - cam.cx) * cam.scale < c.clientWidth / 2 && Math.abs(m.y - cam.cy) * cam.scale < c.clientHeight / 2);
    return { lost, fresh: fresh.length, hulls: fresh.filter((m) => v.hulls.hulls.includes(m as never)).length, inView: inView.map((m) => ({ x: m.x, y: m.y })), lying, share: v.shares.individuals };
  }, tick);

  let [lost, marks, hulls, inView, firstLoss, firstMark] = [0, 0, 0, 0, -1, -1];
  let shot = false;
  for (let h = 0; h < HOURS; h++) {
    const got = await hour(start + h + 1);
    expect(got.share).toBe(1);
    lost += got.lost;
    marks += got.fresh;
    hulls += got.hulls;
    inView += got.inView.length;
    if (firstLoss < 0 && got.lost > 0) firstLoss = h + 1;
    if (firstMark < 0 && got.fresh > 0) firstMark = h + 1;
    // Drawn while it lies: those in the view at least.
    expect(got.lying, `marks of hour ${h + 1} drawn`).toBeGreaterThanOrEqual(got.inView.length);
    if (!shot && got.inView.length >= 2) {
      shot = true;
      await page.screenshot({ path: path.join(out, `${war.file}-a-fight-and-its-marks-6m.png`) });
      const about = (m: { x: number; y: number }): number => got.inView.filter((o) => Math.hypot(o.x - m.x, o.y - m.y) < 0.02).length;
      const mid = got.inView.reduce((best, m) => (about(m) > about(best) ? m : best));
      await lookAt(mid.x, mid.y, 2);
      expect(await page.evaluate(() => window.__warsim!.view!.hulls.fallenShown.length + window.__warsim!.view!.hulls.shown.length), 'marks drawn at 2 m/px').toBeGreaterThanOrEqual(1);
      await page.screenshot({ path: path.join(out, `${war.file}-a-fight-and-its-marks-2m.png`) });
      await lookAt(fx, fy, 6);
    }
  }
  info.annotations.push({ type: 'marks', description: `day ${DAYS + 1} at 6 m/px on the fight of formation ${near.id}${near.armour ? ' (armour)' : ''} against ${near.enemy} (${near.km.toFixed(1)} km apart): the elements the view held lost ${Math.round(lost)} of strength, the first in hour ${firstLoss}; ${marks} marks (${hulls} of them hulls), ${inView} in the view, the first in hour ${firstMark}` });
  console.log(info.annotations.at(-1)!.description);
  // The critic's bar: a fight that costs strength has a mark within the day.
  expect(lost, 'strength lost in the day by the elements in the view').toBeGreaterThan(0);
  expect(firstMark, 'the hour of the first mark').toBeGreaterThan(0);
  expect(inView, 'marks in the view in the day').toBeGreaterThanOrEqual(1);
  expect(shot, 'an hour with two marks in the view, for the pictures').toBe(true);
});
