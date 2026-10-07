import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.14a (the critic's R2-B2, "who is who"): at T2 and T3 the marker's box has given way to
// the formation's elements, and nothing said whose they were: no flag, no strength, no name, and
// German and Polish elements were two near-whites (every nation's tint lay between 178 and 255
// a channel). Every formation in a close view now has a tag (flag, strength, name) by its
// elements, and the sprites wear the nation's sprite colour.
//
// A German and a Polish infantry division, at war by God Mode, a cell apart across their border,
// where the order of battle has fewest formations; at 150 m/px (T2) and at 12 m/px (T3).

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const GER = nation('GER');
const POL = nation('POL');

/**
 * Where the two stand: a German cell with a Polish one east of it, the pair with the fewest
 * formations of the order of battle within three cells (the lowest cell on a tie). Each division
 * on its own land: one put on a third nation's is sent home in its first hour.
 */
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
const setup = (site: readonly [number, number]): Command[] => [
  { kind: 'setSetting', key: 'aiEnabled', value: false },
  { kind: 'declareWar', attacker: GER, defender: POL },
  { kind: 'spawnFormation', nation: GER, x: site[0] - 0.5, y: site[1], strength: 0, template: infantry },
  { kind: 'spawnFormation', nation: POL, x: site[0] + 0.5, y: site[1], strength: 0, template: infantry },
];
/** The most a tag stands from the box of its elements, px (a gap of 4; more only where it gave way to another). */
const NEAR_PX = 8;
/** The least the tints of two nations' sprites differ by, as a distance in RGB. Before: Germany (206, 206, 206), Poland (239, 201, 208): 33. */
const TINT_APART = 50;

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

async function zoomTo(page: Page, x: number, y: number, mPerPx: number): Promise<void> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  // The elements of this view have arrived: of this zoom, and some of them by the camera (after
  // a pan at one zoom the view still holds the last place's until the snapshot comes).
  await page.waitForFunction(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    if (Math.abs(v.elementsZoom / m - 1) >= 0.01) return false;
    for (let i = 0; i < v.elementCount; i++) if (Math.abs(v.elementX[i]! - x) < 0.5 && Math.abs(v.elementY[i]! - y) < 0.5) return true;
    return false;
  }, { x, y, m: mPerPx }, { timeout: 20_000 });
  await settle(page);
}

interface Seen {
  tags: { id: number; nation: number; text: string; name: string; flag: boolean; gap: number; line: boolean; x: number; y: number; w: number; h: number }[];
  left: number;
  opacity: number;
  /** Formations with an element on the screen, and the strength the view has of each. */
  inView: { id: number; nation: number; strength: number }[];
  tints: Record<number, string[]>;
  figures: number;
}

async function look(page: Page): Promise<Seen> {
  return page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const forms = new Map((await window.__warsim!.sim.inspect(true)).formations.map((f) => [f.id, f]));
    const on = new Set<number>();
    const tints: Record<number, Set<string>> = {};
    for (let i = 0; i < v.elementCount; i++) {
      const px = (v.elementX[i]! - cam.cx) * cam.scale + vw / 2;
      const py = (v.elementY[i]! - cam.cy) * cam.scale + vh / 2;
      const f = v.elementFormation[i]!;
      (tints[forms.get(f)!.nation] ??= new Set()).add(v.elementTint(i).join(','));
      if (px >= 0 && px <= vw && py >= 0 && py <= vh) on.add(f);
    }
    return {
      tags: v.tagRects.map((t) => ({ id: t.id, nation: t.nation, text: t.text, name: t.name, flag: t.flag, gap: t.gap, line: t.line, x: t.x, y: t.y, w: t.w, h: t.h })),
      left: v.tagsLeft,
      opacity: v.tagOpacity,
      inView: [...on].sort((a, b) => a - b).map((id) => ({ id, nation: forms.get(id)!.nation, strength: forms.get(id)!.strength })),
      tints: Object.fromEntries(Object.entries(tints).map(([n, s]) => [n, [...s]])),
      figures: v.individualCount,
    };
  });
}

