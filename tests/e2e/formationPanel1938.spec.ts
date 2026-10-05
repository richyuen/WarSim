import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { ECONOMY_TABLES_1938, NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.14b (the critic's R2-B2): "A click on one opens its nation's panel: there is no
// formation panel and no tooltip anywhere, so a formation's name, kind and composition cannot be
// read at any zoom." A click on a formation now opens its panel: at T1 on its marker, at T2 on
// its tag or its elements, at T3 on one of its figures' battalions. The panel's numbers are the
// sim's. A click on ground closes it and selects the nation, as before.
//
// The two divisions of `tags1938.spec.ts`: a German and a Polish one across their border.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const GER = nation('GER');
const POL = nation('POL');

/** A German cell with a Polish one east of it, where the order of battle has fewest formations near. */
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

async function step(page: Page, cmds: Command[]): Promise<void> {
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, cmds);
}

async function zoomTo(page: Page, x: number, y: number, mPerPx: number, elements: boolean): Promise<void> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  if (elements) {
    await page.waitForFunction(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      if (Math.abs(v.elementsZoom / m - 1) >= 0.01) return false;
      for (let i = 0; i < v.elementCount; i++) if (Math.abs(v.elementX[i]! - x) < 0.5 && Math.abs(v.elementY[i]! - y) < 0.5) return true;
      return false;
    }, { x, y, m: mPerPx }, { timeout: 20_000 });
  }
  await settle(page);
}

