import { describe, expect, it } from 'vitest';
import { wantsFerry } from '../../src/sim/ai/economic';
import { invasionAi } from '../../src/sim/ai/invasion';
import { DEPLOY_RANGE_CELLS, groundReader, reachesOnLand } from '../../src/sim/ai/operational';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Refusal } from '../../src/shared/commands';
import { placeFleet } from '../../src/sim/placeForces';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { orderLanding, transportRoom } from '../../src/sim/systems/amphibious';
import { passageOf } from '../../src/sim/systems/movement';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.79c, ADR-636: the ferry (ADR-612) took a nation's army only from a landmass with no front
// cell of the nation's, and the operational AI allots a formation only to the sectors its class
// reaches. A formation on a front's land that reaches none of its front (closed ground between)
// stood for good: critic run 12, seed 1129 year 10, 60 US divisions at one cell for 30 days. Germany
// in 1938 at war with Lithuania alone: its only front is East Prussia's, beyond Poland (neutral,
// closed to it). A German division at a port of Germany's west of Poland reaches no front cell; on
// Germany's invasion day, with the front not held (no Normandy), it goes aboard for a port from
// which the front is reached. Before, nobody was ferried.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const LIT = id('LIT');

/**
 * Germany at war with Lithuania on its invasion day, its front not held, one German division
 * standing at a home port that reaches no front cell, and Germany's one transport group at that
 * port's water. `reaches`: whether a cell reaches a front cell.
 */
function stranded(spare = 0): { w: Sim['world']; div: number; tp: number; home: { p: { cell: number }; i: number }; europe: number; reaches: (k: number) => boolean; more: number[] } {
  const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
  const w = s.world;
  s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  s.step(1);
  s.step(24 - (w.tick % 24));
  while ((w.tick / 24 + GER) % STAGGER !== 0) s.step(24);
  const c = w.formations.cols;
  const ctl = w.cells.controller;
  const comp = navOf(w).grid.component;
  const water = portSeaOf(w);
  expect(declareWar(w, GER, LIT, true)).not.toBeNull();
  expect(w.wars.list.filter((war) => war.sides.some((side) => side.includes(GER)))).toHaveLength(1);
  for (const [wing] of [...w.wingBase]) destroyFormation(w, wing);
  // Germany's front: its cells beside Lithuania's, all on one landmass (Europe's).
  const front: number[] = [];
  for (let k = 0; k < W * H; k++) if (ctl[k] === GER && neighbours4(k, W, H, false, []).some((q) => ctl[q] === LIT)) front.push(k);
  expect(front.length).toBeGreaterThan(0);
  const europe = comp[front[0]!]!;
  for (const k of front) expect(comp[k]).toBe(europe);
  const pass = passageOf(w, GER);
  const ground = groundReader(w, pass);
  const reaches = (k: number): boolean => front.some((q) => reachesOnLand(w, pass, ground, k, q));
  // Germany's ports on Europe: a home port that reaches no front cell (west of Poland), and one
  // that reaches the front (East Prussia's).
  const ports = w.ports.map((p, i) => ({ p, i })).filter(({ p, i }) => water[i]! >= 0 && ctl[p.cell] === GER && comp[p.cell] === europe);
  const home = ports.find(({ p }) => !reaches(p.cell));
  expect(home).toBeDefined();
  expect(ports.some(({ p }) => reaches(p.cell))).toBe(true);
  // One German transport group, at the home port's water.
  const sea = water[home!.i]!;
  const groups: number[] = [];
  w.formations.forEach((f) => {
    if (w.isFleet(f) && c.nation[f] === GER && transportRoom(w, f) > 0) groups.push(f);
  });
  const [tp, ...rest] = groups;
  expect(tp).toBeDefined();
  for (const f of rest) destroyFormation(w, f);
  [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
  c.moving[tp!] = 0;
  const room = transportRoom(w, tp!);
  // A German division at the home port, standing; it reaches no front cell.
  let div = 0;
  w.formations.forEach((f) => {
    if (div !== 0 || c.nation[f] !== GER || w.offLand(f) || w.isWing(f) || w.isFleet(f) || c.strength[f]! > room) return;
    if (comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)] === europe) div = f;
  });
  expect(div).toBeGreaterThan(0);
  // `spare` more German divisions that fit the room, kept for the caller to place.
  const more: number[] = [];
  w.formations.forEach((f) => {
    if (more.length >= spare || f === div || c.nation[f] !== GER || w.offLand(f) || w.isWing(f) || w.isFleet(f) || c.strength[f]! > room) return;
    more.push(f);
  });
  expect(more).toHaveLength(spare);
  // The front not held: no German land formation within the range of it (`frontHeld`).
  const r = w.atSize(DEPLOY_RANGE_CELLS);
  const nearFront = (x: number, y: number): boolean => front.some((k) => Math.abs((k % W) + 0.5 - x) <= 2 * r && Math.abs(Math.floor(k / W) + 0.5 - y) <= 2 * r);
  const ids: number[] = [];
  w.formations.forEach((f) => ids.push(f));
  for (const f of ids) if (f !== div && !more.includes(f) && c.nation[f] === GER && !w.isFleet(f) && !w.isWing(f) && nearFront(c.x[f]!, c.y[f]!)) destroyFormation(w, f);
  [c.x[div], c.y[div]] = w.cellPoint(home!.p.cell);
  c.moving[div] = 0;
  c.engaged[div] = 0;
  c.retreat[div] = 0;
  c.home[div] = 0;
  w.paths.delete(div);
  expect(reaches(home!.p.cell)).toBe(false);
  return { w, div, tp: tp!, home: home!, europe, reaches, more };
}

