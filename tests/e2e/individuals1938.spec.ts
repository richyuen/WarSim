import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { deployOf, elementIndex, slotCount } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.6 AT: at T3 an element is drawn as its individuals, and their number is the sim's
// strength. Tanks (10 to an element) and guns (12) are exact: a figure each. A battalion of 500
// has 64 figures when whole and its share of them while it loses men, rounded up (PLAN 2.10b,
// ADR-80; until then it had 64 until fewer than 64 men were left, ADR-69). The battle is the
// spawned one of PLAN 2.5 with a Japanese armoured division added, taken at the hour when
// Chinese battalions have fallen below 64 men: every branch of the rule is on the map at once,
// and the two rules differ most (50 men: 50 figures by the old one, 7 by this). The strengths
// and sizes come from the same battle in Node (hashes compared), the figures from the view.

const { w: W } = SIZE_1938;
const SITE = [1578.5, 338.5] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const JAP = nation('JAP');
const CHI = nation('CHI');
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const MAX_FIGURES = 64;
/** The rule, written out here on its own: a figure a unit where an element has up to 64 units; above, its share of 64, rounded up. */
const figuresOf = (units: number, size: number): number => (size <= MAX_FIGURES ? units : Math.min(MAX_FIGURES, Math.ceil((units * MAX_FIGURES) / size)));
/** How far from its element's middle a figure can stand: the corner of the footprint (0.024 cells square), and a hair. */
const FOOTPRINT_REACH = 0.012 * Math.SQRT2 + 1e-9;

const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false },
  { kind: 'setAi', nation: CHI, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1], strength: 0, template: template('infantry_div') },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1] + 0.6, strength: 0, template: template('panzer_div') },
  { kind: 'spawnFormation', nation: CHI, x: SITE[0] + 1, y: SITE[1], strength: 0, template: template('infantry_div') },
];
const buffs = (japanese: readonly number[]): Command[] => japanese.map((f) => ({ kind: 'grantBuff', targetKind: 'formation', target: f, buff: 'attack', magnitude: 20, hours: 24 * 30, nameKey: 'buff.god' }));

interface El {
  id: number;
  f: number;
  cls: string;
  units: number;
  /** The units of the element when whole. */
  size: number;
}
interface Formation {
  id: number;
  x: number;
  y: number;
}

/** The battle in Node: the hour at which six Chinese battalions are below 64 men, and the hour after. */
function nodeBattle(): { formations: Formation[]; japanese: number[]; chinese: number; thin: number; hashes: number[]; elements: El[][] } {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const w = sim.world;
  const fc = w.formations.cols;
  for (const c of SETUP) sim.command(c);
  sim.step(1);
  const ids = w.formations.ids().filter((f) => Math.abs(fc.x[f]! - SITE[0]) <= 3 && Math.abs(fc.y[f]! - SITE[1]) <= 3);
  const japanese = ids.filter((f) => fc.nation[f] === JAP);
  const chinese = ids.find((f) => fc.nation[f] === CHI)!;
  const read = (): El[] => ids.flatMap((f) => (elementIndex(w).get(f) ?? []).map((id) => ({ id, f, cls: w.rules!.units[w.elements.cols.unit[id]!]!.cls, units: w.elements.cols.strength[id]!, size: w.rules!.units[w.elements.cols.unit[id]!]!.size })));
  const hashes = [sim.hash()];
  for (const c of buffs(japanese)) sim.command(c);
  let thin = 0;
  const below = (): number => read().filter((e) => e.f === chinese && e.cls === 'inf' && e.units < MAX_FIGURES).length;
  while (below() < 6 && thin < 24 * 20) {
    sim.step(1);
    thin++;
  }
  hashes.push(sim.hash());
  const elements = [read()];
  // Where each one's block stands in that hour: the three are in contact, and their blocks are
  // deployed against the enemy (PLAN 2.14c1), not at the formations' places.
  const formations = ids.map((id) => {
    const d = deployOf(w, id, slotCount(w, id, elementIndex(w).get(id)?.length ?? 0));
    return { id, x: d ? d.x : fc.x[id]!, y: d ? d.y : fc.y[id]! };
  });
  sim.step(1);
  hashes.push(sim.hash());
  elements.push(read());
  return { formations, japanese, chinese, thin, hashes, elements };
}

interface Seen {
  elements: { id: number; f: number; units: number; x: number; y: number }[];
  figures: { owner: number; x: number; y: number }[];
  shown: boolean;
  mPerPx: number;
  buildMs: number;
  drawMs: number;
}

