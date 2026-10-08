import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 3.11c1 (the critic's R3-B3: "five tank formations share one cell as interleaved
// diamonds", `critic/shots/c3j_11_tank_paused_0040m.png`): the critic's game (seed 1212, the
// Soviet Union against Poland by God Mode) on day 6. Two tank corps and four tank brigades of
// one stack go to the block of one Polish division; a brigade's block is 7 by 4 elements and a
// corps' 11 by 5, and each line stood a block of its own behind and beside the line before it:
// the brigades' tanks stood between the corps'. Every block now stands clear of the others.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const SOV = nation('SOV');
const POL = nation('POL');
const VIEW = { width: 1600, height: 900 };
/** Between slots of one block, cells (`SLOT_SPACING`), and between the front rows of two (`DEPLOY_GAP`). */
const SPACING = 0.03;
const GAP = 0.05;

test('the blocks of a stack of tank corps and tank brigades in contact do not stand in one another', async ({ page }, info) => {
  test.setTimeout(300_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1212');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async ({ SOV, POL }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: SOV, defender: POL });
    let tick = 0;
    for (let d = 0; d < 6; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { SOV, POL });

  // The Soviet armour in contact, and of it the formation with the most of the others within a cell.
  const armour = await page.evaluate(async (SOV) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const found: { id: number; x: number; y: number }[] = [];
    for (const id of view!.formationsOf(SOV)) {
      const d = await sim.formation(id);
      if (!d?.engaged || templates[d.template]?.symbol !== 'armour') continue;
      const [x, y] = view!.formationPos(id)!;
      found.push({ id, x, y });
    }
    return found;
  }, SOV);
  expect(armour.length, 'Soviet armour formations in contact on day 6').toBeGreaterThanOrEqual(4);
  const near = (a: (typeof armour)[number]): number => armour.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 1).length;
  const centre = armour.reduce((best, a) => (near(a) > near(best) ? a : best));
  expect(near(centre), 'armour formations of one stack').toBeGreaterThanOrEqual(4);

  /** The view on the stack at `m` metres a pixel, with the section of that zoom drawn. */
  const goTo = (m: number): Promise<void> =>
    page.evaluate(async ({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { x: centre.x, y: centre.y, m });

  await goTo(40);
  // For every two formations of the section: how near an element of one stands to an element of the other.
  const pairs = await page.evaluate((SOV) => {
    const v = window.__warsim!.view!;
    const soviet = new Set(v.formationsOf(SOV));
    const by = new Map<number, [number, number][]>();
    for (let i = 0; i < v.elementCount; i++) {
      const f = v.elementFormation[i]!;
      let list = by.get(f);
      if (!list) by.set(f, (list = []));
      list.push([v.elementX[i]!, v.elementY[i]!]);
    }
    const ids = [...by.keys()].sort((a, b) => a - b);
    const out: { a: number; b: number; soviet: boolean; least: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let least = Infinity;
        for (const p of by.get(ids[i]!)!) for (const q of by.get(ids[j]!)!) least = Math.min(least, Math.hypot(p[0] - q[0], p[1] - q[1]));
        out.push({ a: ids[i]!, b: ids[j]!, soviet: soviet.has(ids[i]!) && soviet.has(ids[j]!), least });
      }
    }
    return { formations: ids.length, elements: v.elementCount, out };
  }, SOV);
  const own = pairs.out.filter((p) => p.soviet);
  expect(pairs.formations, 'formations with elements in the view at 40 m/px').toBeGreaterThanOrEqual(6);
  expect(own.length, 'pairs of Soviet formations in the view').toBeGreaterThanOrEqual(10);
  const nearest = own.reduce((best, p) => (p.least < best.least ? p : best));
  info.annotations.push({ type: 'stack', description: `${pairs.formations} formations, ${pairs.elements} elements; the two Soviet blocks nearest each other (${nearest.a}, ${nearest.b}): ${(nearest.least * 19.57).toFixed(2)} km between their nearest elements` });
  console.log(info.annotations.at(-1)!.description);
  // Two blocks a gap apart on one line have their nearest elements the gap and a slot apart
  // (1.57 km); in one another, less than a slot (0.29 km on the rule before). The stack's
  // formations stand up to 0.03 cells from each other, so their lines to the Pole differ by a
  // degree or two and a corner comes a little nearer: the gap is asked, not the slot more.
  for (const p of own) expect(p.least, `formations ${p.a} and ${p.b}`).toBeGreaterThan(GAP);
  expect(nearest.least).toBeLessThan(GAP + 2 * SPACING);

  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-40m.png') });
  await goTo(12);
  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-12m.png') });
  await goTo(4);
  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-4m.png') });
});

// PLAN 3.11c2: the critic's other game (seed 4242, Germany against Poland by God Mode) on day 21.
// German division 3 and Polish division 550 are each other's nearest and stand front to front.
// German division 4 comes to the Pole's block from 72° off the way it faces, its flank: it
// stopped a block's depth from the block's middle and stood in it (their middles 0.17 cells
// apart, a block being 0.24 wide) and in division 3's block. It now stops the gap short of both.
test('a block that comes to an enemy block from its flank stands in neither it nor the block it faces', async ({ page }, info) => {
  test.setTimeout(300_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const GER = nation('GER');
  const [FACED, COMER, POLE] = [3, 4, 550];
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

  // The three are who the test says they are: of Germany and of Poland, in contact.
  const who = await page.evaluate(async ({ ids, GER, POL }) => {
    const { sim, view } = window.__warsim!;
    const of = [new Set(view!.formationsOf(GER)), new Set(view!.formationsOf(POL))];
    const out: { engaged: boolean; german: boolean; polish: boolean; pos: [number, number] | null }[] = [];
    for (const id of ids) out.push({ engaged: (await sim.formation(id))?.engaged === true, german: of[0]!.has(id), polish: of[1]!.has(id), pos: view!.formationPos(id) ?? null });
    return out;
  }, { ids: [FACED, COMER, POLE], GER, POL });
  expect(who.map((f) => f.engaged)).toEqual([true, true, true]);
  expect(who.map((f) => f.german)).toEqual([true, true, false]);
  expect(who[2]!.polish).toBe(true);
  const centre = who[2]!.pos!;

  const goTo = (m: number): Promise<void> =>
    page.evaluate(async ({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { x: centre[0], y: centre[1], m });

  await goTo(20);
  // Between the three: how near an element of one stands to an element of another.
  const least = await page.evaluate((ids) => {
    const v = window.__warsim!.view!;
    const by = new Map<number, [number, number][]>(ids.map((id) => [id, []]));
    for (let i = 0; i < v.elementCount; i++) by.get(v.elementFormation[i]!)?.push([v.elementX[i]!, v.elementY[i]!]);
    const out: { a: number; b: number; elements: number; least: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let least = Infinity;
        for (const p of by.get(ids[i]!)!) for (const q of by.get(ids[j]!)!) least = Math.min(least, Math.hypot(p[0] - q[0], p[1] - q[1]));
        out.push({ a: ids[i]!, b: ids[j]!, elements: by.get(ids[i]!)!.length + by.get(ids[j]!)!.length, least });
      }
    }
    return out;
  }, [FACED, COMER, POLE]);
  info.annotations.push({ type: 'flank', description: least.map((p) => `${p.a} and ${p.b}: ${(p.least * 19.57).toFixed(2)} km between their nearest elements`).join('; ') });
  console.log(info.annotations.at(-1)!.description);
  for (const p of least) {
    expect(p.elements, `elements of ${p.a} and ${p.b} in the view at 20 m/px`).toBeGreaterThan(30);
    // In one another, two blocks have elements less than a slot apart; a gap apart, the gap at least.
    expect(p.least, `formations ${p.a} and ${p.b}`).toBeGreaterThan(GAP);
  }
  // The comer has come up to the block: no further from it than the gap and three slots (a corner to a side).
  expect(least.find((p) => p.a === COMER && p.b === POLE)!.least).toBeLessThan(GAP + 3 * SPACING);

  await page.screenshot({ path: path.join(out, 'c2-from-the-flank-20m.png') });
  await goTo(8);
  await page.screenshot({ path: path.join(out, 'c2-from-the-flank-8m.png') });
});
