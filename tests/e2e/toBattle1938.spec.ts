import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.14e (the critic's R2-B2, "nothing leads to a battle"): at T2 a division is a 30 px grid
// in a view of 1,600 px and most T3 views are empty ground, and there was no way from a war's
// banner to where the fighting is. A click on the banner now brings the war's largest battle
// into view, at a zoom that shows both sides' elements (and selects the attackers' leader, as
// it did). The camera flies there (PLAN 2.14f5b4).
//
// Germany against Poland by God Mode, a German and a Polish infantry division a cell apart
// across their border, a day of it. The camera is on the whole world when the banner is clicked.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const GER = nation('GER');
const POL = nation('POL');
const BRA = nation('BRA');
const MEX = nation('MEX');
const VIEW = { width: 1400, height: 800 };

/** A German cell with a Polish one east of it, where the order of battle has fewest formations near: the point between the two cells' middles. */
function border(): readonly [number, number] {
  const w = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) }).world;
  const { owner, w: cw, h: ch } = w.cells;
  const fc = w.formations.cols;
  const forms = w.formations.ids().map((f) => [fc.x[f]!, fc.y[f]!] as const);
  let best: [number, number] | null = null;
  let fewest = Infinity;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 2; x++) {
      if (owner[y * cw + x] !== GER || owner[y * cw + x + 1] !== POL) continue;
      const near = forms.filter(([fx, fy]) => Math.hypot(fx - (x + 1), fy - (y + 0.5)) < 3).length;
      if (near < fewest) {
        fewest = near;
        best = [x + 1, y + 0.5];
      }
    }
  }
  if (!best) throw new Error('no German cell with a Polish one east of it');
  return best;
}

async function step(page: Page, cmds: Command[], hours = 1): Promise<void> {
  await page.evaluate(async ({ cmds, hours }) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(hours)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { cmds, hours });
}