/** T3 on a point: the elements the view holds and the figures it draws for them. */
async function close(page: Page, x: number, y: number, mPerPx: number): Promise<Seen> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x, y, m: mPerPx });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    return v.subscription?.tier === 3 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.05 && Math.abs((b[1] + b[3]) / 2 - y) < 0.05 && v.elementCount > 0 && v.individualCount > 0;
  }, { x, y }, { timeout: 15_000 });
  // The close tier comes in over 250 ms (PLAN 2.7b): read it at rest.
  await settle(page);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) v.draw();
    const drawMs = (performance.now() - t0) / 10;
    return {
      elements: Array.from(v.elementId, (id, i) => ({ id, f: v.elementFormation[i]!, units: v.elementStrength[i]!, x: v.elementX[i]!, y: v.elementY[i]! })),
      figures: Array.from(v.individualOwner, (owner, i) => ({ owner, x: v.individualX[i]!, y: v.individualY[i]! })),
      shown: v.individualsShown,
      mPerPx: v.metresPerPx,
      buildMs: v.individualsBuildMs,
      drawMs,
    };
  });
}

/** The figures of each element, in the order they were built. */
function byOwner(s: Seen): Map<number, { x: number; y: number }[]> {
  const m = new Map<number, { x: number; y: number }[]>();
  for (const f of s.figures) m.set(f.owner, [...(m.get(f.owner) ?? []), f]);
  return m;
}

