import { describe, expect, it } from 'vitest';
import { ECONOMY_TABLES_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { kmFromBase, orderMission, wingRange } from '../../src/sim/systems/air';
import { BOMB_CELLS, BOMB_DAMAGE, bombIndustry, REPAIR_DAILY, repairSystem } from '../../src/sim/systems/bombing';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.5a, the AT of 5.5: bombed industry produces less until repaired. A strike drops its
// aircraft's bombs on the enemy's industry within reach: the cells there share them by their
// industry, each out of work by the same share; the monthly income takes it off; repaired by
// REPAIR_DAILY a day.

const [GER, FRA, SOV] = ['GER', 'FRA', 'SOV'].map(nationId) as [number, number, number];
/** The 1938 world with the AI off: the missions here are the test's, not the air AI's (PLAN 5.6). */
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
const wingOf = (w: World, nation: number, t: string): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)![0];
/** The German cell of the most industry within `km` of wing `wing`'s base: its place. */
function richest(w: World, wing: number, km: number): [number, number] {
  const { w: W, econ, controller } = w.cells;
  let best = -1;
  for (let c = 0; c < econ.length; c++) {
    if (controller[c] !== GER || (best >= 0 && econ[c]! <= econ[best]!)) continue;
    if (kmFromBase(w, wing, (c % W) + 0.5, Math.floor(c / W) + 0.5) < km) best = c;
  }
  return [(best % W) + 0.5, Math.floor(best / W) + 0.5];
}
const gross = (w: World, n: number): number => monthlyAccounts(w, ECONOMY_TABLES_1938).gross[n]!;
/** The enemy's industry about (x, y), Σ econ, and its cells. */
function about(w: World, x: number, y: number, enemy: number): { total: number; cells: number[] } {
  const out = { total: 0, cells: [] as number[] };
  for (let dy = -BOMB_CELLS; dy <= BOMB_CELLS; dy++)
    for (let dx = -BOMB_CELLS; dx <= BOMB_CELLS; dx++) {
      const c = (Math.floor(y) + dy) * w.cells.w + Math.floor(x) + dx;
      if (w.cells.controller[c] === enemy && w.cells.econ[c]! > 0) {
        out.total += w.cells.econ[c]!;
        out.cells.push(c);
      }
    }
  return out;
}

describe('strategic bombing of industry (PLAN 5.5a)', () => {
  it('the bombs: a French strategic bomber group drops 60 tons, the German industry about its target out of work by 120 $M over its whole', () => {
    const w = sim().world;
    w.wars.start([FRA], [GER], 0);
    const wing = wingOf(w, FRA, 'strategic_bomber_group');
    const [x, y] = richest(w, wing, wingRange(w, wing));
    const { total, cells } = about(w, x, y, GER);
    expect(cells.length).toBeGreaterThan(0);
    expect(bombIndustry(w, wing, x, y)).toBe(24 * 2.5);
    for (const c of cells) expect(w.bombDamage.get(c)).toBeCloseTo((60 * BOMB_DAMAGE) / total, 12);
    expect(w.bombDamage.size).toBe(cells.length);
    // A fighter group has no bombs; a nation at peace's industry is no target; its own neither.
    const v = sim().world;
    v.wars.start([FRA], [GER], 0);
    expect(bombIndustry(v, wingOf(v, FRA, 'fighter_group'), x, y)).toBe(0);
    expect(bombIndustry(v, wingOf(v, SOV, 'strategic_bomber_group'), x, y)).toBe(0);
    expect(v.bombDamage.size).toBe(0);
  });

  it('the AT: bombed industry produces less until repaired', () => {
    const w = sim().world;
    w.wars.start([FRA], [GER], 0);
    const wing = wingOf(w, FRA, 'strategic_bomber_group');
    const [x, y] = richest(w, wing, wingRange(w, wing));
    const before = gross(w, GER);
    const { total } = about(w, x, y, GER);
    // Ten raids.
    for (let k = 0; k < 10; k++) bombIndustry(w, wing, x, y);
    const bombed = gross(w, GER);
    // Germany's income is short by the industry out of work, 10 raids × 120 $M, of its land's.
    const lost = (10 * 60 * BOMB_DAMAGE) / total;
    expect(lost).toBeLessThan(0.9);
    let land = 0;
    for (let c = 0; c < w.cells.econ.length; c++) if (w.cells.controller[c] === GER) land += w.cells.owner[c] === GER ? w.cells.econ[c]! : w.cells.econ[c]! / 2;
    expect((before - bombed) / before).toBeCloseTo((10 * 60 * BOMB_DAMAGE) / land, 9);
    // A day: repaired by REPAIR_DAILY of the damage.
    const d0 = [...w.bombDamage.values()][0]!;
    w.tick = 24;
    repairSystem(w);
    expect([...w.bombDamage.values()][0]).toBeCloseTo(d0 * (1 - REPAIR_DAILY), 12);
    expect(gross(w, GER)).toBeGreaterThan(bombed);
    // An hour that is not a day's first repairs nothing.
    w.tick = 25;
    repairSystem(w);
    expect([...w.bombDamage.values()][0]).toBeCloseTo(d0 * (1 - REPAIR_DAILY), 12);
    // A year on, repaired: the damage gone from the state, the income what it was.
    for (let d = 2; d <= 400; d++) {
      w.tick = 24 * d;
      repairSystem(w);
    }
    expect(w.bombDamage.size).toBe(0);
    expect(gross(w, GER)).toBe(before);
  });

  it('in the game: a strike ordered on the Ruhr bombs it; saved, the same game', () => {
    const s = sim();
    const w = s.world;
    w.wars.start([FRA], [GER], 0);
    const wing = wingOf(w, FRA, 'strategic_bomber_group');
    const [x, y] = richest(w, wing, wingRange(w, wing));
    expect(orderMission(w, wing, 'strike', x, y)).toBe(0);
    s.step(24);
    expect(w.bombDamage.size).toBeGreaterThan(0);
    const u = sim();
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    expect([...u.world.bombDamage].sort((a, b) => a[0] - b[0])).toEqual([...w.bombDamage].sort((a, b) => a[0] - b[0]));
    s.step(30);
    u.step(30);
    expect(u.hash()).toBe(s.hash());
  });
});