describe('the ferry from a front’s land the army cannot walk to its front (PLAN 7.79c)', () => {
  it('ships a division that reaches no front cell to a port from which one is reached', () => {
    const { w, div, europe, reaches } = stranded();
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    // The invasion AI on that day: German formations go aboard, bound for a cell from which the
    // front is reached, on Europe.
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === GER);
    expect(aboard).toContain(div);
    for (const f of aboard) {
      const target = w.embarked.get(f)!.target;
      expect(comp[target]).toBe(europe);
      expect(reaches(target)).toBe(true);
    }
  });
});

// PLAN 7.88a, ADR-638: the ferry's turn took one transport group, the most room and then the lowest
// id, and on critic run 12's saves that one could never act (1129 year 10: at Nuuk; 6421 year 20: at
// Port-of-Spain and Roseau) while 11 and 33 more of the USA's stood idle: no order in 4 turns of 4.
// Here a German group, the lower id, stands at Baku (handed to Germany: on its army's landmass, on the
// Caspian, whence no port on its front's land is reached by sea) and a second of the same room at the
// division's home port. The turn passes over the first and the second takes the division aboard.
// Before, the turn was Baku's group's, and nobody was ferried.
describe('the ferry tries its groups until one acts (PLAN 7.88a)', () => {
  it('passes over a group that cannot act for one that can', () => {
    const { w, div, tp, home, europe, reaches } = stranded();
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const baku = w.ports.findIndex((p) => p.name === 'Baku');
    expect(baku).toBeGreaterThanOrEqual(0);
    expect(comp[w.ports[baku]!.cell]).toBe(europe);
    w.cells.controller[w.ports[baku]!.cell] = GER;
    // A second group: the same template (the same room), at the home port's water.
    const before = new Set<number>();
    w.formations.forEach((f) => before.add(f));
    const sea = water[home.i]!;
    expect(placeFleet(w, GER, c.template[tp]!, (sea % W) + 0.5, Math.floor(sea / W) + 0.5)).toBe(Refusal.None);
    let second = 0;
    w.formations.forEach((f) => {
      if (!before.has(f)) second = f;
    });
    expect(second).toBeGreaterThan(0);
    expect(transportRoom(w, second)).toBe(transportRoom(w, tp));
    w.station.delete(second);
    // The lower id at Baku, the other at the home port; both standing.
    const [dud, good] = [tp, second].sort((a, b) => a - b) as [number, number];
    const caspian = water[baku]!;
    [c.x[dud], c.y[dud]] = [(caspian % W) + 0.5, Math.floor(caspian / W) + 0.5];
    [c.x[good], c.y[good]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    for (const f of [dud, good]) c.moving[f] = 0;
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    // Baku's group gave no order; the division went aboard the second, for a cell on Europe from
    // which the front is reached.
    expect(c.moving[dud]).toBe(0);
    expect(w.embarked.get(div)?.target).toBeDefined();
    const target = w.embarked.get(div)!.target;
    expect(comp[target]).toBe(europe);
    expect(reaches(target)).toBe(true);
  });
});

// PLAN 7.88b, the user's ADR-637 a: the ferry's turn ended at the first group that gave an order,
// so the ferry carried one group's room (24,000 men) a turn: critic run 12, seed 1129 year 10, 60 US
// divisions at one cell for 30 days while 11 more US groups stood at its ports. Here a second German
// group stands at a second home port (far from the first, neither reaching the front), with a
// division of its own there. Both groups take their division aboard in the one turn. Before, the
// first group's division alone went.
describe('every group with an army to carry acts in the ferry’s turn (PLAN 7.88b)', () => {
  it('two groups at two ports each take their division aboard', () => {
    // Three divisions (the third left where it stands): the free army over one group's room, so the
    // turn goes on past the first group's order (a group carries two since PLAN 7.90d, ADR-647).
    const { w, div, tp, home, europe, reaches, more } = stranded(2);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const ctl = w.cells.controller;
    const room = transportRoom(w, tp);
    // A second home port of Germany's on Europe, reaching no front cell, far from the first.
    const far = (a: number, b: number): boolean => Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W)) > 4 * w.atSize(AT_PORT_CELLS);
    const other = w.ports.findIndex((p, i) => i !== home.i && water[i]! >= 0 && ctl[p.cell] === GER && comp[p.cell] === europe && !reaches(p.cell) && far(p.cell, home.p.cell));
    expect(other).toBeGreaterThanOrEqual(0);
    const sea2 = water[other]!;
    // A second group, the same template, at that port's water; both standing.
    const before = new Set<number>();
    w.formations.forEach((f) => before.add(f));
    expect(placeFleet(w, GER, c.template[tp]!, (sea2 % W) + 0.5, Math.floor(sea2 / W) + 0.5)).toBe(Refusal.None);
    let second = 0;
    w.formations.forEach((f) => {
      if (!before.has(f)) second = f;
    });
    expect(second).toBeGreaterThan(0);
    expect(transportRoom(w, second)).toBe(room);
    w.station.delete(second);
    [c.x[second], c.y[second]] = [(sea2 % W) + 0.5, Math.floor(sea2 / W) + 0.5];
    for (const f of [tp, second]) c.moving[f] = 0;
    // A second German division, standing at the second port.
    const div2 = more[0]!;
    [c.x[div2], c.y[div2]] = w.cellPoint(w.ports[other]!.cell);
    c.moving[div2] = 0;
    c.engaged[div2] = 0;
    c.retreat[div2] = 0;
    c.home[div2] = 0;
    w.paths.delete(div2);
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    // Both divisions aboard, each for a cell on Europe from which the front is reached.
    for (const d of [div, div2]) {
      const target = w.embarked.get(d)?.target;
      expect(target).toBeDefined();
      expect(comp[target!]).toBe(europe);
      expect(reaches(target!)).toBe(true);
    }
  });
});

