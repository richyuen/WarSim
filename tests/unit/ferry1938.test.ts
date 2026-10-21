import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { frontierOf } from '../../src/sim/systems/territory';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.49d1, ADR-612: the ferry. A nation at war with a land front ships its army standing on a
// landmass with no front of its own to its port on a front's land. Before, no rule did: the
// invasion AI landed only in a war with no front (critic run 11, seed 7019 year 10: Britain's 117
// divisions at home, its war fought in Asia). The United Kingdom at war with Italy (a front in
// Africa), a division at Glasgow: it goes aboard for a British port in Africa; with the transports
// at a port in Africa, they sail home for it.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ITA = id('ITA');

interface Case {
  s: Sim;
  w: World;
  glasgow: number;
  tp: number;
  div: number;
  frontLands: Set<number>;
  home: number;
}

function setUp(allies = false): Case {
  const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
  const w = s.world;
  const c = w.formations.cols;
  const comp = navOf(w).grid.component;
  expect(declareWar(w, ENG, ITA, !allies)).not.toBeNull();
  // The air out of it (PLAN 5.12b: strikes could win the peace first).
  for (const [wing] of [...w.wingBase]) destroyFormation(w, wing);
  // Britain's land fronts: on a land other than Britain's.
  const glasgow = w.ports.findIndex((p) => p.name === 'Glasgow');
  expect(glasgow).toBeGreaterThanOrEqual(0);
  const home = comp[w.ports[glasgow]!.cell]!;
  const frontLands = new Set<number>();
  for (const k of frontierOf(w)) {
    if (w.cells.controller[k] !== ENG) continue;
    for (const q of neighbours4(k, W, H, w.settings.loopingMap, [])) if (w.cells.controller[q] !== 0 && w.wars.atWar(ENG, w.cells.controller[q]!)) frontLands.add(comp[k]!);
  }
  expect(frontLands.size).toBeGreaterThan(0);
  expect(frontLands.has(home)).toBe(false);
  // One British transport group; the others gone.
  const groups: number[] = [];
  w.formations.forEach((f) => {
    if (w.isFleet(f) && c.nation[f] === ENG && transportRoom(w, f) > 0) groups.push(f);
  });
  expect(groups.length).toBeGreaterThan(0);
  const [tp, ...rest] = groups;
  for (const f of rest) destroyFormation(w, f);
  // A British division at Glasgow, the others on lands with no front gone (one army to ship).
  let div = 0;
  const gone: number[] = [];
  w.formations.forEach((f) => {
    if (c.nation[f] !== ENG || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
    const l = comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)]!;
    if (frontLands.has(l)) return;
    if (div === 0 && l === home && c.strength[f]! <= transportRoom(w, tp!)) div = f;
    else gone.push(f);
  });
  for (const f of gone) destroyFormation(w, f);
  expect(div).toBeGreaterThan(0);
  [c.x[div], c.y[div]] = w.cellPoint(w.ports[glasgow]!.cell);
  c.moving[div] = 0;
  w.paths.delete(div);
  return { s, w, glasgow, tp: tp!, div, frontLands, home };
}

describe('the ferry (PLAN 7.49d1)', () => {
  it('an army on a land with no front of its nation goes aboard for its port on a front\'s land', () => {
    const { s, w, glasgow, tp, div, frontLands } = setUp();
    const c = w.formations.cols;
    const sea = portSeaOf(w)[glasgow]!;
    [c.x[tp], c.y[tp]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp] = 0;
    let embarked = -1;
    for (let d = 0; d < 2 * STAGGER && embarked < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationEmbarked && ev[i + 2] === div) embarked = d;
      });
    }
    expect(embarked).toBeGreaterThanOrEqual(0);
    const e = w.embarked.get(div)!;
    expect(e.fleet).toBe(tp);
    // For a British port on a front's land.
    const comp = navOf(w).grid.component;
    expect(frontLands.has(comp[e.target]!)).toBe(true);
    expect(w.cells.controller[e.target]).toBe(ENG);
    expect(w.ports.some((p) => p.cell === e.target)).toBe(true);
  });

  it('transports at a port on a front\'s land sail for the army at home', () => {
    const { s, w, tp, frontLands, home } = setUp();
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const comp = navOf(w).grid.component;
    // The group at a British port on a front's land.
    const there = w.ports.findIndex((p, i) => water[i]! >= 0 && w.cells.controller[p.cell] === ENG && frontLands.has(comp[p.cell]!));
    expect(there).toBeGreaterThanOrEqual(0);
    const sea = water[there]!;
    [c.x[tp], c.y[tp]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp] = 0;
    let sailed = false;
    for (let d = 0; d < STAGGER && !sailed; d++) {
      s.step(24);
      sailed = c.moving[tp] === 1;
    }
    expect(sailed).toBe(true);
    // For the water of a British port on Britain.
    const r = w.atSize(AT_PORT_CELLS);
    const goal = c.targetCell[tp]!;
    const near = (a: number, b: number): boolean => Math.abs((a % W) - (b % W)) <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
    expect(w.ports.some((p, i) => water[i]! >= 0 && w.cells.controller[p.cell] === ENG && comp[p.cell] === home && near(goal, water[i]!))).toBe(true);
  });

  // PLAN 7.49d2, ADR-613: with no port of its own on a front's land, it ferries to an ally's
  // there. Britain's allies in the war with it; its ports on its fronts' lands handed to one of
  // them: before, nobody went aboard (critic run 11, seed 5309 year 20: the Soviet Union's 158).
  it('with no port of its own on a front\'s land, it goes aboard for an ally\'s there', () => {
    const { s, w, glasgow, tp, div, frontLands } = setUp(true);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const ctl = w.cells.controller;
    const theirs = w.ports.findIndex((p, i) => water[i]! >= 0 && ctl[p.cell] !== ENG && w.wars.sameSide(ENG, ctl[p.cell]!) && frontLands.has(comp[p.cell]!));
    expect(theirs).toBeGreaterThanOrEqual(0);
    const ally = ctl[w.ports[theirs]!.cell]!;
    for (const p of w.ports) if (ctl[p.cell] === ENG && frontLands.has(comp[p.cell]!)) w.setController(p.cell, ally);
    const sea = water[glasgow]!;
    [c.x[tp], c.y[tp]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp] = 0;
    let embarked = -1;
    for (let d = 0; d < 2 * STAGGER && embarked < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationEmbarked && ev[i + 2] === div) embarked = d;
      });
    }
    expect(embarked).toBeGreaterThanOrEqual(0);
    const e = w.embarked.get(div)!;
    expect(e.fleet).toBe(tp);
    // For an ally's port on a front's land.
    expect(frontLands.has(comp[e.target]!)).toBe(true);
    expect(w.ports.some((p) => p.cell === e.target)).toBe(true);
    expect(w.wars.sameSide(ENG, ctl[e.target]!)).toBe(true);
  });
});
