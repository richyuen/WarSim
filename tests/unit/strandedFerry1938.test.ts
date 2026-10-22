import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { DEPLOY_RANGE_CELLS, groundReader, reachesOnLand } from '../../src/sim/ai/operational';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Refusal } from '../../src/shared/commands';
import { placeFleet } from '../../src/sim/placeForces';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
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
function stranded(): { w: Sim['world']; div: number; tp: number; home: { p: { cell: number }; i: number }; europe: number; reaches: (k: number) => boolean } {
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
  // The front not held: no German land formation within the range of it (`frontHeld`).
  const r = w.atSize(DEPLOY_RANGE_CELLS);
  const nearFront = (x: number, y: number): boolean => front.some((k) => Math.abs((k % W) + 0.5 - x) <= 2 * r && Math.abs(Math.floor(k / W) + 0.5 - y) <= 2 * r);
  const ids: number[] = [];
  w.formations.forEach((f) => ids.push(f));
  for (const f of ids) if (f !== div && c.nation[f] === GER && !w.isFleet(f) && !w.isWing(f) && nearFront(c.x[f]!, c.y[f]!)) destroyFormation(w, f);
  [c.x[div], c.y[div]] = w.cellPoint(home!.p.cell);
  c.moving[div] = 0;
  c.engaged[div] = 0;
  c.retreat[div] = 0;
  c.home[div] = 0;
  w.paths.delete(div);
  expect(reaches(home!.p.cell)).toBe(false);
  return { w, div, tp: tp!, home: home!, europe, reaches };
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
