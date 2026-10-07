import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CAPITAL_BONUS_MAX, CAPITAL_SCORE, CAPITULATE, MAX_WAR_DAYS, noteCapitalCaptured, PUPPET_SCORE, PUPPET_SHARE, REL_CAP, SMALL_STATE_KM2, TRUCE_TICKS } from '../../src/sim/systems/war';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds as ofKind, nationId, runEvents as events } from '../helpers/sim1938';

// PLAN 1.16: declaration, war score, exhaustion, peace settlement, broke/exhausted sue for
// peace, fightToDeath. AT: scripted scenarios end in peace with the expected terms;
// fightToDeath never accepts peace.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');
const SOV = nationId('SOV');
const FIN = nationId('FIN');
const BRA = nationId('BRA');
const USA = nationId('USA');

/**
 * A sim in which `a` and `b` stand alone (no alliance, guarantee, overlord or puppet) and `a` has
 * declared war on `b` (applied at tick 0), the AI off.
 */
function duel(a: number, b: number, seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  for (const n of [a, b]) {
    w.alliances.leave(n);
    w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    w.nations.cols.overlord[n] = 0;
  }
  // One on one: puppets would add their land to the sides.
  w.nations.forEach((n) => {
    if (w.nations.cols.overlord[n] === a || w.nations.cols.overlord[n] === b) w.nations.cols.overlord[n] = 0;
  });
  s.command({ kind: 'declareWar', attacker: a, defender: b });
  return s;
}

/** The cells `nation` owns, ordered by `key` (smallest first, then by cell). */
function cellsOf(w: World, nation: number, key: (c: number) => number): number[] {
  const out: number[] = [];
  w.cells.owner.forEach((o, c) => o === nation && out.push(c));
  return out.sort((p, q) => key(p) - key(q) || p - q);
}

/** Row of a cell: 0 is the northernmost. */
const rowOf = (c: number): number => Math.floor(c / W);

/** km² of `cells` in the sim's measure (whole km² per cell, by row). */
const km2Of = (w: World, cells: readonly number[]): number => cells.reduce((sum, c) => sum + w.landCounts().rowKm2[rowOf(c)]!, 0);

/** `nation` keeps the `keep` cells nearest its capital; the rest of its land goes to the United States. */
function shrinkToCapital(w: World, nation: number, keep: number): number[] {
  const cx = w.nations.cols.capitalX[nation]!;
  const cy = w.nations.cols.capitalY[nation]!;
  const cells = cellsOf(w, nation, (c) => ((c % W) + 0.5 - cx) ** 2 + (rowOf(c) + 0.5 - cy) ** 2);
  for (const c of cells.slice(keep)) {
    w.setOwner(c, USA);
    w.setController(c, USA);
  }
  return cells.slice(0, keep);
}


/**
 * A sim at war GER→POL, one on one (declared by command, applied at tick 0). The terms tests
 * isolate the pair from alliances and guarantees (PLAN 1.17), whose members would join.
 */
