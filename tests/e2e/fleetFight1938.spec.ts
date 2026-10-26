import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { Domain } from '../../src/sim/world';
import { settle } from './settle';

// PLAN 7.126 (found by `check:review` before critic run 15): the panel of a fleet in a sea battle
// read "In contact" with no way to its fight (seed 5381, Germany on Poland by God Mode, fleet 1199
// on day 22): the worker's `enemyOf` paired land formations alone. A fleet's fight is now the
// nearest enemy fleet of its battle, and the panel's button frames the two fleets' ships as a sea
// battle's row does (`MapView.showSeaBattle`, clear of the panels at the view's sides).
//
// From day 21, the first German or Polish fleet in contact (the scene is found, not a day pinned:
// a day picked by hand breaks at each AI rule); its panel's button, and after the flight every
// ship element of it and of the enemy fleet it fights on the screen.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = nation('GER');
const POL = nation('POL');
const SEED = 5381;
const VIEW = { width: 1400, height: 800 };
const DAYS = 21;
/** Hours past day 21 within which a fleet of the two in contact is looked for. */
const LATER = 24 * 14;

test('the panel of a fleet in a sea battle leads to its fight: both fleets\' ships on the screen', async ({ page }, info) => {
  test.setTimeout(600_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/7.126') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto(`/?scenario=1938&paused=1&seed=${SEED}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  /** Steps `hours` hours (declaring the war first, when `declare`) and waits for the view to have the last of them. */
  const step = (hours: number, declare: boolean): Promise<void> => page.evaluate(async ({ GER, POL, hours, declare }) => {
    const sim = window.__warsim!.sim;
    if (declare) sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
    let tick = 0;
    for (let left = hours; left > 0; left -= 24) tick = (await sim.step(Math.min(24, left))).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { GER, POL, hours, declare });
  /** The two nations' fleets in contact, as their panels have them: the enemy fleet each fights, 0 for none. */
  const fleets = () => page.evaluate(async ({ nations, sea }) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const out: { id: number; enemy: number; sea: boolean }[] = [];
    for (const n of nations) {
      for (const id of view!.formationsOf(n)) {
        const d = await sim.formation(id);
        if (d?.engaged && templates[d.template]?.domain === sea) out.push({ id, enemy: d.fight?.enemy ?? 0, sea: d.fight?.sea ?? false });
      }
    }
    return out;
  }, { nations: [GER, POL], sea: Domain.sea });
  await step(24 * DAYS, true);
  let hours = 0;
  let engaged = await fleets();
  while (engaged.length === 0 && hours < LATER) {
    await step(1, false);
    hours++;
    engaged = await fleets();
  }
  expect(engaged.length, `German and Polish fleets in contact by hour ${hours} past day ${DAYS}`).toBeGreaterThan(0);
  expect(engaged.filter((e) => e.enemy === 0 || !e.sea).map((e) => e.id), 'fleets in contact with no fight at sea').toEqual([]);
  const fleet = engaged[0]!;

  /** Ship elements of fleet `id` in the section, those on the screen, and those under a panel at the view's side. */
  const count = (id: number): Promise<{ all: number; on: number; under: number }> =>
    page.evaluate((id) => {
      const v = window.__warsim!.view!;
      const cam = v.controller.cam;
      const at = document.querySelector('canvas')!.getBoundingClientRect();
      const panels = v.sidePanels();
      const s = { all: 0, on: 0, under: 0 };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        s.all++;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
        if (panels.some((p) => px + at.left >= p.x && px + at.left <= p.x + p.w && py + at.top >= p.y && py + at.top <= p.y + p.h)) s.under++;
      }
      return s;
    }, id);

  // The view on the fleet at the world's zoom, its panel opened, and the button pressed.
  await page.evaluate((id) => {
    const v = window.__warsim!.view!;
    const [x, y] = v.formationPos(id)!;
    v.controller.set({ cx: x, cy: y + 40, scale: v.controller.cam.scale });
    window.__warsim!.hud.selectFormation(0);
    window.__warsim!.hud.selectFormation(id);
  }, fleet.id);
  await expect(page.getByTestId('formation-panel')).toHaveAttribute('data-formation', String(fleet.id), { timeout: 20_000 });
  await expect(page.getByTestId('formation-status')).toHaveText('In contact');
  await expect(page.getByTestId('formation-fight')).toBeVisible();
  await page.getByTestId('formation-panel').screenshot({ path: path.join(out, 'a-fleet-panel-to-its-fight.png') });
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
  const own = await count(fleet.id);
  const foe = await count(fleet.enemy);
  const m = await page.evaluate(() => window.__warsim!.view!.metresPerPx);
  info.annotations.push({ type: 'fleet', description: `seed ${SEED}, hour ${hours} past day ${DAYS}: ${engaged.length} German or Polish fleets in contact (${engaged.map((e) => `${e.id} against ${e.enemy}`).join(', ')}); after the press on fleet ${fleet.id}: ${m.toFixed(1)} m/px, ${own.on} of its ${own.all} ships on the screen (${own.under} under a panel), ${foe.on} of the enemy's ${foe.all} (${foe.under})` });
  expect(own.all, 'its ships in the section').toBeGreaterThan(0);
  expect(foe.all, 'the enemy fleet\'s ships in the section').toBeGreaterThan(0);
  expect(own.on, 'its ships on the screen').toBe(own.all);
  expect(foe.on, 'the enemy fleet\'s ships on the screen').toBe(foe.all);
  expect(own.under + foe.under, 'ships under the panels at the view\'s sides').toBe(0);
  await settle(page);
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'b-fleet-at-its-fight.png') });
});
