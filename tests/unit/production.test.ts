import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { maskSure } from '../../src/shared/landMask';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_LAND, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { MANPOWER_CAP_SHARE, MANPOWER_MONTHLY_RATE, monthlyAccounts, runEconomyMonth, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { elementIndex, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { cityStand, musterPoint, productionSystem, queueFormation, spawnPoint } from '../../src/sim/systems/production';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 1.10: production queue, recruitment and manpower. AT: a queued division appears after N
// days at the capital, with its cost deducted.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
/** A 1938 sim with the AI off, so only production changes the formations (PLAN 1.24–1.25). */
const sim1938 = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};

/** Events of `kind` emitted while stepping `n` ticks. */
function stepCollect(sim: Sim, n: number, kind: number): number[][] {
  const out: number[][] = [];
  sim.step(n, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === kind) out.push(ev.slice(i, i + 6));
    w.out.events.length = 0;
  });
  return out;
}

describe('production (PLAN 1.10 AT)', () => {
  it('a queued infantry division costs gold and manpower at once and appears at Berlin after its training days', () => {
    // A twin sim without the order isolates the order's cost from the monthly economy.
    const sim = sim1938();
    const twin = sim1938();
    const w = sim.world;
    const nc = w.nations.cols;
    const rule = RULES_1938.templates[INF]!;
    expect(rule.days).toBe(90);
    const formations = w.formations.count;
    sim.command({ kind: 'queueFormation', nation: GER, template: INF });
    expect(stepCollect(sim, 1, EventKind.ProductionQueued)).toHaveLength(1);
    twin.step(1);
    expect(twin.world.nations.cols.gold[GER]! - nc.gold[GER]!).toBeCloseTo(rule.gold, 6);
    expect(twin.world.nations.cols.manpower[GER]! - nc.manpower[GER]!).toBeCloseTo(rule.manpower, 6);
    expect(w.production.count).toBe(1);

    // Run up to (not including) 00:00 of day 90.
    expect(stepCollect(sim, rule.days * 24 - 1, EventKind.FormationSpawned)).toEqual([]);
    expect(w.formations.count).toBe(formations);

    const spawned = stepCollect(sim, 1, EventKind.FormationSpawned);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]![0]).toBe(rule.days * 24); // queued at 00:00 on day 0, ready at 00:00 on day 90
    expect(w.production.count).toBe(0);
    expect(w.formations.count).toBe(formations + 1);
    const fid = spawned[0]![2]!;
    expect(w.formations.cols.nation[fid]).toBe(GER);
    expect(w.formations.cols.template[fid]).toBe(INF);
    expect(w.formations.cols.strength[fid]).toBe(ECONOMY_TABLES_1938.templateStrength[INF]); // full template men
    expect(elementIndex(w).get(fid)?.length).toBe(TEMPLATES_LAND[INF]!.elements.reduce((n, e) => n + e.count, 0)); // equipped
    expect([w.formations.cols.x[fid], w.formations.cols.y[fid]]).toEqual([nc.capitalX[GER], nc.capitalY[GER]]);
    // Day 90 is 1 April: production runs before the economy, so the new division already pays its
    // first month of upkeep. The twin is richer by exactly the order cost plus that upkeep.
    twin.step(rule.days * 24);
    const upkeep = UPKEEP_SCALE * ECONOMY_TABLES_1938.templateUpkeep[INF]!;
    expect(twin.world.nations.cols.gold[GER]! - nc.gold[GER]!).toBeCloseTo(rule.gold + upkeep, 4);
  });

  it('orders without enough gold or manpower are rejected and cost nothing', () => {
    const sim = sim1938();
    const nc = sim.world.nations.cols;
    nc.gold[GER] = 10;
    const gold = nc.gold[GER];
    expect(queueFormation(sim.world, GER, INF)).toBe(0);
    expect(nc.gold[GER]).toBe(gold);
    nc.gold[GER] = 1e9;
    nc.manpower[GER] = 100;
    expect(queueFormation(sim.world, GER, INF)).toBe(0);
    expect(queueFormation(sim.world, GER, 999)).toBe(0);
    expect(sim.world.production.count).toBe(0);
    expect(sim.world.out.events.filter((_, i) => i % 6 === 1 && sim.world.out.events[i] === EventKind.ProductionRejected).length).toBe(3);
  });

  it('bankruptcy stalls training; a lost capital moves the spawn to the nearest held cell', () => {
    const sim = sim1938();
    const w = sim.world;
    const id = queueFormation(w, GER, INF);
    const ready = w.production.cols.readyDay[id]!;
    w.nations.cols.bankrupt[GER] = 1;
    w.tick = 24;
    productionSystem(w);
    expect(w.production.cols.readyDay[id]).toBe(ready + 1);

    const nc = w.nations.cols;
    const capCell = Math.floor(nc.capitalY[GER]!) * w.cells.w + Math.floor(nc.capitalX[GER]!);
    w.cells.controller[capCell] = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
    const at = spawnPoint(w, GER)!;
    const cell = Math.floor(at[1]) * w.cells.w + Math.floor(at[0]);
    expect(w.cells.controller[cell]).toBe(GER);
    expect(cell).not.toBe(capCell);
  });

  it('manpower grows monthly from owned population, up to a cap', () => {
    const sim = sim1938();
    const w = sim.world;
    const { population } = monthlyAccounts(w, ECONOMY_TABLES_1938);
    expect(population[GER]! / 1e6).toBeGreaterThan(50); // Germany 1938: ~68 M people (pre-Anschluss)
    expect(population[GER]! / 1e6).toBeLessThan(90);
    const mp = w.nations.cols.manpower[GER]!;
    runEconomyMonth(w, ECONOMY_TABLES_1938);
    expect(w.nations.cols.manpower[GER]! - mp).toBeCloseTo(MANPOWER_MONTHLY_RATE * w.nations.cols.manpowerMult[GER]! * population[GER]!, 0);
    w.nations.cols.manpower[GER] = MANPOWER_CAP_SHARE * population[GER]! - 1;
    runEconomyMonth(w, ECONOMY_TABLES_1938);
    expect(w.nations.cols.manpower[GER]).toBeCloseTo(MANPOWER_CAP_SHARE * population[GER]!, 0);
  });

  it('queued production survives save/load and the run stays deterministic', () => {
    const a = sim1938();
    const b = sim1938();
    for (const s of [a, b]) s.command({ kind: 'queueFormation', nation: GER, template: INF });
    a.step(30 * 24);
    b.step(10 * 24);
    const c = sim1938();
    c.load(b.save());
    c.step(20 * 24);
    expect(c.hash()).toBe(a.hash());
  });

  it('overseas muster: Japan, at war in China, raises its divisions on the mainland; Germany at home', () => {
    const sim = sim1938();
    const w = sim.world;
    const JAP = NATIONS_1938.findIndex((n) => n.tag === 'JAP') + 1;
    const comp = navOf(w).grid.component;
    const cellAt = (p: [number, number]): number => Math.floor(p[1]) * w.cells.w + Math.floor(p[0]);
    expect(w.wars.list.some((x) => x.sides[0]!.includes(JAP))).toBe(true);
    const home = cellAt(spawnPoint(w, JAP)!);
    const at = cellAt(musterPoint(w, JAP)!);
    expect(comp[at]).not.toBe(comp[home]); // not on the home islands
    expect(w.cells.controller[at]).toBe(JAP);
    expect(musterPoint(w, GER)).toEqual(spawnPoint(w, GER)); // at peace
    // A front on the home landmass keeps the capital.
    const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
    w.wars.set(GER, POL, true);
    expect(musterPoint(w, GER)).toEqual(spawnPoint(w, GER));
  });

  // PLAN 2.11k (the fifth independent read, finding 3): PLAN 2.9a put every place a formation
  // takes on sure land, and missed this one. A muster in a theatre was placed at a city's own
  // place, or at a front cell's bare middle.
  it('a muster in a theatre stands on sure land, by a city on the shore; and so does the division raised there, with its elements', () => {
    const sim = sim1938();
    const w = sim.world;
    const { w: W, h: H } = SIZE_1938;
    const mask = w.landMask!;
    const sure = (x: number, y: number): boolean => maskSure(mask, W, H, x, y, true);
    const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
    // Japan, at war in China from the start, musters on the mainland.
    const jap = musterPoint(w, nation('JAP'))!;
    expect(sure(jap[0], jap[1]), `Japan's muster at ${jap[0].toFixed(3)}, ${jap[1].toFixed(3)}`).toBe(true);
    // Britain at war with Nationalist Spain: its front is at Gibraltar, and the city's own place is in a water pixel of the mask.
    const [ENG, NSP] = [nation('ENG'), nation('NSP')];
    const [gx, gy] = cellOf(-5.3781, 36.1324, W, H);
    expect(sure(gx, gy)).toBe(false);
    w.wars.set(ENG, NSP, true);
    w.frontier = null;
    const at = musterPoint(w, ENG)!;
    expect(Math.hypot(at[0] - gx, at[1] - gy), 'the muster is by Gibraltar').toBeLessThan(1.5);
    expect(sure(at[0], at[1]), `Britain's muster at ${at[0].toFixed(3)}, ${at[1].toFixed(3)}`).toBe(true);
    // The division raised there stands there, and none of its elements is in the sea.
    const before = new Set(w.formations.ids());
    expect(queueFormation(w, ENG, INF)).toBeGreaterThan(0);
    sim.step((RULES_1938.templates[INF]!.days + 1) * 24);
    const raised = w.formations.ids().filter((f) => !before.has(f) && w.formations.cols.nation[f] === ENG);
    expect(raised).toHaveLength(1);
    const f = raised[0]!;
    const fc = w.formations.cols;
    expect(Math.hypot(fc.x[f]! - gx, fc.y[f]! - gy)).toBeLessThan(1.5);
    expect(sure(fc.x[f]!, fc.y[f]!)).toBe(true);
    const els = elementIndex(w).get(f)!;
    expect(els.length).toBeGreaterThan(20);
    const slots = slotCount(w, f, els.length);
    const wet = els.filter((e) => {
      const [x, y] = slotPlace(w, fc.x[f]!, fc.y[f]!, fc.facing[f]!, w.elements.cols.slot[e]!, slots);
      return !sure(x, y);
    });
    expect(wet).toEqual([]);
  });

  // PLAN 3.12Rm (the ninth independent read, finding 4): PLAN 2.11k mended the fine mask's side
  // of a muster by a city, and left the grid's. A city's own place may lie over the water of
  // the cell beside its own (436 of the 5,757), a cell no route enters: a formation raised
  // there took no order (26 British formations on one point after three years of seed 77).
  it('a muster by a city is in a cell a route begins in: for every city of 1938, and for the division raised by one whose place is over the next cell', () => {
    const sim = sim1938();
    const w = sim.world;
    const W = w.cells.w;
    const comp = navOf(w).grid.component;
    const cc = w.cities.cols;
    const cellAt = (p: [number, number]): number => Math.floor(p[1]) * W + Math.floor(p[0]);
    const closed: number[] = [];
    const wet: number[] = [];
    const beside: number[] = [];
    w.cities.forEach((id) => {
      expect(comp[cc.cell[id]!], `city ${id}: its own cell`).not.toBe(0);
      const at = cityStand(w, id);
      if (comp[cellAt(at)] === 0) closed.push(id);
      if (!w.onLand(at[0], at[1])) wet.push(id);
      if (comp[cellAt([cc.x[id]!, cc.y[id]!])] === 0) beside.push(id);
    });
    expect(beside.length, 'cities whose own place is in a cell no route enters').toBeGreaterThan(400);
    expect(closed, 'cities whose muster is in a cell no route enters').toEqual([]);
    expect(wet, 'cities whose muster is not on sure land').toEqual([]);
    // One of them musters: its holder at war on that landmass alone, the front beside it.
    const fc = w.formations.cols;
    const id = beside.find((c) => w.cells.owner[cc.cell[c]!] === w.cells.controller[cc.cell[c]!] && NATIONS_1938[w.cells.owner[cc.cell[c]!]! - 1]?.tag === 'ENG' && comp[cc.cell[c]!] !== comp[cellAt(spawnPoint(w, w.cells.owner[cc.cell[c]!]!)!)])!;
    expect(id, 'a British city overseas whose place is over the next cell').toBeGreaterThan(0);
    const ENG = w.cells.owner[cc.cell[id]!]!;
    // The cell is made a front: its neighbour on its landmass goes to a nation Britain is at war with.
    const cell = cc.cell[id]!;
    const next = [cell - 1, cell + 1, cell - W, cell + W].find((n) => comp[n] === comp[cell])!;
    w.wars.set(ENG, GER, true);
    w.setController(next, GER);
    w.frontier = null;
    const at = musterPoint(w, ENG)!;
    expect(cellAt(at), `Britain's muster at ${at[0].toFixed(3)}, ${at[1].toFixed(3)}`).toBe(cell);
    const before = new Set(w.formations.ids());
    expect(queueFormation(w, ENG, INF)).toBeGreaterThan(0);
    sim.step((RULES_1938.templates[INF]!.days + 1) * 24);
    const raised = w.formations.ids().filter((f) => !before.has(f) && fc.nation[f] === ENG);
    expect(raised).toHaveLength(1);
    expect(comp[cellAt([fc.x[raised[0]!]!, fc.y[raised[0]!]!])], 'the cell the division stands in').not.toBe(0);
  });
});