const text = (men: number): string => (Math.round(men) < 1000 ? String(Math.round(men)) : `${(Math.round(men) / 1000).toFixed(1)}k`);

function check(seen: Seen, where: string, ours: number[]): void {
  // Every formation with an element on the screen has its tag, and nothing else has one.
  expect(seen.left, `${where}: tags left out`).toBe(0);
  expect(seen.opacity, `${where}: the tags' opacity at rest`).toBe(1);
  expect(seen.tags.map((t) => t.id).sort((a, b) => a - b), `${where}: tagged`).toEqual(seen.inView.map((f) => f.id));
  for (const f of seen.inView) {
    const t = seen.tags.find((x) => x.id === f.id)!;
    expect(t.nation, `${where}: formation ${f.id}'s nation`).toBe(f.nation);
    expect(t.flag, `${where}: formation ${f.id}'s flag`).toBe(true);
    expect(t.text, `${where}: formation ${f.id}'s strength`).toBe(text(f.strength));
    // Its kind and its number; the two divisions of the test are infantry divisions.
    expect(t.name, `${where}: formation ${f.id}'s name`).toMatch(new RegExp(`^\\S.* ${f.id}$`));
    if (ours.includes(f.id)) expect(t.name, `${where}: formation ${f.id}'s name`).toBe(`Infantry division ${f.id}`);
    expect(t.gap, `${where}: formation ${f.id}'s tag, px from its elements`).toBeLessThanOrEqual(NEAR_PX);
    // By its elements: no line (PLAN 3.7g).
    expect(t.line, `${where}: formation ${f.id}'s tag has a line`).toBe(false);
    // In the view, whole.
    expect(t.x, where).toBeGreaterThanOrEqual(0);
    expect(t.y, where).toBeGreaterThanOrEqual(0);
    expect(t.x + t.w, where).toBeLessThanOrEqual(1400);
    expect(t.y + t.h, where).toBeLessThanOrEqual(800);
  }
  for (const [i, a] of seen.tags.entries()) for (const b of seen.tags.slice(i + 1)) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${where}: tag ${a.id} on tag ${b.id}`).toBe(false);
}

test('at T2 and T3 every formation in the view has its flag, strength and name by it, and two nations\' sprites differ', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const SITE = border();
  await step(page, setup(SITE));
  // The two divisions of the test: the last two formations made.
  const ours = (await page.evaluate(() => window.__warsim!.view!.formationIds())).sort((a, b) => a - b).slice(-2);

  // T1, 500 m/px: the markers say who is who; no tag.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 500 });
  }, { x: SITE[0], y: SITE[1] });
  await settle(page);
  const t1 = await look(page);
  expect(t1.tags, 'T1: tags').toEqual([]);
  expect(t1.opacity).toBe(0);

  // T2, 150 m/px: both divisions in one view.
  await zoomTo(page, SITE[0], SITE[1], 150);
  const t2 = await look(page);
  for (const id of ours) expect(t2.inView.map((f) => f.id), 'T2: the test\'s divisions on the screen').toContain(id);
  check(t2, 'T2, 150 m/px', ours);
  await page.screenshot({ path: path.join(out, 'tags-t2-150m.png'), clip: { x: 300, y: 200, width: 800, height: 400 } });

  // The two sides differ in the picture: one tint a nation, well apart.
  expect(t2.tints[GER]).toHaveLength(1);
  expect(t2.tints[POL]).toHaveLength(1);
  const [g, p] = [t2.tints[GER]![0]!.split(',').map(Number), t2.tints[POL]![0]!.split(',').map(Number)];
  const apart = Math.hypot(g[0]! - p[0]!, g[1]! - p[1]!, g[2]! - p[2]!);
  console.log(`tints: Germany ${g.join(', ')}; Poland ${p.join(', ')}; ${apart.toFixed(0)} apart in RGB`);
  expect(apart, 'the tints of Germany and Poland, apart in RGB').toBeGreaterThan(TINT_APART);

  // T3, 12 m/px, on each division's block in turn. The two are in contact, and since PLAN
  // 2.14c1 their blocks stand front to front in the middle between the formations' places,
  // 0.17 cells from middle to middle: each view has both.
  for (const [name, x] of [['german', SITE[0] - 0.085], ['polish', SITE[0] + 0.085]] as const) {
    await zoomTo(page, x, SITE[1], 12);
    const t3 = await look(page);
    expect(t3.figures, `T3 on the ${name} division: figures`).toBeGreaterThan(200);
    expect(t3.inView.length, `T3 on the ${name} division: formations on the screen`).toBeGreaterThan(0);
    check(t3, `T3, 12 m/px, on the ${name} division`, ours);
    await page.screenshot({ path: path.join(out, `tags-t3-12m-${name}.png`) });
  }
  console.log(`tags at T2: ${t2.tags.map((t) => `"${t.text} ${t.name}" ${t.w}×${t.h} px, ${t.gap} px from its elements`).join('; ')}`);

  // PLAN 2.14f2: a tag does not stand under the war banners or the bottom bar. The German
  // division's block in the middle of the view's width, where the banners (the test's war and
  // the wars of 1938's start) and the bar are, and its top edge at four heights near the bottom:
  // the place above it is then under the banners, or the place below it, held in the view,
  // under the bar.
  await expect(page.locator(`[data-testid="war-banner"]`).first()).toBeVisible();
  const bar = (await page.getByTestId('bottombar').boundingBox())!;
  const row = (await page.getByTestId('war-banners').boundingBox())!;
  const boxes = [bar];
  for (const b of await page.getByTestId('war-banner').all()) boxes.push((await b.boundingBox())!);
  expect(boxes.length, 'the bar and the banners').toBeGreaterThan(1);
  const px = (b: { x: number; y: number; width: number; height: number }): string => `${b.width.toFixed(0)}×${b.height.toFixed(0)} px at ${b.x.toFixed(0)}, ${b.y.toFixed(0)}`;
  console.log(`${boxes.length - 1} banners in ${px(row)}; the bar ${px(bar)}`);
  const german = ours[0]!;
  const under: string[] = [];
  for (const top of [800 - 130, row.y + row.height + 30, bar.y + bar.height / 2, 800 - 12]) {
    // The block's top edge to `top` px and its middle to the middle of the width.
    await page.evaluate(({ id, top }) => {
      const v = window.__warsim!.view!;
      const cam = v.controller.cam;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        x0 = Math.min(x0, v.elementX[i]!);
        x1 = Math.max(x1, v.elementX[i]!);
        y0 = Math.min(y0, v.elementY[i]!);
      }
      v.controller.set({ cx: (x0 + x1) / 2, cy: y0 - (top - window.innerHeight / 2) / cam.scale, scale: cam.scale });
    }, { id: german, top: Math.round(top) });
    await settle(page);
    const seen = await look(page);
    const where = `the German block's top at ${Math.round(top)} px`;
    expect(seen.inView.map((f) => f.id), `${where}: on the screen`).toContain(german);
    expect(seen.left, `${where}: tags left out`).toBe(0);
    expect(seen.tags.map((t) => t.id).sort((a, b) => a - b), `${where}: tagged`).toEqual(seen.inView.map((f) => f.id));
    for (const t of seen.tags) {
      expect(t.y, where).toBeGreaterThanOrEqual(0);
      expect(t.y + t.h, where).toBeLessThanOrEqual(800);
      for (const [k, b] of boxes.entries()) {
        if (t.x < b.x + b.width && b.x < t.x + t.w && t.y < b.y + b.height && b.y < t.y + t.h) under.push(`${where}: the tag of ${t.id} (${t.x}, ${t.y}, ${t.w}×${t.h}) under ${k === 0 ? 'the bar' : `banner ${k}`}`);
      }
    }
    await page.screenshot({ path: path.join(out, `tags-bottom-${Math.round(top)}.png`), clip: { x: 300, y: 500, width: 800, height: 300 } });
  }
  expect(under, 'tags under the war banner or the bottom bar').toEqual([]);
});
