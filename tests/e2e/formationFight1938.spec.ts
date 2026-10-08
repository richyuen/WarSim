import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 3.11b (the critic's R3-B3: "the largest fight on the map is one division alone in
// view"): a formation in contact whose block stands a line or more behind its own side's front
// has no enemy in a close view of its block, and its panel led nowhere. On the critic's game
// (seed 4242, Germany against Poland by God Mode, day 21) 54 of the world's 151 formations in
// contact have no enemy element in a view of 8.4 by 4.8 km (6 m/px) on their block, all but
// two of them such rear lines, and 5 in the battle view's 28 by 16 km. The panel of a
// formation in contact now has a way to its fight: the camera flies to the middle between its
// block and the block of the enemy it faces, at a zoom of T3 that holds both.
//
// Every German and Polish formation in contact: the view goes to its block at 6 m/px, as the
// critic's did, its panel is opened and the button pressed.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = nation('GER');
const POL = nation('POL');
const VIEW = { width: 1400, height: 800 };

interface Seen {
  id: number;
  enemy: number;
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

test('the panel of a formation in contact leads to its fight: both sides on the screen at T3', async ({ page }, info) => {
  test.setTimeout(600_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=4242');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async ({ GER, POL }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
    let tick = 0;
    for (let d = 0; d < 21; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { GER, POL });

  // The two nations' formations in contact, as the panel has them, and the enemy each faces.
  const engaged = await page.evaluate(async (nations) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const out: { id: number; enemy: number; armour: boolean; km: number; fight: boolean }[] = [];
    for (const n of nations) {
      for (const id of view!.formationsOf(n)) {
        const d = await sim.formation(id);
        if (!d?.engaged) continue;
        out.push({ id, enemy: d.fight?.enemy ?? 0, armour: templates[d.template]?.symbol === 'armour', km: d.fight ? (Math.hypot(...d.fight.span) * view!.metresPerPx * view!.controller.cam.scale) / 1000 : -1, fight: d.fight !== null });
      }
    }
    return out;
  }, [GER, POL]);
  expect(engaged.length, 'German and Polish formations in contact on day 21').toBeGreaterThan(20);
  expect(engaged.every((e) => e.fight), 'every formation in contact has a fight to go to').toBe(true);

  /** The view on formation `id` at `m` metres a pixel, with the section of that zoom drawn. */
  const goTo = (id: number, m: number): Promise<void> =>
    page.evaluate(async ({ id, m }) => {
      const v = window.__warsim!.view!;
      const [x, y] = v.formationPos(id)!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { id, m });
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
    await page.getByTestId('formation-fight').click();
    await page.evaluate(async () => {
      const v = window.__warsim!.view!;
      const c = v.controller;
      const asked = performance.now();
      while (!c.animating) {
        if (performance.now() - asked > 20_000) throw new Error('no flight began');
        await new Promise((done) => setTimeout(done, 1));
      }
      while (c.animating) await new Promise((done) => requestAnimationFrame(done));
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / v.metresPerPx - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    });
  };

  const seen: Seen[] = [];
  for (const e of engaged) {
    await goTo(e.id, 6);
    const before = (await count(e.enemy)).on;
    await toFight(e.id);
    const own = await count(e.id);
    const foe = await count(e.enemy);
    const at = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, figures: window.__warsim!.view!.individualCount }));
    seen.push({ id: e.id, enemy: e.enemy, armour: e.armour, before, m: at.m, own: own.all, ownOn: own.on, foe: foe.all, foeOn: foe.on, figures: at.figures, km: e.km });
  }
  const blind = seen.filter((s) => s.before === 0);
  console.log(`seed 4242, day 21: ${seen.length} German and Polish formations in contact, ${seen.filter((s) => s.armour).length} of them armour; ${blind.length} with none of their enemy's elements on the screen at 6 m/px on their own block (${blind.map((s) => `${s.id}: ${s.km.toFixed(1)} km`).join(', ')}); after the way to the fight: ${Math.min(...seen.map((s) => s.m)).toFixed(1)} to ${Math.max(...seen.map((s) => s.m)).toFixed(1)} m/px, the blocks ${Math.min(...seen.map((s) => s.km)).toFixed(1)} to ${Math.max(...seen.map((s) => s.km)).toFixed(1)} km apart, own elements on the screen ${Math.min(...seen.map((s) => s.ownOn / s.own)).toFixed(2)} of them at least, the enemy's ${Math.min(...seen.map((s) => s.foeOn / s.foe)).toFixed(2)}`);
  // What the part is for: some of them had no enemy in the close view of their block.
  expect(blind.length, 'formations with no enemy element on the screen at 6 m/px on their block').toBeGreaterThan(0);
  for (const s of seen) {
    const what = `formation ${s.id}${s.armour ? ' (armour)' : ''} against ${s.enemy}, ${s.km.toFixed(1)} km off`;
    // T3: figures are drawn. No closer than the battle's own zoom.
    expect(s.m, `${what}: metres a pixel`).toBeLessThanOrEqual(30);
    expect(s.m, `${what}: metres a pixel`).toBeGreaterThanOrEqual(19.99);
    // Further out than the battle's zoom only where the two blocks stand too far apart for it.
    if (s.km < 5) expect(s.m, `${what}: metres a pixel`).toBeLessThan(20.01);
    expect(s.figures, `${what}: figures`).toBeGreaterThan(0);
    expect(s.own, `${what}: its elements in the section`).toBeGreaterThan(0);
    expect(s.foe, `${what}: the enemy's elements in the section`).toBeGreaterThan(0);
    // Both blocks, whole: every element of the two on the screen.
    expect(s.ownOn, `${what}: its elements on the screen`).toBe(s.own);
    expect(s.foeOn, `${what}: the enemy's elements on the screen`).toBe(s.foe);
  }

  // The formation in contact that stands furthest from the enemy it faces, of any nation on
  // the map: a cell off, the last of a column of lines. The view goes further out than the
  // battle's 20 m/px for it, and no further than T3.
  const furthest = await page.evaluate(async () => {
    const { sim, view } = window.__warsim!;
    let best = { id: 0, enemy: 0, km: 0 };
    for (const n of window.__warsim!.hud.stats.value!.nations) {
      for (const id of view!.formationsOf(n.id)) {
        const d = await sim.formation(id);
        if (!d?.fight) continue;
        const km = (Math.hypot(...d.fight.span) * view!.metresPerPx * view!.controller.cam.scale) / 1000;
        if (km > best.km) best = { id, enemy: d.fight.enemy, km };
      }
    }
    return best;
  });
  expect(furthest.km, 'km from the furthest block to the block it faces').toBeGreaterThan(14);
  await goTo(furthest.id, 6);
  await toFight(furthest.id);
  const farOwn = await count(furthest.id);
  const farFoe = await count(furthest.enemy);
  const farAt = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, figures: window.__warsim!.view!.individualCount }));
  console.log(`the furthest: formation ${furthest.id}, ${furthest.km.toFixed(1)} km from the block of ${furthest.enemy}; the view at ${farAt.m.toFixed(1)} m/px, ${farOwn.on} of its ${farOwn.all} elements and ${farFoe.on} of the enemy's ${farFoe.all} on the screen`);
  expect(farAt.m).toBeGreaterThan(20.5);
  expect(farAt.m).toBeLessThanOrEqual(30);
  expect(farAt.figures).toBeGreaterThan(0);
  expect(farOwn.all).toBeGreaterThan(0);
  expect(farFoe.all).toBeGreaterThan(0);
  expect(farOwn.on, 'its elements on the screen').toBe(farOwn.all);
  expect(farFoe.on, 'the elements of the enemy on the screen').toBe(farFoe.all);
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'b-furthest-at-its-fight.png') });

  // A small view (700 by 500) has a battle at T2, 40 m/px: the two blocks 20 km apart do not
  // fit it, and the view goes further out for them.
  await page.setViewportSize({ width: 700, height: 500 });
  await goTo(furthest.id, 6);
  await toFight(furthest.id);
  const smallOwn = await count(furthest.id);
  const smallFoe = await count(furthest.enemy);
  const smallM = await page.evaluate(() => window.__warsim!.view!.metresPerPx);
  console.log(`in a view of 700 by 500: ${smallM.toFixed(1)} m/px, ${smallOwn.on} of ${smallOwn.all} and ${smallFoe.on} of ${smallFoe.all} on the screen`);
  expect(smallM).toBeGreaterThan(40.5);
  expect(smallM).toBeLessThan(250);
  expect(smallOwn.all).toBeGreaterThan(0);
  expect(smallFoe.all).toBeGreaterThan(0);
  expect(smallOwn.on, 'its elements on the small screen').toBe(smallOwn.all);
  expect(smallFoe.on, 'the elements of the enemy on the small screen').toBe(smallFoe.all);
  await page.setViewportSize(VIEW);

  // The pictures: the German or Polish formation furthest from the enemy it faces, at 6 m/px on its block (no
  // enemy), its panel with the button, and where the button takes the view.
  const rear = seen.reduce((a, b) => (b.km > a.km ? b : a));
  await goTo(rear.id, 6);
  await page.evaluate((id) => {
    window.__warsim!.hud.selectFormation(0);
    window.__warsim!.hud.selectFormation(id);
  }, rear.id);
  await expect(page.getByTestId('formation-fight')).toBeVisible({ timeout: 20_000 });
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'b-rear-line-at-its-block-6m.png') });
  await page.getByTestId('formation-panel').screenshot({ path: path.join(out, 'b-panel-to-its-fight.png') });
  await toFight(rear.id);
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'b-rear-line-at-its-fight.png') });
});