function atWar(seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (PLAN 1.24–1.25)
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

  it('broke defender at score 40: Germany annexes all it occupies; Poland stays independent (ADR-51)', () => {
    const s = atWar();
    s.step(24); // occupy just before the 00:00 assessment at tick 24 (front flips need 16 h)
    const w = s.world;
    const taken = occupyWest(w, 0.2); // score = 200 × 0.2 = 40
    const others = polishCellsWestFirst(w).filter((c) => w.cells.controller[c] === POL);
    w.nations.cols.gold[POL] = -1e9; // broke
    const ev = events(s, 1);
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    // Until ADR-51 the winner kept round(40% × occupied), nearest its border first.
    for (const c of taken) {
      expect(w.cells.owner[c]).toBe(GER);
      expect(w.cells.controller[c]).toBe(GER);
    }
    for (const c of others) expect(w.cells.owner[c]).toBe(POL);
    expect(w.nations.cols.overlord[POL]).toBe(0); // below the puppet threshold
    expect(PUPPET_SCORE).toBeGreaterThan(40);
  });

  it('the losers’ occupations of the winners revert at a peace the winners dictate (ADR-51)', () => {
    const s = atWar();
    s.step(24);
    const w = s.world;
    occupyWest(w, 0.2);
    // Poland holds a strip of Germany too: fewer cells than Germany holds of Poland.
    const german: number[] = [];
    w.cells.owner.forEach((o, c) => o === GER && w.cells.controller[c] === GER && german.push(c));
    const strip = german.sort((a, b) => (b % W) - (a % W) || a - b).slice(0, 50);
    for (const c of strip) w.setController(c, POL);
    w.nations.cols.gold[POL] = -1e9;
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    for (const c of strip) {
      expect(w.cells.owner[c]).toBe(GER);
      expect(w.cells.controller[c]).toBe(GER);
    }
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

  // Critic B1 (2026-10-03): wars against large nations must be winnable, and no war lasts forever.
  it('the score is relative to the smaller party: half of Germany\'s own size taken from the Soviet Union scores 50', () => {
    const s = duel(GER, SOV);
    const w = s.world;
    s.step(24);
    // Land is km² (ADR-57): the sizes are areas, and so is the half of Germany that is taken.
    const german = w.landCounts().owned[GER]!;
    const soviet = w.landCounts().owned[SOV]!;
    expect(soviet).toBeGreaterThan(REL_CAP * german);
    // Far-eastern Soviet cells (no capital, no armies in contact within the hour).
    const cells = cellsOf(w, SOV, (c) => -(c % W));
    const taken: number[] = [];
    for (let i = 0, km2 = 0; km2 < 0.5 * german; i++) {
      taken.push(cells[i]!);
      km2 += w.landCounts().rowKm2[rowOf(cells[i]!)]!;
    }
    for (const c of taken) w.setController(c, GER);
    s.step(1); // the 00:00 assessment
    const war = w.wars.between(GER, SOV)!.war;
    expect(km2Of(w, taken) / soviet).toBeLessThan(0.02); // by true share this was a white peace
    expect(war.score).toBeGreaterThanOrEqual(48); // 200 × (0.5 G) ÷ (REL_CAP × G) = 50, ± front flips
    expect(war.score).toBeLessThanOrEqual(52);
    // Peace on that score: Germany keeps what it took (ADR-51; half of it until then); the
    // Soviet Union stays independent.
    s.command({ kind: 'forcePeace', war: war.id });
    s.step(1);
    const kept = taken.filter((c) => w.cells.owner[c] === GER).length;
    expect(kept).toBe(taken.length);
    expect(w.nations.cols.overlord[SOV]).toBe(0);
  });

  // PLAN 1.42e, ADR-57: every land share of a war is a share of km², not of cells. The Soviet far
  // north is where the two differ most: its cells cover a third of the ground of German ones.
  it('the score counts km²: Arctic cells numbering half of the German cells score far below 50', () => {
    const s = duel(GER, SOV);
    const w = s.world;
    s.step(24);
    const taken = cellsOf(w, SOV, rowOf).slice(0, Math.round(0.5 * w.nations.cols.cells[GER]!));
    for (const c of taken) w.setController(c, GER);
    s.step(1); // the 00:00 assessment
    const war = w.wars.between(GER, SOV)!.war;
    const byArea = (200 * km2Of(w, taken)) / (REL_CAP * w.landCounts().owned[GER]!);
    expect(byArea).toBeLessThan(25); // by cells: 200 × 0.5 ÷ REL_CAP = 50
    expect(Math.abs(war.score - byArea)).toBeLessThanOrEqual(2); // ± front flips
  });

  it('capitulation counts km²: the northern three quarters of the Soviet cells are not three quarters of its land', () => {
    const s = duel(GER, SOV);
    const w = s.world;
    s.step(1);
    const war = w.wars.between(GER, SOV)!.war;
    s.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
    s.step(23); // occupy just before the 00:00 assessment at tick 24
    const north = cellsOf(w, SOV, rowOf);
    const soviet = w.landCounts().owned[SOV]!;
    const first = north.slice(0, Math.round((CAPITULATE + 0.03) * north.length));
    for (const c of first) w.setController(c, GER);
    expect(first.length / north.length).toBeGreaterThan(CAPITULATE); // by cells: overrun
    expect(km2Of(w, first) / soviet).toBeLessThan(CAPITULATE - 0.05); // by km²: not yet
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([]);
    expect(w.wars.atWar(GER, SOV)).toBe(true);
    // Further south until 80% of the land is held: now it capitulates, fight to the death or not.
    s.step(23);
    let km2 = km2Of(w, first);
    for (let i = first.length; km2 < (CAPITULATE + 0.05) * soviet; i++) {
      w.setController(north[i]!, GER);
      km2 += w.landCounts().rowKm2[rowOf(north[i]!)]!;
    }
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, SOV]]);
  }, 60_000);

  it('the puppet share counts km²: 33% of the Soviet cells in the north are under 30% of its land', () => {
    const s = duel(GER, SOV);
    const w = s.world;
    s.step(24);
    const north = cellsOf(w, SOV, rowOf);
    const soviet = w.landCounts().owned[SOV]!;
    const taken = north.slice(0, Math.round((PUPPET_SHARE + 0.03) * north.length));
    for (const c of taken) w.setController(c, GER);
    expect(taken.length / north.length).toBeGreaterThan(PUPPET_SHARE);
    expect(km2Of(w, taken) / soviet).toBeLessThan(PUPPET_SHARE - 0.05);
    // Several times Germany's own land: score 100, the Soviet Union is crushed and sues.
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, SOV]]);
    for (const c of taken) expect(w.cells.owner[c]).toBe(GER);
    expect(w.nations.cols.overlord[SOV]).toBe(0);
    expect(w.nations.cols.living[SOV]).toBe(1);
  }, 60_000);

  it('a small losing leader is annexed by km²: 48 cells at 60°N are small, 32 cells in the tropics are not', () => {
    const lose = (loser: number, keep: number, occupy: number): { w: World; left: number[] } => {
      const s = duel(GER, loser);
      const w = s.world;
      s.step(24);
      const kept = shrinkToCapital(w, loser, keep);
      // Germany holds the cells farthest from the capital; the loser is broke and sues.
      for (const c of kept.slice(keep - occupy)) w.setController(c, GER);
      w.nations.cols.gold[loser] = -1e9;
      expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, loser]]);
      return { w, left: kept.slice(0, keep - occupy) };
    };
    // Finland around Helsinki: 60 cells, 12 lost. The 48 left are more than the 40 cells of the
    // old rule and less than SMALL_STATE_KM2: annexed whole.
    const fin = lose(FIN, 60, 12);
    expect(fin.left.length).toBeGreaterThanOrEqual(40);
    expect(km2Of(fin.w, fin.left)).toBeLessThan(SMALL_STATE_KM2);
    expect(fin.w.nations.cols.living[FIN]).toBe(0);
    for (const c of fin.left) expect(fin.w.cells.owner[c]).toBe(GER);
    // Brazil around Rio de Janeiro: 38 cells, 6 lost. The 32 left are fewer than 40 cells and more
    // than SMALL_STATE_KM2: it keeps them.
    const bra = lose(BRA, 38, 6);
    expect(bra.left.length).toBeLessThan(40);
    expect(km2Of(bra.w, bra.left)).toBeGreaterThan(SMALL_STATE_KM2);
    expect(bra.w.nations.cols.living[BRA]).toBe(1);
    for (const c of bra.left) expect(bra.w.cells.owner[c]).toBe(BRA);
  }, 60_000);

  // PLAN 3.5f: the peace of one war annexed Finland, the one member of a side of a later war of
  // the same day. That war was gone from the records, and the day's loop, which goes by the list
  // of the day's start, made a peace of it: signed by nobody, a truce with nobody, and in the
  // history a row whose winner is `undefined`, a NaN with the bits of whoever converts it
  // (Chromium's are not Node's: the worker's state hash left Node's there).
  it('a war that ended with the peace of another the same day is not judged: no peace signed by nobody', () => {
    const s = duel(GER, FIN);
    const w = s.world;
    w.alliances.leave(SOV);
    w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== SOV && g.target !== SOV);
    w.nations.forEach((n) => {
      if (w.nations.cols.overlord[n] === SOV) w.nations.cols.overlord[n] = 0;
    });
    s.command({ kind: 'declareWar', attacker: SOV, defender: FIN });
    s.step(24);
    // Germany's war is judged before the Soviet one.
    expect(w.wars.list.filter((x) => x.sides[1].includes(FIN)).map((x) => x.sides)).toEqual([[[GER], [FIN]], [[SOV], [FIN]]]);
    // Finland around Helsinki, a part of it German, broke: it sues, and is annexed whole.
    const kept = shrinkToCapital(w, FIN, 60);
    for (const c of kept.slice(48)) w.setController(c, GER);
    w.nations.cols.gold[FIN] = -1e9;
    const rows = w.history.rows.length;
    expect(ofKind(events(s, 1), EventKind.PeaceSigned)).toEqual([[GER, FIN]]);
    expect(w.nations.cols.living[FIN]).toBe(0);
    expect(w.wars.list.filter((x) => x.sides.some((side) => side.length === 0 || side.includes(FIN)))).toEqual([]);
    expect(w.wars.truces.filter((t) => t.b === FIN).map((t) => [t.a, t.b])).toEqual([[GER, FIN]]);
    expect(w.history.rows.slice(rows).filter((v) => v === undefined)).toEqual([]);
  }, 60_000);

  it('capitulation: an overrun side loses at once, even when it fights to the death', () => {
    const s = atWar();
    s.step(1);
    const w = s.world;
    const war = w.wars.list.find((x) => x.sides[0]![0] === GER && x.sides[1]![0] === POL)!;
    s.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
    s.step(23); // occupy just before the 00:00 assessment at tick 24
    const taken = occupyWest(w, CAPITULATE + 0.05);
    const ev = events(s, 1);
    expect(ofKind(ev, EventKind.PeaceSigned)).toEqual([[GER, POL]]);
    for (const c of taken) expect(w.cells.owner[c]).toBe(GER);
    expect(w.nations.cols.overlord[POL]).toBe(GER);
  });

  it('deadlock: a fight to the death ends on its score after MAX_WAR_DAYS', () => {
    const s = atWar();
    s.step(1);
    const w = s.world;
    const war = w.wars.list.find((x) => x.sides[0]![0] === GER && x.sides[1]![0] === POL)!;
    s.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
    s.step(1);
    war.startTick = w.tick - 24 * (MAX_WAR_DAYS - 2);
    expect(ofKind(events(s, 24), EventKind.PeaceSigned)).toEqual([]); // one day short
    expect(ofKind(events(s, 48), EventKind.PeaceSigned)).toEqual([[GER, POL]]);
  });

  it('capital captures add to the score up to CAPITAL_BONUS_MAX', () => {
    const s = atWar();
    s.step(1);
    const war = s.world.wars.list.find((x) => x.sides[0]![0] === GER && x.sides[1]![0] === POL)!;
    for (let i = 0; i < 5; i++) noteCapitalCaptured(s.world, GER, POL);
    expect(war.capitalBonus).toBe(CAPITAL_BONUS_MAX);
    for (let i = 0; i < 9; i++) noteCapitalCaptured(s.world, POL, GER);
    expect(war.capitalBonus).toBe(-CAPITAL_BONUS_MAX);
    expect(CAPITAL_BONUS_MAX).toBeGreaterThanOrEqual(CAPITAL_SCORE);
  });

  it('nobody joins a war against its own ally: puppets allied across the sides stay out', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const [AUT, CZS] = [nationId('AUT'), nationId('CZS')];
    for (const n of [GER, POL, AUT, CZS]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    // Austria is Germany's puppet, Czechoslovakia Poland's; the two puppets are allies.
    w.nations.cols.overlord[AUT] = GER;
    w.nations.cols.overlord[CZS] = POL;
    expect(w.alliances.create(AUT, [CZS], 'alliance.defensive', 50)).not.toBeNull();
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(1);
    const war = w.wars.between(GER, POL)!.war;
    expect(war.sides[0]).toContain(AUT); // joined first, with its overlord
    expect(war.sides[1]).not.toContain(CZS); // would face its ally
    expect(w.wars.atWar(AUT, CZS)).toBe(false);
  });
});
