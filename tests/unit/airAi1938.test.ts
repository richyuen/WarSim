import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airAi, BOMB_SUPERIORITY, byIndustry } from '../../src/sim/ai/air';
import { kmFromBase, wingRange } from '../../src/sim/systems/air';
import { airSuperiority } from '../../src/sim/systems/airSuperiority';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.6: the AI's air tasking, daily: fighters patrol over its own formations in contact,
// close support and tactical bombers strike the enemy's, strategic bombers bomb industry only
// where its side holds the air; at peace, no mission.

const [GER, POL, FRA] = ['GER', 'POL', 'FRA'].map(nationId) as [number, number, number];
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const wingsOf = (w: World, n: number, t: string): number[] => [...w.wingBase].filter(([id, b]) => b > 0 && w.formations.cols.nation[id] === n && tmpl(w, id) === t).map(([id]) => id);
const [FX, FY] = cellOf(17.0, 52.5, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
/** Germany and Poland at war, a German and a Polish division in contact on the border; the AI on for Germany alone. */
function front(): { w: World; ger: number; pol: number } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.nations.forEach((n) => (w.nations.cols.aiOff[n] = n === GER ? 0 : 1));
  w.wars.start([GER], [POL], 0);
  const ger = addDivision(w, GER, FX, FY);
  const pol = addDivision(w, POL, FX + 1, FY);
  w.formations.cols.engaged[ger] = 1;
  w.formations.cols.engaged[pol] = 1;
  return { w, ger, pol };
}

describe('the air AI (PLAN 5.6)', () => {
  it('fighters patrol over its own formation in contact, close support strikes the enemy\'s; out of range, none', () => {
    const { w, ger, pol } = front();
    const c = w.formations.cols;
    airAi(w);
    for (const id of wingsOf(w, GER, 'fighter_group')) {
      const m = w.wingMission.get(id);
      if (kmFromBase(w, id, c.x[ger]!, c.y[ger]!) <= wingRange(w, id)) expect(m).toEqual({ kind: 'patrol', x: c.x[ger], y: c.y[ger] });
      else expect(m).toBeUndefined();
    }
    const cas = wingsOf(w, GER, 'close_support_group');
    expect(cas.some((id) => w.wingMission.has(id))).toBe(true);
    for (const id of cas) if (w.wingMission.has(id)) expect(w.wingMission.get(id)).toEqual({ kind: 'strike', x: c.x[pol], y: c.y[pol] });
    // Poland's AI is off: its wings have none.
    for (const [id] of w.wingBase) if (c.nation[id] === POL) expect(w.wingMission.has(id)).toBe(false);
  });

  it('strategic bombers: none while no zone is held; once its side holds the air over the enemy\'s industry, the richest cell there in range', () => {
    const { w } = front();
    w.wars.start([GER], [FRA], 0);
    // Germany has no strategic bombers in 1938: one of its tactical groups made one.
    const heavy = TEMPLATES_1938.findIndex((t) => t.id === 'strategic_bomber_group');
    const wing = wingsOf(w, GER, 'tactical_bomber_group')[0]!;
    w.formations.cols.template[wing] = heavy;
    airAi(w);
    expect(w.wingMission.has(wing)).toBe(false);
    // Germany holds the air over a zone with French and Polish industry in range.
    const zones = airOf(w).zoneOf;
    const W = w.cells.w;
    const cell = byIndustry(w).find((k) => (w.cells.controller[k] === FRA || w.cells.controller[k] === POL) && kmFromBase(w, wing, (k % W) + 0.5, Math.floor(k / W) + 0.5) <= wingRange(w, wing))!;
    const zone = zones[cell]!;
    w.airPower.set(zone, new Map([[GER, 1000]]));
    expect(airSuperiority(w, GER, zone)).toBeGreaterThanOrEqual(BOMB_SUPERIORITY);
    airAi(w);
    const m = w.wingMission.get(wing)!;
    expect(m.kind).toBe('strike');
    expect(zones[Math.floor(m.y) * W + Math.floor(m.x)]).toBe(zone);
    // The richest enemy cell of that zone in range.
    expect(Math.floor(m.y) * W + Math.floor(m.x)).toBe(cell);
    // France flies as much there: a half, under the bar: no mission.
    w.airPower.get(zone)!.set(FRA, 1000);
    airAi(w);
    expect(w.wingMission.has(wing)).toBe(false);
  });

  it('at peace its wings have no mission; the order of the cells of industry is the industry\'s alone', () => {
    const { w } = front();
    airAi(w);
    expect(w.wingMission.size).toBeGreaterThan(0);
    for (const war of [...w.wars.list]) w.wars.end(war);
    airAi(w);
    expect([...w.wingMission.keys()].filter((id) => w.formations.cols.nation[id] === GER)).toEqual([]);
    const order = byIndustry(w);
    const econ = w.cells.econ;
    for (let i = 1; i < 200; i++) expect(econ[order[i - 1]!]! > econ[order[i]!]! || (econ[order[i - 1]!] === econ[order[i]!] && order[i - 1]! < order[i]!)).toBe(true);
  });
});
