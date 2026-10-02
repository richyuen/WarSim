import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CAPITAL_SCORE, PUPPET_SCORE, TRUCE_TICKS } from '../../src/sim/systems/war';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.16: declaration, war score, exhaustion, peace settlement, broke/exhausted sue for
// peace, fightToDeath. AT: scripted scenarios end in peace with the expected terms;
// fightToDeath never accepts peace.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

function events(s: Sim, ticks: number): number[][] {
  const out: number[][] = [];
  s.step(ticks, (w) => {
    for (let i = 0; i < w.out.events.length; i += 6) out.push(w.out.events.slice(i, i + 6));
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  return out;
}
const ofKind = (ev: number[][], k: number): number[][] => ev.filter((e) => e[1] === k).map((e) => [e[2]!, e[3]!]);

/**
 * A sim at war GER→POL, one on one (declared by command, applied at tick 0). The terms tests
 * isolate the pair from alliances and guarantees (PLAN 1.17), whose members would join.
 */
function atWar(seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  for (const n of [GER, POL]) {
    s.world.alliances.leave(n);
    s.world.alliances.guarantees = s.world.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
  }
  s.command({ kind: 'declareWar', attacker: GER, defender: POL });
  return s;
}

/** Polish cells sorted west to east (then by id). */
function polishCellsWestFirst(w: World): number[] {
  const out: number[] = [];
  w.cells.owner.forEach((o, c) => o === POL && out.push(c));
  return out.sort((a, b) => (a % W) - (b % W) || a - b);
}

/** Germany occupies the westernmost `share` of Poland (no capital captures: Warsaw excluded). */
function occupyWest(w: World, share: number): number[] {
  const cells = polishCellsWestFirst(w);
  let warsaw = -1;
  w.cities.forEach((id) => {
    if (w.cities.cols.capitalOf[id] === POL) warsaw = w.cities.cols.cell[id]!;
  });
  const taken = cells.slice(0, Math.round(cells.length * share)).filter((c) => c !== warsaw);
  for (const c of taken) w.setController(c, GER);
  return taken;
}

describe('wars and peace (PLAN 1.16)', () => {
  it('a declaration starts a war with puppets on their leaders’ sides; invalid ones are rejected', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const puppet = NATIONS_1938.findIndex((n) => n.overlord !== undefined) + 1;
    const overlord = nationId(NATIONS_1938[puppet - 1]!.overlord!.tag);
    s.command({ kind: 'declareWar', attacker: overlord, defender: POL === overlord ? GER : POL });
    s.command({ kind: 'declareWar', attacker: GER, defender: GER });
    s.command({ kind: 'declareWar', attacker: puppet, defender: overlord });
    const ev = events(s, 1);
    expect(ofKind(ev, EventKind.WarDeclared).length).toBe(1);
    expect(ofKind(ev, EventKind.WarRejected)).toEqual([
      [GER, GER],
      [puppet, overlord],
    ]);
    const war = s.world.wars.list.at(-1)!;
    expect(war.sides[0]![0]).toBe(overlord);
    expect(war.sides[0]).toContain(puppet);
    expect(s.world.wars.atWar(puppet, war.sides[1]![0]!)).toBe(true);
    // A second declaration on the same pair is rejected.
    s.command({ kind: 'declareWar', attacker: overlord, defender: war.sides[1]![0]! });
    expect(ofKind(events(s, 1), EventKind.WarRejected).length).toBe(1);
  });

  it('crushed: 60% of Poland occupied → Poland sues; Germany annexes all it holds and Poland becomes a puppet', () => {
    const s = atWar();
    s.step(24); // declared at tick 0; occupy just before the 00:00 assessment at tick 24
    const taken = occupyWest(s.world, 0.6);
    const ev = events(s, 1); // the 00:00 assessment
    const w = s.world;
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    expect(w.wars.atWar(GER, POL)).toBe(false);
    for (const c of taken) expect([w.cells.owner[c], w.cells.controller[c]]).toEqual([GER, GER]);
    expect(w.nations.cols.overlord[POL]).toBe(GER);
    expect(w.nations.cols.living[POL]).toBe(1);
    // Truce: no new war between them for two years.
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    expect(ofKind(events(s, 1), EventKind.WarRejected).length).toBe(1);
    expect(w.wars.truces.at(-1)!.untilTick).toBe(24 + TRUCE_TICKS); // signed at tick 24
  });

  it('broke defender at score 40: Germany annexes 40% of what it occupies, nearest its border first; the rest reverts', () => {
    const s = atWar();
    s.step(24); // occupy just before the 00:00 assessment at tick 24 (front flips need 16 h)
    const w = s.world;
    const taken = occupyWest(w, 0.2); // score = 200 × 0.2 = 40
    w.nations.cols.gold[POL] = -1e9; // broke
    const ev = events(s, 1);
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    const annexed = taken.filter((c) => w.cells.owner[c] === GER);
    const kept = taken.filter((c) => w.cells.owner[c] === POL);
    expect(annexed.length).toBe(Math.round(0.4 * taken.length));
    for (const c of kept) expect(w.cells.controller[c]).toBe(POL); // occupation reverted
    for (const c of annexed) expect(w.cells.controller[c]).toBe(GER);
    // Nearest first: annexed cells lie west of (or level with) the kept ones on average.
    const meanX = (cs: number[]): number => cs.reduce((a, c) => a + (c % W), 0) / cs.length;
    expect(meanX(annexed)).toBeLessThan(meanX(kept));
    expect(w.nations.cols.overlord[POL]).toBe(0); // below the puppet threshold
    expect(PUPPET_SCORE).toBeGreaterThan(40);
  });

  it('white peace: a broke attacker with a near-even score gives everything back', () => {
    const s = atWar();
    s.step(1);
    const w = s.world;
    const ownerBefore = new Uint16Array(w.cells.owner);
    const taken = occupyWest(w, 0.02); // score 4
    w.nations.cols.gold[GER] = -1e9;
    const ev = events(s, 24);
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    expect(w.cells.owner).toEqual(ownerBefore);
    for (const c of taken) expect(w.cells.controller[c]).toBe(POL);
  });

  it('fightToDeath never accepts peace, however crushed or broke', () => {
    const s = atWar();
    s.step(1);
    const w = s.world;
    const war = w.wars.list.find((x) => x.sides[0]![0] === GER && x.sides[1]![0] === POL)!;
    s.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
    occupyWest(w, 0.6);
    w.nations.cols.gold[POL] = -1e9;
    const ev = events(s, 24 * 60);
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([]);
    expect(w.wars.atWar(GER, POL)).toBe(true);
    expect(war.score).toBe(100);
    expect(war.exhaustion[1]).toBeGreaterThan(30);
  });

  it('capturing the capital swings the score; God Mode forces peace on the current score', () => {
    const s = atWar();
    s.step(1);
    const w = s.world;
    let warsaw = 0;
    w.cities.forEach((id) => {
      if (w.cities.cols.capitalOf[id] === POL) warsaw = id;
    });
    s.command({ kind: 'paintControl', nation: GER, x: w.cities.cols.x[warsaw]!, y: w.cities.cols.y[warsaw]!, r: 0 });
    s.step(23);
    const war = w.wars.list.find((x) => x.sides[0]![0] === GER)!;
    expect(war.capitalBonus).toBe(CAPITAL_SCORE);
    s.step(1); // 00:00 assessment
    expect(war.score).toBeGreaterThanOrEqual(CAPITAL_SCORE);
    s.command({ kind: 'forcePeace', war: war.id });
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, POL]]);
  });

  it('war records survive save/load into a live sim', () => {
    const run = (split: boolean): number => {
      const s = atWar(4);
      s.step(30);
      occupyWest(s.world, 0.1);
      if (!split) {
        s.step(60);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
      t.step(2);
      t.load(s.save());
      expect(t.world.wars.atWar(GER, POL)).toBe(true);
      t.step(60);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('the 1938 wars start as records with their fight-to-the-death sides', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const japan = s.world.wars.between(nationId('JAP'), nationId('CHI'))!;
    expect(japan.war.sides[0]).toEqual(['JAP', 'MAN', 'MEN'].map(nationId));
    expect(japan.war.fightToDeath[1]).toBe(true); // the CCP fights to the death
  });
});
