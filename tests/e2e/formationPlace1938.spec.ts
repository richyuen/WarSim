import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 3.11a (the critic's R3-B3, `critic/c3_m.json`): a formation in contact was said to be at
// its place in the rules, and its elements stood deployed against the enemy two thirds of a
// cell from there (12.8 km). The view centred on that place at 6 and at 2 m/px held none of its
// elements and no figure: a tag over an empty field. The snapshot and the panel now say where
// the block stands.
//
// The critic's game: seed 4242, Germany against Poland by God Mode, day 21 of the war. Every
// German formation in contact, the armour among them: the camera goes to where the view has
// the formation (`formationPos`: its marker, its click, its panel) and finds its elements.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = nation('GER');
const POL = nation('POL');
const VIEW = { width: 1400, height: 800 };

interface Seen {
  id: number;
  armour: boolean;
  /** Its elements in the section, and those of them on the screen, at 6 m/px; the figures drawn then. */
  all: number;
  on6: number;
  figures6: number;
  /** From the place it is said to be at to the middle of its elements, km. */
  offKm: number;
  /** Whether the panel's place is the view's. */
  panel: boolean;
  on2: number;
}

test('the view centred on a formation in contact holds its elements, at 6 and at 2 m/px', async ({ page }, info) => {
  test.setTimeout(420_000);
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

  // The German formations in contact, as the panel has them.
  const engaged = await page.evaluate(async (GER) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const out: { id: number; armour: boolean }[] = [];
    for (const id of view!.formationsOf(GER)) {
      const d = await sim.formation(id);
      if (d?.engaged) out.push({ id, armour: templates[d.template]?.symbol === 'armour' });
    }
    return out;
  }, GER);
  expect(engaged.length, 'German formations in contact on day 21').toBeGreaterThan(5);
  expect(engaged.filter((e) => e.armour).length, 'German armour in contact on day 21').toBeGreaterThan(0);

  const look = (id: number, armour: boolean): Promise<Seen> =>
    page.evaluate(async ({ id, armour }) => {
      const { sim, view } = window.__warsim!;
      const v = view!;
      const [x, y] = v.formationPos(id)!;
      const kmPerCell = (v.metresPerPx * v.controller.cam.scale) / 1000;
      const at = async (m: number): Promise<{ all: number; on: number; mx: number; my: number }> => {
        v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
        // The section of this view: asked for at this zoom, and drawn. A second and a half for it to come.
        const t0 = performance.now();
        while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
        await new Promise((d) => setTimeout(d, 400));
        v.draw(performance.now());
        const cam = v.controller.cam;
        const s = { all: 0, on: 0, mx: 0, my: 0 };
        for (let i = 0; i < v.elementCount; i++) {
          if (v.elementFormation[i] !== id) continue;
          s.all++;
          s.mx += v.elementX[i]!;
          s.my += v.elementY[i]!;
          const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
          const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
          if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
        }
        return s;
      };
      const six = await at(6);
      const figures6 = v.individualCount;
      const two = await at(2);
      const d = await sim.formation(id);
      return {
        id,
        armour,
        all: six.all,
        on6: six.on,
        figures6,
        offKm: six.all === 0 ? -1 : Math.hypot(six.mx / six.all - x, six.my / six.all - y) * kmPerCell,
        panel: d !== null && d.x === x && d.y === y,
        on2: two.on,
      };
    }, { id, armour });

  const seen: Seen[] = [];
  for (const e of engaged) seen.push(await look(e.id, e.armour));
  const far = Math.max(...seen.map((s) => s.offKm));
  console.log(`seed 4242, day 21: ${seen.length} German formations in contact, ${seen.filter((s) => s.armour).length} of them armour; from the place each is said to be at to the middle of its elements ${far.toFixed(2)} km at most; elements on the screen at 6 m/px ${Math.min(...seen.map((s) => s.on6))} to ${Math.max(...seen.map((s) => s.on6))}, at 2 m/px ${Math.min(...seen.map((s) => s.on2))} to ${Math.max(...seen.map((s) => s.on2))}`);
  for (const s of seen) {
    const what = `formation ${s.id}${s.armour ? ' (armour)' : ''}`;
    expect(s.all, `${what}: its elements in the section at 6 m/px`).toBeGreaterThan(0);
    // The critic read 12.8 km. A block is 4.7 km by 2.3; one that the coast draws in is a little off its middle.
    expect(s.offKm, `${what}: km from its place to the middle of its elements`).toBeLessThan(1);
    // The view at 6 m/px is 8.4 km by 4.8: the block, but for a corner of one that stands across it.
    expect(s.on6 / s.all, `${what}: the share of its elements on the screen at 6 m/px`).toBeGreaterThan(0.6);
    expect(s.figures6, `${what}: figures at 6 m/px`).toBeGreaterThan(0);
    // At 2 m/px, 2.8 km by 1.6: the middle of the block.
    expect(s.on2, `${what}: its elements on the screen at 2 m/px`).toBeGreaterThan(0);
    expect(s.panel, `${what}: the panel's place is the view's`).toBe(true);
  }

  // The pictures: the first armour formation in contact, at 6 and at 20 m/px on its place.
  const tank = seen.find((s) => s.armour)!;
  for (const m of [20, 6]) {
    await page.evaluate(async ({ id, m }) => {
      const v = window.__warsim!.view!;
      const [x, y] = v.formationPos(id)!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
    }, { id: tank.id, m });
    await settle(page);
    await page.evaluate(() => window.__warsim!.view!.draw());
    await page.screenshot({ path: path.join(out, `a-armour-at-its-place-${m}m.png`) });
  }
});