test('a click on a war\'s banner brings its largest battle into view', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const SITE = border();
  await step(page, [
    { kind: 'setSetting', key: 'aiEnabled', value: false },
    { kind: 'declareWar', attacker: GER, defender: POL },
    // A war with no battle: its two sides have a sea and a continent between them (PLAN 2.14f5b3).
    { kind: 'declareWar', attacker: BRA, defender: MEX },
    { kind: 'spawnFormation', nation: GER, x: SITE[0] - 0.5, y: SITE[1], strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: POL, x: SITE[0] + 0.5, y: SITE[1], strength: 0, template: infantry },
  ]);
  await step(page, [], 24);

  // The whole world in the view: counters, no elements.
  const start = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    return { m: v.metresPerPx, elements: v.elementCount, cam: { ...v.controller.cam } };
  });
  expect(start.m).toBeGreaterThan(5_000);
  expect(start.elements).toBe(0);

  const war = await page.evaluate(async ({ ger, pol }) => (await window.__warsim!.sim.inspect()).wars.find((w) => w.attackers.includes(ger) && w.defenders.includes(pol))!.id, { ger: GER, pol: POL });
  const banner = page.locator(`[data-testid="war-banner"][data-war="${war}"]`);
  await expect(banner).toHaveCount(1, { timeout: 20_000 });

  // PLAN 2.14f5b3 (ADR-96): the banner says whether there is a battle to go to. Brazil against
  // Mexico has none: its swords are dim, its tooltip says so, and the click selects the leader
  // and leaves the camera where it is. Germany against Poland has one.
  const quietWar = await page.evaluate(async ({ a, d }) => (await window.__warsim!.sim.inspect()).wars.find((w) => w.attackers.includes(a) && w.defenders.includes(d))!, { a: BRA, d: MEX });
  expect(quietWar.battle).toBe(false);
  expect(await page.evaluate((id) => window.__warsim!.sim.warBattle(id), quietWar.id)).toBeNull();
  const quiet = page.locator(`[data-testid="war-banner"][data-war="${quietWar.id}"]`);
  await expect(quiet).toHaveAttribute('data-battle', '0', { timeout: 20_000 });
  await expect(banner).toHaveAttribute('data-battle', '1', { timeout: 20_000 });
  await expect(quiet).toHaveAttribute('title', /No battle now/);
  await expect(banner).toHaveAttribute('title', /to its largest battle/);
  const swords = (b: typeof banner): Promise<{ color: string; opacity: string }> => b.locator('.war-swords').evaluate((e) => ({ color: getComputedStyle(e).color, opacity: getComputedStyle(e).opacity }));
  expect(await swords(banner)).toEqual({ color: 'rgb(233, 196, 106)', opacity: '1' });
  expect(Number((await swords(quiet)).opacity)).toBeLessThan(0.5);
  await page.getByTestId('war-banners').screenshot({ path: path.join(out, 'to-battle-banners.png') });
  await quiet.click();
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(BRA));
  await settle(page);
  expect(await page.evaluate(() => ({ ...window.__warsim!.view!.controller.cam }))).toEqual(start.cam);

  await banner.click();

  // PLAN 2.14f5b4 (ADR-97): the camera flies there. Every frame of the view's own loop from the
  // flight's first to its last: the zoom only grows, and there are frames on the way.
  const flown = await page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const c = v.controller;
    const asked = performance.now();
    while (!c.animating) {
      if (performance.now() - asked > 20_000) throw new Error('no flight began');
      await new Promise((done) => setTimeout(done, 1));
    }
    const began = performance.now();
    const m: number[] = [];
    await new Promise<void>((done) => {
      const frame = (): void => {
        m.push(v.metresPerPx);
        if (c.animating) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
    return { m, ms: performance.now() - began };
  });
  const between = flown.m.filter((m) => m < start.m / 2 && m > 40).length;
  console.log(`the flight: ${flown.m.length} frames in ${flown.ms.toFixed(0)} ms, ${between} of them between ${(start.m / 2).toFixed(0)} and 40 m/px`);
  expect(flown.ms).toBeGreaterThan(1000);
  expect(between, 'frames on the way').toBeGreaterThanOrEqual(3);
  for (let i = 1; i < flown.m.length; i++) expect(flown.m[i]!, `frame ${i}`).toBeLessThanOrEqual(flown.m[i - 1]! * (1 + 1e-9));

  // The camera goes to the battle, at a zoom of the elements' tiers; the elements arrive with the next snapshot.
  await page.waitForFunction((m0) => window.__warsim!.view!.metresPerPx < m0 / 10, start.m, { timeout: 20_000 });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.elementCount > 0 && Math.abs(v.elementsZoom / v.metresPerPx - 1) < 0.01;
  }, null, { timeout: 20_000 });
  await settle(page);

  const seen = await page.evaluate(async ({ war, ger, pol }) => {
    const v = window.__warsim!.view!;
    const battle = (await window.__warsim!.sim.warBattle(war))!;
    const cam = v.controller.cam;
    const side = (id: number): { all: number; on: number; engaged: number } => {
      const s = { all: 0, on: 0, engaged: 0 };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        s.all++;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
        if ((v.elementFlags[i]! & 2) !== 0) s.engaged++;
      }
      return s;
    };
    return {
      battle,
      m: v.metresPerPx,
      cam: { ...cam },
      a: side(battle.formations[0]),
      b: side(battle.formations[1]),
      nations: [v.formationsOf(ger).includes(battle.formations[0]), v.formationsOf(pol).includes(battle.formations[1])],
      tags: v.tagRects.filter((t) => t.id === battle.formations[0] || t.id === battle.formations[1]).length,
      selected: window.__warsim!.hud.selected.value,
    };
  }, { war, ger: GER, pol: POL });

  // The battle is the war's: an attacker's formation and a defender's, with men on both sides.
  expect(seen.battle.war).toBe(war);
  expect(seen.nations).toEqual([true, true]);
  expect(seen.battle.count[0]).toBeGreaterThan(0);
  expect(seen.battle.count[1]).toBeGreaterThan(0);
  expect(seen.battle.men[0]).toBeGreaterThan(5_000);
  expect(seen.battle.men[1]).toBeGreaterThan(5_000);
  // The camera is on it, at a zoom that shows elements: no closer than 20 m/px (a view of 28 by 16 km), within T2.
  expect(seen.cam.cx).toBeCloseTo(seen.battle.x, 6);
  expect(seen.cam.cy).toBeCloseTo(seen.battle.y, 6);
  expect(seen.m).toBeGreaterThanOrEqual(19.99);
  expect(seen.m).toBeLessThan(250);
  // Elements of both sides, in contact, on the screen: all of each of the two formations.
  expect(seen.a.all).toBeGreaterThan(20);
  expect(seen.b.all).toBeGreaterThan(20);
  expect(seen.a.on, 'elements of the attackers\' formation on the screen').toBe(seen.a.all);
  expect(seen.b.on, 'elements of the defenders\' formation on the screen').toBe(seen.b.all);
  expect(seen.a.engaged).toBe(seen.a.all);
  expect(seen.b.engaged).toBe(seen.b.all);
  expect(seen.tags).toBe(2);
  // The click still selects the attackers' leader (PLAN 1.31b).
  expect(seen.selected).toBe(GER);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(GER));

  console.log(`banner of war ${war}: to (${seen.battle.x.toFixed(2)}, ${seen.battle.y.toFixed(2)}) at ${seen.m.toFixed(1)} m/px; the battle has ${seen.battle.count[0]} + ${seen.battle.count[1]} formations, ${seen.battle.men[0]} + ${seen.battle.men[1]} men; ${seen.a.on} and ${seen.b.on} elements of the two in the middle on the screen`);
  await page.screenshot({ path: path.join(out, 'to-battle.png') });

  // A key of the camera's ends the flight where it is: the user has the camera, and it does not go on to the battle.
  await page.evaluate((cam) => window.__warsim!.view!.controller.set(cam), start.cam);
  await banner.click();
  await page.waitForFunction((m0) => window.__warsim!.view!.controller.animating && window.__warsim!.view!.metresPerPx < m0 / 2, start.m, { timeout: 20_000 });
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 5_000 });
  const taken = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, cam: { ...window.__warsim!.view!.controller.cam } }));
  await page.waitForTimeout(500);
  const later = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, cam: { ...window.__warsim!.view!.controller.cam } }));
  expect(taken.m, 'the flight ended on the way').toBeGreaterThan(100);
  expect(taken.m).toBeLessThan(start.m / 2);
  expect(later).toEqual(taken);
});

