import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';

// PLAN 2.5 AT: elements killed at T2 take exactly as many men off the T0 counter. God Mode
// spawns a battle where nothing else stands (two Japanese divisions against a Chinese one in
// western China, the Japanese with an attack buff so that elements die within days). The
// element sprites are read at T2 and the counter at T0, before the fight, when the first elements
// have died, and when the Chinese division is gone. The men of an element are its units × the
// men per unit of its type: the units are the view's, the type table is the sim's in Node.

const { w: W } = SIZE_1938;
/** Western China: at the start no formation stands within 55 cells (checked below). */
const SITE = [1578.5, 338.5] as const;
const BOX = 6; // cells around the site: the spawned formations and their counters, nothing else
const ALONE = 30; // no other formation within this many cells, before and after
const T0_SCALE = 6; // px per cell: 3262 m/px, counters
const T2_M_PER_PX = 120;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const JAP = nation('JAP');
const CHI = nation('CHI');
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false }, // or they march off
  { kind: 'setAi', nation: CHI, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1], strength: 0, template: INF },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1] + 0.6, strength: 0, template: INF },
  { kind: 'spawnFormation', nation: CHI, x: SITE[0] + 1, y: SITE[1], strength: 0, template: INF },
];
const buffs = (japanese: readonly number[]): Command[] => japanese.map((f) => ({ kind: 'grantBuff', targetKind: 'formation', target: f, buff: 'attack', magnitude: 20, hours: 24 * 30, nameKey: 'buff.god' }));

interface El {
  id: number;
  f: number;
  units: number;
}

/** The same battle in Node: who fights, what each element is, and when to look. */
function nodeBattle(): { ids: number[]; japanese: number[]; chinese: number; unitOf: Map<number, number>; menPerUnit: number[]; firstDeaths: number; wipedOut: number; hashes: number[]; elements: El[][] } {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const w = sim.world;
  const fc = w.formations.cols;
  for (const c of SETUP) sim.command(c);
  sim.step(1);
  const ids = w.formations.ids().filter((f) => Math.abs(fc.x[f]! - SITE[0]) <= BOX && Math.abs(fc.y[f]! - SITE[1]) <= BOX);
  const japanese = ids.filter((f) => fc.nation[f] === JAP);
  const chinese = ids.find((f) => fc.nation[f] === CHI)!;
  const unitOf = new Map<number, number>();
  const read = (): El[] => ids.flatMap((f) => (elementIndex(w).get(f) ?? []).map((id) => ({ id, f, units: w.elements.cols.strength[id]! })));
  for (const f of ids) for (const e of elementIndex(w).get(f)!) unitOf.set(e, w.elements.cols.unit[e]!);
  const hashes = [sim.hash()];
  const elements = [read()];
  for (const c of buffs(japanese)) sim.command(c);
  // Hour by hour: the first hour by which three Chinese elements have died, and the hour the division is gone.
  let deaths = 0;
  let firstDeaths = 0;
  let hours = 0;
  while (w.formations.has(chinese) && hours < 24 * 20) {
    sim.step(1, (wd) => {
      for (let i = 0; i < wd.out.events.length; i += 6) if (wd.out.events[i + 1] === EventKind.ElementDestroyed && unitOf.has(wd.out.events[i + 2]!)) deaths++;
      wd.out.events.length = 0;
      wd.out.fires.length = 0;
    });
    hours++;
    if (firstDeaths === 0 && deaths >= 3 && w.formations.has(chinese)) {
      firstDeaths = hours;
      hashes.push(sim.hash());
      elements.push(read());
    }
  }
  hashes.push(sim.hash());
  elements.push(read());
  return { ids, japanese, chinese, unitOf, menPerUnit: w.rules!.units.map((u) => u.menPerUnit), firstDeaths, wipedOut: hours, hashes, elements };
}

/** Men per formation as the sim counts them: Σ units × men per unit over its elements in id order, rounded. */
function menOf(els: readonly El[], unitOf: Map<number, number>, menPerUnit: readonly number[]): Map<number, number> {
  const sum = new Map<number, number>();
  for (const e of [...els].sort((a, b) => a.id - b.id)) sum.set(e.f, (sum.get(e.f) ?? 0) + e.units * menPerUnit[unitOf.get(e.id)!]!);
  return new Map([...sum].map(([f, m]) => [f, Math.round(m)]));
}
const total = (m: Map<number, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

/** T2 on the site: the element sprites of the formations there, as the view has them. */
async function sprites(page: Page): Promise<El[]> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: SITE[0], y: SITE[1], m: T2_M_PER_PX });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    return v.subscription?.tier === 2 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.elementCount > 0;
  }, { x: SITE[0], y: SITE[1] }, { timeout: 15_000 });
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    return Array.from(v.elementId, (id, i) => ({ id, f: v.elementFormation[i]!, units: v.elementStrength[i]! }));
  });
}