test('T3: an element is its individuals, a figure a unit for guns and tanks and a battalion\'s share of 64, inside its footprint', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = nodeBattle();
  expect(node.formations).toHaveLength(3);
  expect(node.thin).toBeGreaterThan(0);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.6') : info.outputPath();
  mkdirSync(out, { recursive: true });

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const run = (cmds: Command[], hours: number): Promise<{ tick: number; hash: number }> =>
    page.evaluate(async ({ cmds, hours }) => {
      const sim = window.__warsim!.sim;
      for (const c of cmds) sim.command(c);
      const tick = (await sim.step(hours)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      return sim.hash();
    }, { cmds, hours });
  expect(await run(SETUP, 1)).toEqual({ tick: 1, hash: node.hashes[0] });
  expect(await run(buffs(node.japanese), node.thin)).toEqual({ tick: 1 + node.thin, hash: node.hashes[1] });

  // Each of the three formations in turn at 12 m/px: its elements and their figures.
  const sim = new Map(node.elements[0]!.map((e) => [e.id, e]));
  const rows: { id: number; cls: string; units: number; size: number; figures: number }[] = [];
  let slowestDraw = 0;
  for (const f of node.formations) {
    const all = await close(page, f.x, f.y, 12);
    expect(all.shown, `formation ${f.id}`).toBe(true);
    // Of what the view holds, this formation's: the enemy's block stands a kilometre off (PLAN 2.14c1).
    const own1 = new Set(all.elements.filter((e) => e.f === f.id).map((e) => e.id));
    const s = { ...all, elements: all.elements.filter((e) => own1.has(e.id)), figures: all.figures.filter((p) => own1.has(p.owner)) };
    slowestDraw = Math.max(slowestDraw, s.drawMs);
    const figures = byOwner(s);
    const mine = node.elements[0]!.filter((e) => e.f === f.id);
    // The view holds this formation's elements, with the sim's strengths.
    expect(s.elements.map((e) => [e.id, e.units]).sort((a, b) => a[0]! - b[0]!)).toEqual(mine.map((e) => [e.id, e.units]));
    expect(s.figures).toHaveLength(mine.reduce((n, e) => n + figuresOf(e.units, e.size), 0));
    for (const e of s.elements) {
      const own = figures.get(e.id) ?? [];
      const { cls, units, size } = sim.get(e.id)!;
      // The rule: a battalion's share of 64 figures, rounded up. Tanks and guns: a figure each.
      expect(own.length, `${cls} element ${e.id} of ${units} in ${size}`).toBe(figuresOf(units, size));
      if (cls !== 'inf' && cls !== 'mot' && cls !== 'mech') expect(own.length, `${cls} element ${e.id}`).toBe(units);
      else expect(size, `${cls} element ${e.id}: a battalion's size`).toBeGreaterThan(MAX_FIGURES);
      // An element with men has a figure.
      if (units > 0) expect(own.length, `${cls} element ${e.id} of ${units}`).toBeGreaterThan(0);
      // Inside the footprint, and no two on one spot.
      // Since PLAN 2.14c1 a block in contact faces its enemy, at any angle: the footprint (a
      // square of 0.024 cells, turned with the block) is inside the circle through its corners.
      // (Until then every block of this test faced east, and the bound was the slot's half, 0.015, along each axis.)
      for (const p of own) expect(Math.hypot(p.x - e.x, p.y - e.y), `a figure of ${e.id}`).toBeLessThan(FOOTPRINT_REACH);
      expect(new Set(own.map((p) => `${p.x},${p.y}`)).size).toBe(own.length);
      rows.push({ id: e.id, cls, units, size, figures: own.length });
    }
    const tag = f.id === node.chinese ? 'chinese-infantry' : mine.some((e) => e.cls.startsWith('armor')) ? 'japanese-armour' : 'japanese-infantry';
    await page.screenshot({ path: path.join(out, `t3-12m-${tag}.png`) });
    if (tag !== 'japanese-infantry') {
      await close(page, f.x, f.y, 4);
      await page.screenshot({ path: path.join(out, `t3-4m-${tag}.png`) });
    }
  }
  // Every branch of the rule was on the map: battalions with more than 64 men and with fewer
  // (where one figure a man would draw more than the share), some that show their losses
  // though they have more than 64 men (which the cap of ADR-69 hid), guns, tanks.
  const count = (pred: (r: (typeof rows)[number]) => boolean): number => rows.filter(pred).length;
  expect(count((r) => r.cls === 'inf' && r.units > MAX_FIGURES)).toBeGreaterThan(10);
  expect(count((r) => r.cls === 'inf' && r.units < MAX_FIGURES)).toBeGreaterThanOrEqual(6);
  expect(count((r) => r.cls === 'inf' && r.units > MAX_FIGURES && r.figures < MAX_FIGURES)).toBeGreaterThanOrEqual(6);
  for (const r of rows) if (r.cls === 'inf' && r.units < MAX_FIGURES && r.units > 8) expect(r.figures, `battalion ${r.id} of ${r.units}`).toBeLessThan(r.units);
  expect(count((r) => r.cls === 'art' || r.cls === 'at')).toBeGreaterThanOrEqual(6);
  expect(count((r) => r.cls.startsWith('armor'))).toBeGreaterThanOrEqual(30);
  // The AT's sample: 20 elements by a seeded draw, as a table.
  let seed = 2606;
  const draw = (): number => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const sample = Array.from({ length: 20 }, () => rows[Math.floor(draw() * rows.length)]!);
  for (const r of sample) expect(r.figures, `${r.cls} ${r.id}`).toBe(figuresOf(r.units, r.size));
  console.log(`T3: ${rows.length} elements checked: ${count((r) => r.cls.startsWith('armor'))} armour, ${count((r) => r.cls === 'art' || r.cls === 'at')} guns, ${count((r) => (r.cls === 'inf' || r.cls === 'mot') && r.figures === MAX_FIGURES)} battalions with all 64 figures, ${count((r) => r.cls === 'inf' && r.units > MAX_FIGURES && r.figures < MAX_FIGURES)} with fewer and more than 64 men, ${count((r) => r.cls === 'inf' && r.units < MAX_FIGURES)} with fewer than 64 men`);
  console.log(`T3 sample (class strength of size→figures): ${sample.map((r) => `${r.cls} ${r.units} of ${r.size}→${r.figures}`).join(', ')}`);

  // One more hour of fighting, on the Chinese division: who is left stands where he stood; the
  // figures of a loss are the last of the element's order, and a dead element has none.
  const chi = node.formations.find((f) => f.id === node.chinese)!;
  const before = await close(page, chi.x, chi.y, 12);
  expect(await run([], 1)).toEqual({ tick: 2 + node.thin, hash: node.hashes[2] });
  const after = await close(page, chi.x, chi.y, 12);
  const [was, is] = [byOwner(before), byOwner(after)];
  const posOf = new Map(before.elements.map((e) => [e.id, e]));
  const nowOf = new Map(after.elements.map((e) => [e.id, e]));
  let fewer = 0;
  let died = 0;
  for (const [id, old] of was) {
    const left = is.get(id) ?? [];
    const e1 = nowOf.get(id);
    if (!e1) {
      died++;
      expect(left).toHaveLength(0);
      continue;
    }
    const e0 = posOf.get(id)!;
    // The element kept its slot (PLAN 2.7a), though the division went from 22 elements to 17,
    // across a step of the block's grid.
    expect([e1.x, e1.y], `element ${id}`).toEqual([e0.x, e0.y]);
    expect(left.length).toBeLessThanOrEqual(old.length);
    if (left.length < old.length) fewer++;
    for (let k = 0; k < left.length; k++) {
      expect(left[k]!.x - e1.x, `figure ${k} of ${id}`).toBeCloseTo(old[k]!.x - e0.x, 9);
      expect(left[k]!.y - e1.y, `figure ${k} of ${id}`).toBeCloseTo(old[k]!.y - e0.y, 9);
    }
  }
  expect(fewer + died).toBeGreaterThan(3);

  // All three formations in one view at the edge of T3, for the cost of a frame with the most figures.
  const wide = await close(page, SITE[0] + 0.5, SITE[1] + 0.3, 28);
  await page.screenshot({ path: path.join(out, 't3-28m-battle.png') });
  console.log(`T3 at ${wide.mPerPx.toFixed(0)} m/px: ${wide.figures.length} figures of ${wide.elements.length} elements; build ${wide.buildMs.toFixed(2)} ms, draw ${wide.drawMs.toFixed(2)} ms of CPU a frame; one formation at 12 m/px: draw ${slowestDraw.toFixed(2)} ms; ${fewer} elements lost figures and ${died} died in the last hour`);
  expect(wide.shown).toBe(true);
  expect(wide.figures.length).toBeGreaterThan(1500);
  expect(wide.buildMs).toBeLessThan(25);

  // T2 again: the element sprites, no individuals drawn.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 60 });
    v.draw();
  }, { x: chi.x, y: chi.y });
  expect(await page.evaluate(() => window.__warsim!.view!.individualsShown)).toBe(false);
});