/** What the panel says, read from the page. */
async function panel(page: Page): Promise<{ id: number; name: string; kind: string; nation: string; strength: string; supply: string; status: string; units: string[] } | null> {
  const p = page.getByTestId('formation-panel');
  if ((await p.count()) === 0) return null;
  await expect(page.getByTestId('formation-strength')).toBeVisible({ timeout: 10_000 });
  return {
    id: Number(await p.getAttribute('data-formation')),
    name: (await page.getByTestId('formation-name').innerText()).trim(),
    kind: (await page.getByTestId('formation-kind').innerText()).trim(),
    nation: (await page.getByTestId('formation-nation').innerText()).trim(),
    strength: (await page.getByTestId('formation-strength').innerText()).trim(),
    supply: (await page.getByTestId('formation-supply').innerText()).trim(),
    status: (await page.getByTestId('formation-status').innerText()).trim(),
    units: (await page.getByTestId('formation-units').locator('tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()),
  };
}

const num = (v: number): string => Math.round(v).toLocaleString('en-US');

test('a click on a formation opens its panel at T1, T2 and T3, with the sim\'s numbers; a click on ground closes it', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const SITE = border();
  await step(page, [
    { kind: 'setSetting', key: 'aiEnabled', value: false },
    { kind: 'declareWar', attacker: GER, defender: POL },
    { kind: 'spawnFormation', nation: GER, x: SITE[0] - 0.5, y: SITE[1], strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: POL, x: SITE[0] + 0.5, y: SITE[1], strength: 0, template: infantry },
  ]);
  const [german, polish] = (await page.evaluate(() => window.__warsim!.view!.formationIds())).sort((a, b) => a - b).slice(-2) as [number, number];

  // What the sim has of the two (the element rows by unit type, from the template).
  const sim = await page.evaluate(async () => (await window.__warsim!.sim.inspect(true)).formations.map((f) => ({ id: f.id, nation: f.nation, strength: f.strength, elements: f.elements })));
  const template = TEMPLATES_LAND[infantry]!;
  const expectPanel = async (id: number, tag: 'GER' | 'POL', where: string): Promise<void> => {
    const p = await panel(page);
    expect(p, `${where}: the panel`).not.toBeNull();
    const f = sim.find((x) => x.id === id)!;
    expect(p!.id, `${where}: whose panel`).toBe(id);
    expect(p!.name, where).toBe(`Infantry division ${id}`);
    expect(p!.kind, where).toBe('Infantry division');
    expect(p!.nation, where).toBe(tag === 'GER' ? 'Germany' : 'Poland');
    // Its men now, as the sim has them (the two are in contact: the first hour cost some), of a whole one's.
    expect(p!.strength, `${where}: men`).toBe(`${num(f.strength)} of ${num(ECONOMY_TABLES_1938.templateStrength[infantry]!)}`);
    expect(p!.supply, where).toBe('100%');
    // One row a unit type of the template, with as many elements as the template gives it.
    expect(p!.units.length, `${where}: unit types`).toBe(template.elements.length);
    expect(p!.units.reduce((s, row) => s + Number(row.split('×')[0]), 0), `${where}: elements`).toBe(f.elements);
    for (const [k, e] of template.elements.entries()) expect(p!.units[k], `${where}: row ${k}`).toMatch(new RegExp(`^${e.count}× .+ [\\d,]+ of [\\d,]+$`));
  };
  /** Where formation `id` is drawn: its tag's middle, its marker's middle, or one of its elements. */
  const at = (id: number, what: 'tag' | 'marker' | 'element'): Promise<[number, number]> =>
    page.evaluate(({ id, what }) => {
      const v = window.__warsim!.view!;
      const mid = (r: { x: number; y: number; w: number; h: number }): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];
      if (what === 'tag') return mid(v.tagRects.find((t) => t.id === id)!);
      if (what === 'marker') return mid(v.markerRects.find((m) => m.id === id || m.members.includes(id))!);
      const cam = v.controller.cam;
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        // On the screen, clear of the panels at its edges.
        if (px > 350 && px < 1050 && py > 120 && py < 650) return [px, py];
      }
      throw new Error(`no element of formation ${id} in the middle of the screen`);
    }, { id, what });

  // Nothing is open; a click on ground selects the nation, as before.
  expect(await panel(page)).toBeNull();

  // T1, 500 m/px: a click on the marker.
  await zoomTo(page, SITE[0], SITE[1], 500, false);
  await page.mouse.click(...(await at(german, 'marker')));
  await expectPanel(german, 'GER', 'T1, the German marker');
  await page.mouse.click(...(await at(polish, 'marker')));
  await expectPanel(polish, 'POL', 'T1, the Polish marker');

  // T2, 150 m/px: a click on the tag, and on an element.
  await zoomTo(page, SITE[0], SITE[1], 150, true);
  await page.mouse.click(...(await at(german, 'tag')));
  await expectPanel(german, 'GER', 'T2, the German tag');
  await page.mouse.click(...(await at(polish, 'element')));
  await expectPanel(polish, 'POL', 'T2, a Polish element');
  await page.screenshot({ path: path.join(out, 'formation-panel-t2.png') });

  // A click on ground, away from both: the panel closes and the nation's opens.
  await page.mouse.click(700, 700);
  await expect(page.getByTestId('formation-panel')).toHaveCount(0);
  await expect(page.getByTestId('nation-panel')).toBeVisible();

  // T3, 12 m/px, on the Polish division's block (deployed against the German one, in the
  // middle between the two formations' places: PLAN 2.14c1): a click on one of its battalions.
  await zoomTo(page, SITE[0] + 0.085, SITE[1], 12, true);
  await page.mouse.click(...(await at(polish, 'element')));
  await expectPanel(polish, 'POL', 'T3, a Polish battalion');
  await page.screenshot({ path: path.join(out, 'formation-panel-t3.png') });

  // The nation's chip leads to the nation panel; the close button closes.
  await page.getByTestId('formation-nation').click();
  await expect(page.getByTestId('formation-panel')).toHaveCount(0);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(POL));
  await page.mouse.click(...(await at(polish, 'tag')));
  await expectPanel(polish, 'POL', 'T3, the Polish tag');
  await page.getByTestId('formation-close').click();
  await expect(page.getByTestId('formation-panel')).toHaveCount(0);

  // The panel follows the game: a day on, engaged or not, its men are the sim's of that day.
  await page.mouse.click(...(await at(polish, 'tag')));
  await page.evaluate(async () => {
    await window.__warsim!.sim.step(24);
  });
  const later = await page.evaluate(async (id) => (await window.__warsim!.sim.inspect(true)).formations.find((f) => f.id === id)!.strength, polish);
  await expect(page.getByTestId('formation-strength')).toHaveText(new RegExp(`^${num(later)} of `), { timeout: 15_000 });
  console.log(`the Polish division a day on: ${num(later)} men; status "${(await panel(page))!.status}"`);
});