/** T0 on the site, at rest: the counters standing there and what they say. */
async function counters(page: Page): Promise<{ strength: number; others: number; text: string; alpha: number }[]> {
  await page.evaluate(({ x, y, scale }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale });
    v.draw();
  }, { x: SITE[0], y: SITE[1], scale: T0_SCALE });
  await page.waitForFunction(() => !window.__warsim!.view!.unitsAnimating());
  return page.evaluate(({ x, y, box }) => {
    const v = window.__warsim!.view!;
    v.draw();
    return v.counters.drawn.filter((d) => Math.abs(d.wx - x) <= box && Math.abs(d.wy - y) <= box).map((d) => ({ strength: d.strength, others: d.others, text: d.text, alpha: d.alpha }));
  }, { x: SITE[0], y: SITE[1], box: BOX });
}

test('casualties are the same at every tier: elements lost at T2 take exactly their men off the T0 counter', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = nodeBattle();
  expect(node.ids).toHaveLength(3);
  expect(node.japanese).toHaveLength(2);
  expect(node.firstDeaths).toBeGreaterThan(0);
  expect(node.wipedOut).toBeGreaterThan(node.firstDeaths);
  // "Exactly" needs the rounding of the sim: a gun crew is not a whole number of men.
  expect(node.menPerUnit.some((m) => !Number.isInteger(m))).toBe(true);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.5') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const crop = { x: 550, y: 300, width: 300, height: 200 }; // the site, at the centre of the view

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
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
  /** The formations in the box and the distance from the site to the nearest one outside it. */
  const around = (): Promise<{ inside: { id: number; nation: number; strength: number }[]; nearest: number }> =>
    page.evaluate(async ({ x, y, box }) => {
      const all = (await window.__warsim!.sim.inspect(true)).formations;
      const inBox = (f: { x: number; y: number }): boolean => Math.abs(f.x - x) <= box && Math.abs(f.y - y) <= box;
      return { inside: all.filter(inBox).map((f) => ({ id: f.id, nation: f.nation, strength: f.strength })), nearest: Math.min(...all.filter((f) => !inBox(f)).map((f) => Math.hypot(f.x - x, f.y - y))) };
    }, { x: SITE[0], y: SITE[1], box: BOX });

  // God spawns the battle. The same commands at the same ticks as in Node: the same world.
  expect(await run(SETUP, 1)).toEqual({ tick: 1, hash: node.hashes[0] });
  const start = await around();
  expect(start.inside.map((f) => f.id)).toEqual(node.ids);
  expect(start.nearest).toBeGreaterThan(ALONE);

  const moments = [
    { name: 'before the fight', cmds: buffs(node.japanese), hours: 0, tag: 'before' },
    { name: 'the first elements dead', cmds: [], hours: node.firstDeaths, tag: 'deaths' },
    { name: 'the Chinese division gone', cmds: [], hours: node.wipedOut - node.firstDeaths, tag: 'wiped-out' },
  ];
  let tick = 1;
  let last: { men: Map<number, number>; counter: number; ids: Set<number> } | null = null;
  for (const [i, m] of moments.entries()) {
    // At T2, so that the ends of the elements reach the view; the buff is queued before the fight.
    await sprites(page);
    if (m.hours > 0) expect(await run(m.cmds, m.hours), m.name).toEqual({ tick: (tick += m.hours), hash: node.hashes[i] });
    else await page.evaluate((cmds) => cmds.forEach((c) => window.__warsim!.sim.command(c)), m.cmds);
    const els = await sprites(page);
    await page.evaluate(() => window.__warsim!.view!.draw());
    await page.screenshot({ path: path.join(out, `t2-${m.tag}.png`) });
    // The sprites are the sim's elements, unit for unit.
    expect([...els].sort((a, b) => a.id - b.id), m.name).toEqual(node.elements[i]);
    const men = menOf(els, node.unitOf, node.menPerUnit);
    // The strategic number of each formation is what its sprites add up to.
    const here = await around();
    expect(here.nearest, m.name).toBeGreaterThan(ALONE);
    expect(new Map(here.inside.map((f) => [f.id, f.strength])), m.name).toEqual(men);

    // T0: the counters on the site say that many men, in full.
    const shown = await counters(page);
    await page.screenshot({ path: path.join(out, `t0-${m.tag}.png`), clip: crop });
    expect(shown.length, m.name).toBeGreaterThan(0);
    expect(shown.map((c) => c.alpha), m.name).toEqual(shown.map(() => 1));
    const counter = shown.reduce((a, c) => a + c.strength, 0);
    expect(counter, m.name).toBe(total(men));

    const ids = new Set(els.map((e) => e.id));
    if (last) {
      // The AT: what the T0 counter lost is what the elements lost at T2, to the man.
      const lostAtT2 = [...last.men].reduce((a, [f, was]) => a + was - (men.get(f) ?? 0), 0);
      const dead = [...last.ids].filter((id) => !ids.has(id));
      console.log(`${m.name}: ${dead.length} elements died; T2 lost ${lostAtT2} men, the T0 counter went ${last.counter} → ${counter} (${shown.map((c) => `"${c.text}"${c.others ? ` +${c.others}` : ''}`).join(', ')})`);
      expect(dead.length, m.name).toBeGreaterThanOrEqual(3);
      expect(lostAtT2, m.name).toBeGreaterThan(0);
      expect(last.counter - counter, m.name).toBe(lostAtT2);
    }
    last = { men, counter, ids };
  }
  // The Chinese division is gone from both tiers; the Japanese are still there.
  expect([...last!.men.keys()].sort((a, b) => a - b)).toEqual(node.japanese);
});
