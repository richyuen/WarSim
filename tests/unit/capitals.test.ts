import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.15: occupation vs owner, capital capture and relocation, winner-takes-all.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

/** Events of one kind as [a, b, x, y] tuples. */
function eventsOf(ev: number[], kind: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === kind) out.push(ev.slice(i + 2, i + 6));
  return out;
}

/** Steps one tick and returns the events it emitted. */
function stepEvents(s: Sim, n = 1): number[] {
  const all: number[] = [];
  s.step(n, (w) => {
    all.push(...w.out.events);
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  return all;
}

function capitalCity(w: World, n: number): number {
  let found = 0;
  w.cities.forEach((id) => {
    if (w.cities.cols.capitalOf[id] === n) found = id;
  });
  return found;
}

const cityName = (s: Sim, id: number): string => s.world.cities.cols.def[id]!.toString();

describe('occupation and capitals (PLAN 1.15)', () => {
  it('front flips change the controller only; the owner keeps the land (occupation)', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.wars.set(GER, POL, true);
    const owner0 = new Uint16Array(w.cells.owner);
    // A German army on the Polish border pushes in.
    const cap = capitalCity(w, POL);
    const [px, py] = [w.cities.cols.x[cap]!, w.cities.cols.y[cap]!];
    s.command({ kind: 'paintControl', nation: GER, x: px - 6, y: py, r: 3 });
    for (const dy of [-1, 0, 1]) addDivision(w, GER, px - 6, py + dy);
    stepEvents(s, 24 * 4);
    let occupied = 0;
    for (let c = 0; c < w.cells.owner.length; c++) {
      expect(w.cells.owner[c]).toBe(owner0[c]);
      if (w.cells.owner[c] === POL && w.cells.controller[c] === GER) occupied++;
    }
    expect(occupied).toBeGreaterThan(28); // the painted disc plus front gains
  });

  it('a captured capital moves to the largest city the nation still holds', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.wars.set(GER, POL, true);
    const warsaw = capitalCity(w, POL);
    expect(warsaw).toBeGreaterThan(0);
    const cc = w.cities.cols;
    s.command({ kind: 'paintControl', nation: GER, x: cc.x[warsaw]!, y: cc.y[warsaw]!, r: 1 });
    const ev = stepEvents(s);
    expect(eventsOf(ev, EventKind.CapitalCaptured)).toEqual([[POL, GER, cc.x[warsaw]!, cc.y[warsaw]!]]);
    const moved = eventsOf(ev, EventKind.CapitalMoved);
    expect(moved.length).toBe(1);
    const next = capitalCity(w, POL);
    expect(next).toBe(moved[0]![1]);
    expect(next).not.toBe(warsaw);
    expect(cc.capitalOf[warsaw]).toBe(0);
    // Largest remaining POL-held city.
    let maxSize = 0;
    w.cities.forEach((id) => {
      const cell = cc.cell[id]!;
      if (w.cells.owner[cell] === POL && w.cells.controller[cell] === POL) maxSize = Math.max(maxSize, cc.size[id]!);
    });
    expect(cc.size[next]).toBe(maxSize);
    expect([w.nations.cols.capitalX[POL], w.nations.cols.capitalY[POL]]).toEqual([cc.x[next], cc.y[next]]);
    expect(w.nations.cols.living[POL]).toBe(1);
    expect(cityName(s, next)).not.toBe('');
    // Holding the new capital too moves it again; no event while nothing changes.
    expect(eventsOf(stepEvents(s), EventKind.CapitalCaptured)).toEqual([]);
  });

  it('without a war, occupying the capital captures nothing', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const warsaw = capitalCity(s.world, POL);
    s.command({ kind: 'paintControl', nation: GER, x: s.world.cities.cols.x[warsaw]!, y: s.world.cities.cols.y[warsaw]!, r: 1 });
    expect(eventsOf(stepEvents(s), EventKind.CapitalCaptured)).toEqual([]);
    expect(capitalCity(s.world, POL)).toBe(warsaw);
  });

  it('winner-takes-all: capturing the capital annexes everything the loser controls', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.wars.set(GER, POL, true);
    w.wars.set(POL, nationId('SOV'), true);
    const polCells = w.cells.controller.reduce((n, c) => n + (c === POL ? 1 : 0), 0);
    const gerCells = w.cells.owner.reduce((n, c) => n + (c === GER ? 1 : 0), 0);
    const warsaw = capitalCity(w, POL);
    s.command({ kind: 'setSetting', key: 'winnerTakesAll', value: true });
    s.command({ kind: 'paintControl', nation: GER, x: w.cities.cols.x[warsaw]!, y: w.cities.cols.y[warsaw]!, r: 1 });
    const ev = stepEvents(s);
    expect(eventsOf(ev, EventKind.NationEliminated)).toEqual([[POL, 0, NaN, NaN]]);
    expect(w.nations.cols.living[POL]).toBe(0);
    expect(w.cells.controller.some((c) => c === POL)).toBe(false);
    expect(w.cells.owner.reduce((n, c) => n + (c === GER ? 1 : 0), 0)).toBe(gerCells + polCells);
    expect(w.cells.owner.some((c) => c === POL)).toBe(false); // incl. the occupied capital district
    w.formations.forEach((id) => expect(w.formations.cols.nation[id]).not.toBe(POL));
    expect(w.wars.atWar(GER, POL)).toBe(false);
    expect(w.wars.atWar(POL, nationId('SOV'))).toBe(false);
    expect(capitalCity(w, POL)).toBe(0);
  });

  it('a nation that loses its last city keeps a field capital, and is eliminated with its last cell', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const LUX = nationId('LUX');
    w.wars.set(GER, LUX, true);
    const cc = w.cities.cols;
    // Take every Luxembourg city at once.
    const luxCities: number[] = [];
    w.cities.forEach((id) => {
      if (w.cells.owner[cc.cell[id]!] === LUX) luxCities.push(id);
    });
    expect(luxCities.length).toBeGreaterThan(0);
    const luxCells: number[] = [];
    w.cells.controller.forEach((c, i) => c === LUX && luxCells.push(i));
    const cityCells = new Set(luxCities.map((id) => cc.cell[id]!));
    if (luxCells.every((c) => cityCells.has(c))) {
      // Luxembourg is a single city cell at this map size: capture eliminates it at once.
      for (const id of luxCities) s.command({ kind: 'paintControl', nation: GER, x: cc.x[id]!, y: cc.y[id]!, r: 0 });
      const ev = stepEvents(s);
      expect(eventsOf(ev, EventKind.NationEliminated)).toEqual([[LUX, 0, NaN, NaN]]);
      return;
    }
    for (const id of luxCities) s.command({ kind: 'paintControl', nation: GER, x: cc.x[id]!, y: cc.y[id]!, r: 0 });
    let ev = stepEvents(s);
    const moved = eventsOf(ev, EventKind.CapitalMoved);
    expect(moved.length).toBe(1);
    expect(moved[0]![1]).toBe(0); // a plain cell, not a city
    expect(w.cells.controller[Math.floor(moved[0]![3]!) * W + Math.floor(moved[0]![2]!)]).toBe(LUX);
    expect(w.nations.cols.living[LUX]).toBe(1);
    for (const c of luxCells) s.command({ kind: 'paintControl', nation: GER, x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5, r: 0 });
    ev = stepEvents(s);
    expect(eventsOf(ev, EventKind.NationEliminated)).toEqual([[LUX, 0, NaN, NaN]]);
    expect(w.nations.cols.living[LUX]).toBe(0);
  });

  it('the winner-takes-all setting is saved', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'winnerTakesAll', value: true });
    s.step(1);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.settings.winnerTakesAll).toBe(true);
    expect(t.hash()).toBe(s.hash());
  });
});

describe('1938 start', () => {
  it('every living nation has a capital city it holds: no capital moves on the first tick', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.nations.forEach((n) => {
      if (w.nations.cols.living[n] !== 1) return;
      const c = capitalCity(w, n);
      expect(c, `nation ${n}`).toBeGreaterThan(0);
    });
    const ev = stepEvents(s, 24);
    expect(eventsOf(ev, EventKind.CapitalMoved)).toEqual([]);
    expect(eventsOf(ev, EventKind.NationEliminated)).toEqual([]);
  });
});