// PLAN 2.14f5a: the same click on a real front. No division is put down: the armies of the start
// fight for 60 days (Germany against Poland by God Mode, the AI running). In the test above the
// largest battle is the one pair there is. Here it is one of many, and the two formations the
// click leads to are chosen by the sim (`largestBattle`: each other's nearest enemy, then the leaders', then men).
test('after 60 days of Germany against Poland the banner leads to two formations front to front', async ({ page }, info) => {
  test.setTimeout(300_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=99');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await step(page, [{ kind: 'declareWar', attacker: GER, defender: POL }]);
  for (let day = 0; day < 60; day += 10) await step(page, [], day === 0 ? 239 : 240);

  const start = await page.evaluate(() => ({ m: window.__warsim!.view!.metresPerPx, elements: window.__warsim!.view!.elementCount }));
  expect(start.m).toBeGreaterThan(5_000);
  expect(start.elements).toBe(0);
  const war = await page.evaluate(async ({ ger, pol }) => (await window.__warsim!.sim.inspect()).wars.find((w) => w.attackers.includes(ger) && w.defenders.includes(pol))!.id, { ger: GER, pol: POL });
  const banner = page.locator(`[data-testid="war-banner"][data-war="${war}"]`);
  await expect(banner).toHaveCount(1, { timeout: 20_000 });
  // Every banner shown says what its click would find (PLAN 2.14f5b3): lit with a battle, dim without.
  await expect.poll(async () => page.evaluate(async () => {
    const wrong: string[] = [];
    let lit = 0;
    for (const b of document.querySelectorAll<HTMLElement>('[data-testid="war-banner"]')) {
      const has = (await window.__warsim!.sim.warBattle(Number(b.dataset['war']))) !== null;
      if (has) lit++;
      if ((b.dataset['battle'] === '1') !== has) wrong.push(b.dataset['war']!);
    }
    return { wrong, banners: document.querySelectorAll('[data-testid="war-banner"]').length, some: lit > 0 };
  }), { timeout: 20_000 }).toEqual({ wrong: [], banners: 8, some: true });
  const lit = await page.locator('[data-testid="war-banner"][data-battle="1"]').count();
  console.log(`day 60: ${lit} of 8 banners have a battle`);
  await banner.click();
  await page.waitForFunction((m0) => window.__warsim!.view!.metresPerPx < m0 / 10, start.m, { timeout: 20_000 });
  // A flight (PLAN 2.14f5b4): what follows is asked of where it ends.
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 20_000 });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.elementCount > 0 && Math.abs(v.elementsZoom / v.metresPerPx - 1) < 0.01;
  }, null, { timeout: 20_000 });
  await settle(page);

  const seen = await page.evaluate(async ({ war, ger, pol }) => {
    const v = window.__warsim!.view!;
    const battle = (await window.__warsim!.sim.warBattle(war))!;
    const cam = v.controller.cam;
    const side = (id: number): { all: number; on: number; engaged: number; x: number; y: number } => {
      const s = { all: 0, on: 0, engaged: 0, x: 0, y: 0 };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        s.all++;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        s.x += px;
        s.y += py;
        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
        if ((v.elementFlags[i]! & 2) !== 0) s.engaged++;
      }
      s.x /= Math.max(1, s.all);
      s.y /= Math.max(1, s.all);
      return s;
    };
    // Every formation with an element on the screen, by whether it is one of the two.
    const others = new Set<number>();
    for (let i = 0; i < v.elementCount; i++) {
      const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
      const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
      if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) others.add(v.elementFormation[i]!);
    }
    return {
      battle,
      m: v.metresPerPx,
      cam: { ...cam },
      a: side(battle.formations[0]),
      b: side(battle.formations[1]),
      formationsOnScreen: others.size,
      tags: v.tagRects.filter((t) => t.id === battle.formations[0] || t.id === battle.formations[1]).length,
      leaders: [v.formationsOf(ger).includes(battle.formations[0]), v.formationsOf(pol).includes(battle.formations[1])],
    };
  }, { war, ger: GER, pol: POL });

  expect(seen.battle.war).toBe(war);
  // A battle of the front, not a pair: more than two formations in it.
  expect(seen.battle.count[0] + seen.battle.count[1]).toBeGreaterThan(2);
  // And one of two sides (ADR-94): by the men of both it was 67,984 against 472 on this day.
  expect(Math.min(...seen.battle.men) * 10).toBeGreaterThan(Math.max(...seen.battle.men));
  // And of the two the banner names (ADR-95): a German formation and a Polish one, not their allies'.
  expect(seen.leaders).toEqual([true, true]);
  expect(seen.cam.cx).toBeCloseTo(seen.battle.x, 6);
  expect(seen.cam.cy).toBeCloseTo(seen.battle.y, 6);
  expect(seen.m).toBeCloseTo(20, 1);
  // Both of the two, whole and in contact, on the screen; their blocks' middles within 6 km (300 px).
  expect(seen.a.all).toBeGreaterThan(0);
  expect(seen.b.all).toBeGreaterThan(0);
  expect(seen.a.on, 'elements of the attackers\' formation on the screen').toBe(seen.a.all);
  expect(seen.b.on, 'elements of the defenders\' formation on the screen').toBe(seen.b.all);
  expect(seen.a.engaged).toBe(seen.a.all);
  expect(seen.b.engaged).toBe(seen.b.all);
  const apart = Math.hypot(seen.a.x - seen.b.x, seen.a.y - seen.b.y);
  expect(apart).toBeLessThan(300);
  expect(seen.tags).toBe(2);

  console.log(`day 60, banner of war ${war}: to (${seen.battle.x.toFixed(2)}, ${seen.battle.y.toFixed(2)}) at ${seen.m.toFixed(1)} m/px; the battle has ${seen.battle.count[0]} + ${seen.battle.count[1]} formations, ${seen.battle.men[0]} + ${seen.battle.men[1]} men; formations ${seen.battle.formations.join(' and ')}: ${seen.a.on} of ${seen.a.all} and ${seen.b.on} of ${seen.b.all} elements on the screen, the blocks' middles ${apart.toFixed(0)} px apart; ${seen.formationsOnScreen} formations have elements on the screen`);
  await page.screenshot({ path: path.join(out, 'to-battle-front.png') });
});
