import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { wingAircraft } from '../../src/sim/systems/air';
import { airfield, productionSystem, queueFormation } from '../../src/sim/systems/production';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8s1: a wing is ordered as a land formation is, and delivered on its ready day at its
// nation's airbase with room for its aircraft nearest its capital, its base; with none, refused,
// and an order whose airbases were lost meanwhile waits for one.

const tag = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [GER, POL] = [tag('GER'), tag('POL')];
const FIGHTER = TEMPLATES_1938.findIndex((t) => t.id === 'fighter_group');
function sim(): { s: Sim; w: World } {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.settings.aiEnabled = false;
  const nc = w.nations.cols;
  [nc.gold[GER], nc.manpower[GER], nc.tech0[GER], nc.tech1[GER]] = [1e7, 1e7, 0xffffffff, 0xffffffff];
  return { s, w };
}
const rejected = (w: World): number => w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.ProductionRejected).length;
/** Runs the production of the day the row `id` is ready. */
const deliver = (w: World, id: number): void => {
  w.tick = w.production.cols.readyDay[id]! * 24;
  productionSystem(w);
};

describe('wings built (PLAN 5.8s1)', () => {
  it('a fighter group ordered by Germany is delivered at its airbase with room nearest Berlin, based there, at full strength', () => {
    const { w } = sim();
    const field = airfield(w, GER, FIGHTER);
    expect(field).toBeGreaterThanOrEqual(0);
    const b = w.airbases[field]!;
    expect(w.cells.controller[b.cell]).toBe(GER);
    let used = 0;
    for (const [o, base] of w.wingBase) if (base === field + 1) used += wingAircraft(w, w.formations.cols.template[o]!);
    expect(used + wingAircraft(w, FIGHTER)).toBeLessThanOrEqual(airbaseRoom(b));
    const gold = w.nations.cols.gold[GER]!;
    const id = queueFormation(w, GER, FIGHTER);
    expect(id).toBeGreaterThan(0);
    expect(w.nations.cols.gold[GER]).toBe(gold - w.rules!.templates[FIGHTER]!.gold);
    const before = new Set(w.formations.ids());
    w.out.events.length = 0;
    deliver(w, id);
    const made = [...w.formations.ids()].filter((f) => !before.has(f));
    expect(made).toHaveLength(1);
    const [wing] = made as [number];
    expect(w.isWing(wing)).toBe(true);
    expect(w.wingBase.get(wing)).toBe(field + 1);
    expect([w.formations.cols.x[wing], w.formations.cols.y[wing]]).toEqual(w.cellPoint(b.cell));
    expect(w.formations.cols.strength[wing]).toBeGreaterThan(0);
    expect(w.production.has(id)).toBe(false);
  });

  it('no airbase of its own with room: refused; its airbases lost before the day: the order waits, and is delivered with one again', () => {
    const { w } = sim();
    const own = w.airbases.map((_, i) => i).filter((i) => w.cells.controller[w.airbases[i]!.cell] === GER);
    for (const i of own) w.cells.controller[w.airbases[i]!.cell] = POL;
    w.out.events.length = 0;
    expect(airfield(w, GER, FIGHTER)).toBe(-1);
    expect(queueFormation(w, GER, FIGHTER)).toBe(0);
    expect(rejected(w)).toBe(1);
    for (const i of own) w.cells.controller[w.airbases[i]!.cell] = GER;
    const id = queueFormation(w, GER, FIGHTER);
    expect(id).toBeGreaterThan(0);
    for (const i of own) w.cells.controller[w.airbases[i]!.cell] = POL;
    const count = w.formations.count;
    deliver(w, id);
    expect(w.formations.count).toBe(count);
    expect(w.production.has(id)).toBe(true);
    for (const i of own) w.cells.controller[w.airbases[i]!.cell] = GER;
    w.tick += 24;
    productionSystem(w);
    expect(w.formations.count).toBe(count + 1);
    expect(w.production.has(id)).toBe(false);
  });
});
