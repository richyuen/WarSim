import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { flankCase } from '../helpers/flankCase';

// PLAN 3.11c1 (the critic's R3-B3: "five tank formations share one cell as interleaved
// diamonds", `critic/shots/c3j_11_tank_paused_0040m.png`): the critic's game (seed 1212, the
// Soviet Union against Poland by God Mode) on day 6 (found since `9ffb0274`, below). Two
// tank corps and four tank brigades of one stack go to the block of one Polish division; a
// brigade's block is 7 by 4 elements and a corps' 11 by 5, and each line stood a block of its own behind and beside the line before it:
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
  // The Soviet armour in contact, and of it the formation with the most of the others within a cell.
  // Green at `896ff779`, red at `9ffb0274`: the rules between moved the stack's day. The war is
  // stepped a day at a time, within 30 days, to the first day the scene below is in the view at
  // 40 m/px: five armour formations in contact within a cell of one another (six on day 6 at
  // 3.11c1), ten pairs of Soviet formations in contact, and a pair not in contact (PLAN 7.4f38).
  type Armour = { id: number; x: number; y: number };
  const stepDay = (): Promise<Armour[]> =>
    page.evaluate(async (SOV) => {
      const { sim, view } = window.__warsim!;
      const templates = sim.mapLayers!.templates;
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      const found: Armour[] = [];
      for (const id of view!.formationsOf(SOV)) {
        const d = await sim.formation(id);
        if (!d?.engaged || templates[d.template]?.symbol !== 'armour') continue;
        const [x, y] = view!.formationPos(id)!;
        found.push({ id, x, y });
      }
      return found;
    }, SOV);
  let centre: Armour = { id: 0, x: 0, y: 0 };
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
  // For every two formations of the section: how near an element of one stands to an element of the other.
  // Of the Soviet formations, those in contact: the stack's blocks (PLAN 6.9: marching formations
  // at one place came into the view when the world's course changed; their columns are another
  // matter, a line under PLAN 7.4).
  const readPairs = () => page.evaluate(async (SOV) => {
    const { sim } = window.__warsim!;
    const v = window.__warsim!.view!;
    const soviet = new Set<number>();
    const free = new Set<number>();
    for (const id of v.formationsOf(SOV)) {
      const d = await sim.formation(id);
      if (d?.engaged) soviet.add(id);
      else if (d) free.add(id);
    }
    const by = new Map<number, [number, number][]>();
    for (let i = 0; i < v.elementCount; i++) {
      const f = v.elementFormation[i]!;
      let list = by.get(f);
      if (!list) by.set(f, (list = []));
      list.push([v.elementX[i]!, v.elementY[i]!]);
    }
    const ids = [...by.keys()].sort((a, b) => a - b);
    const out: { a: number; b: number; soviet: boolean; free: boolean; least: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let least = Infinity;
        for (const p of by.get(ids[i]!)!) for (const q of by.get(ids[j]!)!) least = Math.min(least, Math.hypot(p[0] - q[0], p[1] - q[1]));
        out.push({ a: ids[i]!, b: ids[j]!, soviet: soviet.has(ids[i]!) && soviet.has(ids[j]!), free: free.has(ids[i]!) && free.has(ids[j]!), least });
      }
    }
    return { formations: ids.length, elements: v.elementCount, out };
  }, SOV);
  await page.evaluate(({ SOV, POL }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: SOV, defender: POL }), { SOV, POL });
  let armour: Armour[] = [];
  let pairs: Awaited<ReturnType<typeof readPairs>> | null = null;
  let day = 0;
  const near = (a: Armour): number => armour.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 1).length;
  while (pairs === null && day < 30) {
    day++;
    armour = await stepDay();
    if (armour.length === 0) continue;
    centre = armour.reduce((best, a) => (near(a) > near(best) ? a : best));
    if (near(centre) < 5) continue;
    await goTo(40);
    const seen = await readPairs();
    if (seen.out.filter((p) => p.soviet).length >= 10 && seen.out.some((p) => p.free)) pairs = seen;
  }
  console.log(`seed 1212: the Soviet stack of armour in contact on day ${day}`);
  expect(pairs, 'the stack and a column in the view within 30 days').not.toBeNull();
  if (pairs === null) return;
  expect(armour.length, 'Soviet armour formations in contact').toBeGreaterThanOrEqual(4);
  expect(near(centre), 'armour formations of one stack').toBeGreaterThanOrEqual(4);
  const own = pairs.out.filter((p) => p.soviet);
  expect(pairs.formations, 'formations with elements in the view at 40 m/px').toBeGreaterThanOrEqual(6);
  expect(own.length, 'pairs of Soviet formations in contact in the view').toBeGreaterThanOrEqual(10);
  const nearest = own.reduce((best, p) => (p.least < best.least ? p : best));
  info.annotations.push({ type: 'stack', description: `${pairs.formations} formations, ${pairs.elements} elements; the two Soviet blocks nearest each other (${nearest.a}, ${nearest.b}): ${(nearest.least * 19.57).toFixed(2)} km between their nearest elements` });
  console.log(info.annotations.at(-1)!.description);
  // Two blocks a gap apart on one line have their nearest elements the gap and a slot apart
  // (1.57 km); in one another, less than a slot (0.29 km on the rule before). The stack's
  // formations stand up to 0.03 cells from each other, so their lines to the Pole differ by a
  // degree or two and a corner comes a little nearer: the gap is asked, not the slot more.
  for (const p of own) expect(p.least, `formations ${p.a} and ${p.b}`).toBeGreaterThan(GAP);
  expect(nearest.least).toBeLessThan(GAP + 2 * SPACING);
  // PLAN 7.4f38: the Soviet formations in the view not in contact, columns of one place among
  // them (formations 52 and 57, one template, marched from one point with their elements in the
  // same places): no two with elements nearer than a slot. They stand as a file abreast.
  const columns = pairs.out.filter((p) => p.free);
  console.log(`Soviet formations not in contact, pairs in the view: ${columns.length}; nearest ${Math.min(...columns.map((p) => p.least)).toFixed(3)} cells`);
  expect(columns.length, 'pairs of Soviet formations not in contact in the view').toBeGreaterThan(0);
  for (const p of columns) expect(p.least, `formations ${p.a} and ${p.b}, not in contact`).toBeGreaterThan(SPACING);

  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-40m.png') });
  await goTo(12);
  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-12m.png') });
  await goTo(4);
  await page.screenshot({ path: path.join(out, 'c1-stack-of-armour-4m.png') });

  // PLAN 3.11c4: within a block in contact the elements stood on the points of a lattice and
  // all faced one way (`critic/shots/c3j_12_tank_live_006m_2.png`, `c3j_12_tank_live_002m_2.png`).
  // Each is now turned off its block's facing by its id: of the stack's middle formation, the
  // hulls in the view at the critic's two zooms are not at one facing.
  for (const m of [6, 2]) {
    await goTo(m);
    const hulls = await page.evaluate((id) => {
      const v = window.__warsim!.view!;
      const out: number[] = [];
      for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) out.push(v.elementFacing(i));
      return out;
    }, centre.id);
    expect(hulls.length, `elements of formation ${centre.id} in the section at ${m} m/px`).toBeGreaterThan(20);
    const spread = Math.max(...hulls) - Math.min(...hulls);
    console.log(`at ${m} m/px: ${hulls.length} elements of formation ${centre.id}, ${new Set(hulls).size} facings over ${spread.toFixed(2)} rad`);
    expect(new Set(hulls).size, `facings of the elements of formation ${centre.id} at ${m} m/px`).toBeGreaterThan(hulls.length / 2);
    // No further apart than twice the most an element is turned (`DEPLOY_TURN`, 0.3 rad): the block still faces its enemy.
    expect(spread).toBeGreaterThan(0.3);
    expect(spread).toBeLessThanOrEqual(0.6 + 1e-6);
    await page.screenshot({ path: path.join(out, `c4-within-a-block-${m}m.png`) });
  }
});

