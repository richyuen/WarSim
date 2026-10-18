import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airAi, BOMB_SUPERIORITY, byIndustry, LIFT_BELOW } from '../../src/sim/ai/air';
import { kmFromBase, wingRange } from '../../src/sim/systems/air';
import { airSuperiority } from '../../src/sim/systems/airSuperiority';
import { deployOf, elementIndex, slotCount, withFreshDeployments } from '../../src/sim/systems/elements';
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
    // Over its men (PLAN 7.24d): the middle of its block deployed against the Polish division, a step toward it.
    const block = withFreshDeployments(w, () => deployOf(w, ger, slotCount(w, ger, elementIndex(w).get(ger)?.length ?? 0)))!;
    expect(block.x).toBeGreaterThan(c.x[ger]!);
    expect(block.x).toBeLessThan(c.x[pol]!);
    airAi(w);
    let over = 0;
    for (const id of wingsOf(w, GER, 'fighter_group')) {
      const m = w.wingMission.get(id);
      if (kmFromBase(w, id, c.x[ger]!, c.y[ger]!) > wingRange(w, id)) expect(m).toBeUndefined();
      else if (kmFromBase(w, id, block.x, block.y) <= wingRange(w, id)) {
        expect(m).toEqual({ kind: 'patrol', x: block.x, y: block.y });
        over++;
      } else expect(m).toEqual({ kind: 'patrol', x: c.x[ger], y: c.y[ger] });
    }
    expect(over).toBeGreaterThan(0);
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

// PLAN 5.8r: `byIndustry` keeps its order while the industry is unchanged. A change that keeps
// a weighted sum of it (two cells whose weights are equal, their industry swapped) is a change.
describe('the order of industry kept (PLAN 5.8r)', () => {
  it('a swap of two cells\' industry that keeps every sum of it is sorted again, as a loaded world sorts it', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const econ = w.cells.econ;
    // The richest cell, and one 9,973 cells on with other industry (given some, before the order is kept).
    let a = 0;
    for (let c = 0; c < econ.length; c++) if (econ[c]! > econ[a]!) a = c;
    const b = a + 9973 < econ.length ? a + 9973 : a - 9973;
    if (econ[b] === 0 || econ[b] === econ[a]) econ[b] = 1;
    expect(byIndustry(w)[0]).toBe(a);
    [econ[a], econ[b]] = [econ[b]!, econ[a]!];
    const fresh = [...econ.keys()].filter((c) => econ[c]! > 0).sort((x, y) => econ[y]! - econ[x]! || x - y);
    expect(byIndustry(w)).toEqual(fresh);
    expect(byIndustry(w)[0]).toBe(b);
  });
});

// PLAN 5.8u3a: the AI's transports fly supply to its own land formation short of it (under
// LIFT_BELOW) nearest their base within range; with none, no mission.
describe('the AI\'s transports (PLAN 5.8u3a)', () => {
  it('a German division short of supply on the front: Germany\'s transports fly supply to it; fed again, no mission', () => {
    const { w, ger, pol } = front();
    const lifts = wingsOf(w, GER, 'air_transport_group');
    expect(lifts.length).toBeGreaterThan(0);
    w.formations.cols.supply[ger] = LIFT_BELOW / 2;
    airAi(w);
    for (const id of lifts) {
      const m = w.wingMission.get(id);
      if (kmFromBase(w, id, FX, FY) > wingRange(w, id)) continue;
      expect(m).toEqual({ kind: 'supply', x: w.formations.cols.x[ger], y: w.formations.cols.y[ger] });
    }
    expect(lifts.some((id) => w.wingMission.get(id)?.kind === 'supply')).toBe(true);
    // Fed again, and a Polish one short beside it: no German transport's mission.
    w.formations.cols.supply[ger] = 1;
    w.formations.cols.supply[pol] = LIFT_BELOW / 2;
    w.tick += 24;
    airAi(w);
    for (const id of lifts) expect(w.wingMission.has(id)).toBe(false);
  });
});

// PLAN 5.8u3b: the AI's paradrops. A formation of infantry alone at an airbase with the
// transports to lift it, not on the front, is dropped on its nation's front formation nearest it.
describe('the AI\'s paradrops (PLAN 5.8u3b)', () => {
  /** The front, Germany's transport groups at one airbase, a German garrison brigade there. */
  function drop(groups: number): { w: World; ger: number; brigade: number } {
    const { w, ger } = front();
    const lifts = wingsOf(w, GER, 'air_transport_group');
    const base = w.wingBase.get(lifts[0]!)!;
    for (const id of lifts.slice(1)) w.wingBase.set(id, groups > 1 ? base : base === 1 ? 2 : 1);
    const brigade = addDivision(w, GER, ...w.cellPoint(w.airbases[base - 1]!.cell), TEMPLATES_1938.findIndex((t) => t.id === 'garrison_brigade'));
    return { w, ger, brigade };
  }

  it('a German garrison brigade at the transports\' airbase is dropped on the German division on the front; with one group, too few to lift it, it stays', () => {
    const { w, ger, brigade } = drop(2);
    const c = w.formations.cols;
    airAi(w);
    expect([c.x[brigade], c.y[brigade]]).toEqual(w.cellPoint(Math.floor(c.y[ger]!) * w.cells.w + Math.floor(c.x[ger]!)));
    const one = drop(1);
    const before = [one.w.formations.cols.x[one.brigade], one.w.formations.cols.y[one.brigade]];
    airAi(one.w);
    expect([one.w.formations.cols.x[one.brigade], one.w.formations.cols.y[one.brigade]]).toEqual(before);
    // No order the AI gives is refused.
    for (let i = 0; i < one.w.out.events.length; i += 6) expect(one.w.out.events[i + 1]).not.toBe(EventKind.MoveRejected);
  });
});