// PLAN 7.89, ADR-643: the invasion AI skipped a nation's whole turn (landing, Normandy, ferry) while
// any formation of its was aboard (PLAN 4.6b's lock). With every group carrying (ADR-642), the first
// turn's boarders held every other group for their voyage: critic run 12, seed 1129 year 10, 2 US
// divisions aboard for 22 days, three ferry turns skipped, while 49 and 60 stood on two cells. The
// lock now holds a landing and a Normandy while a landing is at sea, and never the ferry. Here a
// second German group, at the home port, has taken a second division aboard, once for a German cell
// (a ferry's trip) and once for a Lithuanian one (a landing); the ferry's turn still puts the first
// division aboard Germany's other group. Before, the turn was skipped and it stood.
describe('a formation aboard does not hold the ferry’s turn (PLAN 7.89)', () => {
  for (const trip of ['ferry', 'landing'] as const) {
    it(`a ${trip} at sea, the ferry still carries`, () => {
      const { w, div, tp, home, europe, reaches, more } = stranded(1);
      const c = w.formations.cols;
      const comp = navOf(w).grid.component;
      const water = portSeaOf(w);
      const ctl = w.cells.controller;
      const sea = water[home.i]!;
      const before = new Set<number>();
      w.formations.forEach((f) => before.add(f));
      expect(placeFleet(w, GER, c.template[tp]!, (sea % W) + 0.5, Math.floor(sea / W) + 0.5)).toBe(Refusal.None);
      let second = 0;
      w.formations.forEach((f) => {
        if (!before.has(f)) second = f;
      });
      expect(second).toBeGreaterThan(0);
      w.station.delete(second);
      [c.x[second], c.y[second]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
      for (const f of [tp, second]) c.moving[f] = 0;
      // The second division at the home port goes aboard the second group: for a German port from
      // which the front is reached, or for a Lithuanian port.
      const goal = w.ports.find((p, i) => water[i]! >= 0 && (trip === 'ferry' ? ctl[p.cell] === GER && comp[p.cell] === europe && reaches(p.cell) : ctl[p.cell] === LIT));
      expect(goal).toBeDefined();
      const div2 = more[0]!;
      [c.x[div2], c.y[div2]] = w.cellPoint(home.p.cell);
      c.moving[div2] = 0;
      c.engaged[div2] = 0;
      c.retreat[div2] = 0;
      c.home[div2] = 0;
      w.paths.delete(div2);
      const [gx, gy] = w.cellPoint(goal!.cell);
      w.settings.aiEnabled = true;
      expect(orderLanding(w, div2, gx, gy, second)).toBe(true);
      expect(w.embarked.get(div2)?.fleet).toBe(second);
      expect(c.moving[second]).toBe(1);
      invasionAi(w);
      w.settings.aiEnabled = false;
      // The first division aboard the other group, for a cell on Europe from which the front is reached.
      const e = w.embarked.get(div);
      expect(e?.fleet).toBe(tp);
      expect(comp[e!.target]).toBe(europe);
      expect(reaches(e!.target)).toBe(true);
    });
  }
});

// PLAN 7.90b, ADR-645: the ferry's turn ended at SAIL_TRIES (4) groups that gave no order, and the
// same ones refused first every week, most with no search at all: critic run 12, 1129 year 10, 6.5 of
// the USA's 11.4 groups at a port never tried a turn; 6421 year 20, 26.3 of 30.6, the 30 at Norfolk
// among them. Here five German groups, the lower ids, stand at Baku (handed to Germany, on the
// Caspian: no port on its front's land is reached by sea), and a sixth of the same room at the
// division's home port. Baku's first refuses with no search, the other four take its refusal, and
// the sixth takes the division aboard. Before, the turn ended at Baku's fourth and nobody went.
describe('a ferry turn is not ended by refusals that cost nothing (PLAN 7.90b)', () => {
  it('tries a group past five refusing at one port', () => {
    const { w, div, tp, home, europe, reaches } = stranded();
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const baku = w.ports.findIndex((p) => p.name === 'Baku');
    expect(baku).toBeGreaterThanOrEqual(0);
    w.cells.controller[w.ports[baku]!.cell] = GER;
    const sea = water[home.i]!;
    const groups = [tp];
    for (let i = 0; i < 5; i++) {
      const before = new Set<number>();
      w.formations.forEach((f) => before.add(f));
      expect(placeFleet(w, GER, c.template[tp]!, (sea % W) + 0.5, Math.floor(sea / W) + 0.5)).toBe(Refusal.None);
      w.formations.forEach((f) => {
        if (!before.has(f)) groups.push(f);
      });
    }
    expect(groups).toHaveLength(6);
    for (const f of groups) {
      expect(transportRoom(w, f)).toBe(transportRoom(w, tp));
      w.station.delete(f);
      c.moving[f] = 0;
    }
    // The five lower ids at Baku, the highest at the home port.
    groups.sort((a, b) => a - b);
    const good = groups.pop()!;
    const caspian = water[baku]!;
    for (const f of groups) [c.x[f], c.y[f]] = [(caspian % W) + 0.5, Math.floor(caspian / W) + 0.5];
    [c.x[good], c.y[good]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    for (const f of groups) expect(c.moving[f]).toBe(0);
    expect(w.embarked.get(div)?.target).toBeDefined();
    const target = w.embarked.get(div)!.target;
    expect(comp[target]).toBe(europe);
    expect(reaches(target)).toBe(true);
  });
});

// PLAN 7.90c, ADR-646: a transport group away from the army sailed for a port by the free army's
// SAIL_TRIES formations nearest it, whatever their land, and `sailToArmy` takes only a land with a
// port of the nation's. Critic run 12, seed 1129 year 10: the five US groups landed at Bathurst found
// their four nearest on Caribbean islands with no US port and stood 52–62 days, while ~150 free
// formations stood on the mainland. Here Germany's group stands at San Juan (made Germany's), four
// German divisions on the islets by it that hold no port, the rest of the army in Europe. The group
// sails for Europe. Before, the four were tried, no port was found, and it stood.
describe('the ferry’s way back passes over an army on land with no port (PLAN 7.90c)', () => {
  it('a group at a far port sails for the army past four on port-less islets', () => {
    const { w, tp, more } = stranded(4);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    const water = portSeaOf(w);
    const sj = w.ports.findIndex((p) => p.name === 'San Juan');
    expect(sj).toBeGreaterThanOrEqual(0);
    const from = w.ports[sj]!.cell;
    w.cells.controller[from] = GER;
    const sea = water[sj]!;
    expect(sea).toBeGreaterThanOrEqual(0);
    [c.x[tp], c.y[tp]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp] = 0;
    // The four islets nearest San Juan with no port on them, each a land of its own.
    const ported = new Set<number>();
    w.ports.forEach((p) => ported.add(comp[p.cell]!));
    const best = new Map<number, [number, number]>();
    for (let k = 0; k < W * H; k++) {
      const l = comp[k]!;
      if (l === 0 || l === comp[from] || ported.has(l)) continue;
      const d = Math.abs((k % W) - (from % W)) + Math.abs(Math.floor(k / W) - Math.floor(from / W));
      const b = best.get(l);
      if (b === undefined || d < b[0]) best.set(l, [d, k]);
    }
    const islets = [...best.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 4);
    expect(islets).toHaveLength(4);
    for (const [d] of islets) expect(d).toBeLessThan(40);
    more.forEach((f, i) => {
      [c.x[f], c.y[f]] = w.cellPoint(islets[i]![1]);
      c.moving[f] = 0;
      c.engaged[f] = 0;
      c.retreat[f] = 0;
      c.home[f] = 0;
      w.paths.delete(f);
    });
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    // Under way for a port of Germany's in Europe, the army's land.
    expect(c.moving[tp]).toBe(1);
  });
});

// PLAN 7.90e, ADR-648: the economic AI's ferry want (`wantsFerry`, ADR-614) counted only the army on a
// land with a port of the nation's and no front cell, not the army on a front's land that reaches none
// of its front cells (the ferry's since PLAN 7.79c, ADR-636). Critic run 12, 1129 year 10: the USA, ~150
// free formations on its mainland beside a front they cannot walk to, wanted none with 131,961 gold.
// Here Germany at war with Lithuania, its army west of Poland reaching no front cell, its one transport
// group afloat: three divisions at a home port outnumber its room, so it wants one. Before, it wanted none.
describe('the ferry’s want counts the army that reaches no front on its land (PLAN 7.90e)', () => {
  it('a nation whose army on a front’s land reaches no front cell wants a transport group', () => {
    const { w, tp, home, europe, reaches, more } = stranded(2);
    const c = w.formations.cols;
    const comp = navOf(w).grid.component;
    // Two more divisions standing at the home port with the first: three over the group's room of two.
    for (const f of more) {
      [c.x[f], c.y[f]] = w.cellPoint(home.p.cell);
      c.moving[f] = 0;
      c.engaged[f] = 0;
      c.retreat[f] = 0;
      c.home[f] = 0;
      w.paths.delete(f);
    }
    // Its standing army on Europe that reaches no front cell outnumbers the group's room.
    let men = 0;
    w.formations.forEach((f) => {
      if (c.nation[f] !== GER || w.offLand(f) || w.isWing(f) || w.isFleet(f) || c.moving[f] === 1 || c.engaged[f] === 1) return;
      const k = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
      if (comp[k] === europe && !reaches(k)) men += c.strength[f]!;
    });
    expect(men).toBeGreaterThan(transportRoom(w, tp));
    expect(wantsFerry(w, GER, [tp])).toBe(true);
  });
});