// PLAN 3.11c2: the critic's other game (seed 4242, Germany against Poland by God Mode) on day 21.
// German division 3 and Polish division 550 are each other's nearest and stand front to front.
// German division 4 comes to the Pole's block from 72° off the way it faces, its flank: it
// stopped a block's depth from the block's middle and stood in it (their middles 0.17 cells
// apart, a block being 0.24 wide) and in division 3's block. It now stops the gap short of both.
// Since the air AI the game is another, and those three are not in contact on day 21: the case
// is found in Node, the first day from day 14 with one (`flankCase`, PLAN 5.8w11).
test('a block that comes to an enemy block from its flank stands in neither it nor the block it faces', async ({ page }, info) => {
  test.setTimeout(300_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const GER = nation('GER');
  const flank = flankCase(14, 45);
  const [FACED, COMER, POLE] = [flank.faced, flank.comer, flank.pole];
  console.log(`day ${flank.day}: Polish ${POLE} faces German ${FACED}; German ${COMER} comes to it ${flank.angle.toFixed(0)}° off the way it faces`);
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=4242');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async ({ GER, POL, days }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
    let tick = 0;
    for (let d = 0; d < days; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { GER, POL, days: flank.day });

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
  // The comer has come up to the block. It stops the gap short of the nearest block in its way,
  // and that may be the block the Pole faces, which stands the gap from the Pole's and reaches
  // no further along the comer's line than its own diagonal (8 by 4 slots): two gaps and a
  // diagonal at most between the comer and the Pole. Not a count of slots: where an element
  // stands within its block is not what is asked here.
  expect(least.find((p) => p.a === COMER && p.b === POLE)!.least).toBeLessThan(2 * GAP + Math.hypot(8 * SPACING, 4 * SPACING));

  await page.screenshot({ path: path.join(out, 'c2-from-the-flank-20m.png') });
  await goTo(8);
  await page.screenshot({ path: path.join(out, 'c2-from-the-flank-8m.png') });
});
