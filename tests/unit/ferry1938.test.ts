import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { wantsFerry, wantsTransport } from '../../src/sim/ai/economic';
import { DEPLOY_RANGE_CELLS, groundReader, reachesOnLand } from '../../src/sim/ai/operational';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation, equipFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { passageOf } from '../../src/sim/systems/movement';
import { musterPoint, spawnPoint } from '../../src/sim/systems/production';
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

  // PLAN 7.63, ADR-616: of its ports on a front's land, the nearest a front cell of its own, not the
  // nearest the transports by sea. Before, from Glasgow: Gibraltar, 314 cells from Britain's front
  // with Italy (Africa and Eurasia are one land); now Berbera, 9 (critic run 11, seed 7019 year 10:
  // Britain's ferry to Wilhelmshaven and Constanța, 524–626 cells from its front in Asia).
  it('it goes aboard for its port on a front\'s land nearest its front', () => {
    const { s, w, glasgow, tp, div } = setUp();
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
    const goal = w.embarked.get(div)!.target;
    // Its straight cells to the nearest British cell beside Italy's.
    let d2 = Infinity;
    for (const k of frontierOf(w)) {
      if (w.cells.controller[k] !== ENG) continue;
      if (!neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => w.cells.controller[q] !== 0 && w.wars.atWar(ENG, w.cells.controller[q]!))) continue;
      const dx = (k % W) - (goal % W);
      const dy = Math.floor(k / W) - Math.floor(goal / W);
      d2 = Math.min(d2, dx * dx + dy * dy);
    }
    expect(Math.sqrt(d2)).toBeLessThanOrEqual(w.atSize(DEPLOY_RANGE_CELLS));
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
    // No army of Britain's to carry on that land (PLAN 7.79c, ADR-636): its formations there that
    // reach no front cell (Hong Kong's garrison, beyond China) are the ferry's too, and go first.
    const pass = passageOf(w, ENG);
    const ground = groundReader(w, pass);
    const front: number[] = [];
    for (const k of frontierOf(w)) {
      if (w.cells.controller[k] === ENG && neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => w.cells.controller[q] !== 0 && w.wars.atWar(ENG, w.cells.controller[q]!))) front.push(k);
    }
    const land = comp[w.ports[there]!.cell]!;
    const stranded: number[] = [];
    w.formations.forEach((f) => {
      if (c.nation[f] !== ENG || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
      const k = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
      if (comp[k] === land && !front.some((q) => reachesOnLand(w, pass, ground, k, q))) stranded.push(f);
    });
    expect(stranded.length).toBeGreaterThan(0);
    for (const f of stranded) destroyFormation(w, f);
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

  // PLAN 7.64, ADR-617: a nation whose land front is its allies' alone (no cell of its own beside
  // an enemy) takes their cells as its front for the ferry; and a landing that ships nobody (no army
  // at its port nor on its land) leaves the turn to it. Britain's cells beside its enemies handed to
  // an ally, its army in Africa gone, its transports at a port of its there: they sail home for the
  // division at Glasgow. Before, nothing (critic run 11: 793 such island formations on day 1 of the
  // 48 saves, Latvia's 40 on 5309 year 20).
  it('a nation fronted through an ally alone sends its transports for its army', () => {
    const { s, w, tp, frontLands, home } = setUp(true);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const ctl = w.cells.controller;
    const theirs = w.ports.findIndex((p, i) => water[i]! >= 0 && ctl[p.cell] !== ENG && w.wars.sameSide(ENG, ctl[p.cell]!) && frontLands.has(comp[p.cell]!));
    expect(theirs).toBeGreaterThanOrEqual(0);
    const ally = ctl[w.ports[theirs]!.cell]!;
    const beside = (k: number): boolean => neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => ctl[q] !== 0 && w.wars.atWar(ENG, ctl[q]!));
    for (const k of [...frontierOf(w)]) if (ctl[k] === ENG && beside(k)) w.setController(k, ally);
    expect([...frontierOf(w)].some((k) => ctl[k] === ENG && beside(k))).toBe(false);
    // Its army on the fronts' lands gone; the transports at a port of its there.
    const gone: number[] = [];
    w.formations.forEach((f) => {
      if (c.nation[f] === ENG && !w.isFleet(f) && !w.isWing(f) && frontLands.has(comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)]!)) gone.push(f);
    });
    for (const f of gone) destroyFormation(w, f);
    const there = w.ports.findIndex((p, i) => water[i]! >= 0 && ctl[p.cell] === ENG && frontLands.has(comp[p.cell]!));
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
    expect(w.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] === ENG && comp[p.cell] === home && near(goal, water[i]!))).toBe(true);
  });

  // PLAN 7.66, ADR-618: the ferry's want of transports reads the same front. Britain's cells beside
  // its enemies handed to an ally, one transport group of a division's room (the landing's want is
  // then silent), three divisions at Glasgow, more men than the room: it wants a group for the ferry
  // and orders one. Before, the want read its own front cells alone (critic run 11, after 7.64: 696
  // island formations of such nations after 60 days of the 48 saves; the Netherlands and the British
  // Raj on 8693 year 20 with no transports at all).
  it('a nation fronted through an ally alone, its island army over its room, orders a transport group', () => {
    const { s, w, tp, div } = setUp(true);
    const c = w.formations.cols;
    const ctl = w.cells.controller;
    const water = portSeaOf(w);
    const comp = navOf(w).grid.component;
    const beside = (k: number): boolean => neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => ctl[q] !== 0 && w.wars.atWar(ENG, ctl[q]!));
    const fronts = new Set<number>();
    for (const k of frontierOf(w)) if (ctl[k] === ENG && beside(k)) fronts.add(comp[k]!);
    const theirs = w.ports.findIndex((p, i) => water[i]! >= 0 && ctl[p.cell] !== ENG && w.wars.sameSide(ENG, ctl[p.cell]!) && fronts.has(comp[p.cell]!));
    expect(theirs).toBeGreaterThanOrEqual(0);
    const ally = ctl[w.ports[theirs]!.cell]!;
    for (const k of [...frontierOf(w)]) if (ctl[k] === ENG && beside(k)) w.setController(k, ally);
    expect([...frontierOf(w)].some((k) => ctl[k] === ENG && beside(k))).toBe(false);
    // Two more divisions at Glasgow, as the editor's spawn makes them: three over a group's room,
    // which holds two since PLAN 7.90d (ADR-647).
    const infantry = BUILD_MIX_1938.infantry;
    let men = c.strength[div]!;
    for (let k = 0; k < 2; k++) {
      const more = w.formations.create();
      [c.nation[more], c.x[more], c.y[more], c.org[more], c.template[more], c.supply[more]] = [ENG, c.x[div]!, c.y[div]!, 1, infantry, 1];
      equipFormation(w, more, infantry);
      men += c.strength[more]!;
    }
    expect(men).toBeGreaterThan(transportRoom(w, tp));
    const transport = BUILD_MIX_1938.fleets!.transport;
    expect(wantsTransport(w, ENG, transport, [tp], ECONOMY_TABLES_1938.templateStrength[infantry]!)).toBe(false);
    expect(wantsFerry(w, ENG, [tp])).toBe(true);
    w.nations.cols.gold[ENG] = 1e6;
    w.nations.cols.manpower[ENG] = 1e7;
    s.step(1);
    expect(w.production.ids().some((p) => w.production.cols.nation[p] === ENG && w.production.cols.template[p] === transport)).toBe(true);
  });

  // PLAN 7.67, ADR-619: where its new divisions are raised. Britain's cells beside its enemies
  // handed to an ally, its capital moved to an islet of its with no port: a division is raised at its
  // city on a land of its allies' front; with those cities lost, at its port nearest that front by
  // sea, where the ferry boards. Before, at home on the islet (critic run 11, seed 1129 year 20: the
  // Netherlands' 16 divisions on a one-cell Caribbean islet with no port).
  it('a nation fronted through an ally alone, its capital on an islet with no port, raises its divisions toward that front', () => {
    const { w } = setUp(true);
    const ctl = w.cells.controller;
    const own = w.cells.owner;
    const water = portSeaOf(w);
    const comp = navOf(w).grid.component;
    const beside = (k: number): boolean => neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => ctl[q] !== 0 && w.wars.atWar(ENG, ctl[q]!));
    const theirs = w.ports.findIndex((p, i) => water[i]! >= 0 && ctl[p.cell] !== ENG && w.wars.sameSide(ENG, ctl[p.cell]!));
    expect(theirs).toBeGreaterThanOrEqual(0);
    const ally = ctl[w.ports[theirs]!.cell]!;
    for (const k of [...frontierOf(w)]) if (ctl[k] === ENG && beside(k)) w.setController(k, ally);
    expect([...frontierOf(w)].some((k) => ctl[k] === ENG && beside(k))).toBe(false);
    // The allies' front's lands.
    const lands = new Set<number>();
    for (const k of frontierOf(w)) {
      const a = ctl[k]!;
      if (a !== 0 && w.wars.sameSide(ENG, a) && neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => ctl[q] !== 0 && w.wars.together(ENG, a, ctl[q]!))) lands.add(comp[k]!);
    }
    expect(lands.size).toBeGreaterThan(0);
    // An islet of Britain's with no port: its capital there.
    const ported = new Set(w.ports.map((p) => comp[p.cell]!));
    const size = new Map<number, number>();
    for (let k = 0; k < W * H; k++) if (comp[k]! > 0) size.set(comp[k]!, (size.get(comp[k]!) ?? 0) + 1);
    let islet = -1;
    for (let k = 0; k < W * H && islet < 0; k++) {
      const l = comp[k]!;
      if (l > 0 && own[k] === ENG && ctl[k] === ENG && !ported.has(l) && !lands.has(l) && size.get(l)! <= 4) islet = k;
    }
    expect(islet).toBeGreaterThanOrEqual(0);
    const nc = w.nations.cols;
    [nc.capitalX[ENG], nc.capitalY[ENG]] = [(islet % W) + 0.5, Math.floor(islet / W) + 0.5];
    const cellAt = (p: [number, number]): number => Math.floor(p[1]) * W + Math.floor(p[0]);
    expect(comp[cellAt(spawnPoint(w, ENG)!)]).toBe(comp[islet]);
    // At its city on a land of the allies' front.
    const at = cellAt(musterPoint(w, ENG)!);
    expect(lands.has(comp[at]!)).toBe(true);
    expect(w.cities.ids().some((city) => w.cities.cols.cell[city] === at && own[at] === ENG && ctl[at] === ENG)).toBe(true);
    // Its cities there lost: at its port with water, off those lands.
    w.cities.forEach((city) => {
      const k = w.cities.cols.cell[city]!;
      if (own[k] === ENG && ctl[k] === ENG && lands.has(comp[k]!)) w.setController(k, ally);
    });
    const port = cellAt(musterPoint(w, ENG)!);
    expect(comp[port]).not.toBe(comp[islet]);
    expect(lands.has(comp[port]!)).toBe(false);
    expect(w.ports.some((p, i) => p.cell === port && water[i]! >= 0 && own[port] === ENG && ctl[port] === ENG)).toBe(true);
  });
});
