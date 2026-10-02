import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_LAND, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { MANPOWER_CAP_SHARE, MANPOWER_MONTHLY_RATE, monthlyAccounts, runEconomyMonth, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { productionSystem, queueFormation, spawnPoint } from '../../src/sim/systems/production';
import { assets1938 } from '../helpers/earth';

// PLAN 1.10: production queue, recruitment and manpower. AT: a queued division appears after N
// days at the capital, with its cost deducted.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const sim1938 = (): Sim => new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });

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
    expect(w.formations.cols.strength[fid]).toBe(rule.strength);
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
});
