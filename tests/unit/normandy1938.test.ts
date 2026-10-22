import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.70b: the AI landed only in a war in which it had no land front, and the ferry took a
// nation's army to its own front, so no landing opened a front beside or behind one (critic run 11,
// emergent 6 and naval 7). The United Kingdom in 1938 at war with Germany alone, its front with
// Germany far from its home island (a British cell overseas handed to Germany) and nobody of Germany's near
// it (the front held), an island with a city handed to Germany, its transports at Portsmouth with a group of divisions there: on Britain's
// invasion day the group goes aboard bound for that island, more than DEPLOY_RANGE_CELLS from that
// front. Before, the ferry took them to Britain's port nearest its front in Africa.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const GER = id('GER');

// PLAN 7.73c: the fixture first takes every British land formation off the front's land and from
// within two of `frontHeld`'s squares of the front (1938's colonial garrisons stood near it), so
// that the front's men are what each case puts there. Held: a British division on a front cell,
// the case above. With nobody of either side near, the front is not held, and the ferry takes the
// group there, not overseas. Before, a front with nobody was held (none against none), and the
// group sailed for the island.

/** The fixture above, with a British division on a front cell when `guarded`; the invasion AI's day. */
function britainsDay(guarded: boolean) {
  const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
  const w = s.world;
  s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  s.step(1);
  s.step(24 - (w.tick % 24));
  while ((w.tick / 24 + ENG) % STAGGER !== 0) s.step(24);
  const c = w.formations.cols;
  const ctl = w.cells.controller;
  const water = portSeaOf(w);
  const comp = navOf(w).grid.component;
  const war = declareWar(w, ENG, GER, true);
  expect(war).not.toBeNull();
  const theirs = new Set(war!.sides[war!.sides[0].includes(ENG) ? 1 : 0]);
  expect(theirs.has(GER)).toBe(true);
  // The front: a British cell far from Britain's home island (on a land of 2,000 cells or more),
  // beside another British one, handed to Germany.
  const pi = w.ports.findIndex((p) => p.name === 'Portsmouth');
  expect(pi).toBeGreaterThanOrEqual(0);
  const homeLand = comp[w.ports[pi]!.cell]!;
  const size = new Map<number, number>();
  for (let k = 0; k < W * H; k++) if (comp[k]! > 0) size.set(comp[k]!, (size.get(comp[k]!) ?? 0) + 1);
  let given = -1;
  for (let k = 0; k < W * H && given < 0; k++) {
    const l = comp[k]!;
    if (l === 0 || l === homeLand || size.get(l)! < 2000 || ctl[k] !== ENG) continue;
    if (neighbours4(k, W, H, false, []).some((q) => ctl[q] === ENG) && neighbours4(k, W, H, false, []).every((q) => ctl[q] === ENG || comp[q] === 0)) given = k;
  }
  expect(given).toBeGreaterThanOrEqual(0);
  w.setController(given, GER);
  const front: number[] = [];
  for (let k = 0; k < W * H; k++) if (ctl[k] === ENG && neighbours4(k, W, H, false, []).some((q) => ctl[q] === GER)) front.push(k);
  expect(front.length).toBeGreaterThan(0);
  // Germany's cities stand on Eurasia, where Britain's bloc owns a city: a beachhead there is not
  // fed (PLAN 7.70a's scope). An island with a city, the nearest Portsmouth of those of 50 to
  // 3,000 cells with no city of Britain's, is handed to Germany whole.
  const cityLand = new Map<number, number>();
  w.cities.forEach((city) => {
    const k = w.cities.cols.cell[city]!;
    const l = comp[k]!;
    if (l === 0) return;
    if (ctl[k] === ENG) cityLand.set(l, -1);
    else if (!cityLand.has(l)) cityLand.set(l, k);
  });
  const home = w.ports[pi]!.cell;
  let island = 0;
  let near2 = Infinity;
  for (const [l, k] of cityLand) {
    if (k < 0 || size.get(l)! < 50 || size.get(l)! > 3000) continue;
    const dx = (k % W) - (home % W);
    const dy = Math.floor(k / W) - Math.floor(home / W);
    if (dx * dx + dy * dy < near2) [near2, island] = [dx * dx + dy * dy, l];
  }
  expect(island).toBeGreaterThan(0);
  for (let k = 0; k < W * H; k++) {
    if (comp[k] !== island) continue;
    w.cells.owner[k] = GER;
    w.setController(k, GER);
  }
  // One British transport group, at Portsmouth's water.
  const port = w.ports[pi]!;
  const sea = water[pi]!;
  expect(ctl[port.cell]).toBe(ENG);
  const groups: number[] = [];
  w.formations.forEach((f) => {
    if (w.isFleet(f) && c.nation[f] === ENG && transportRoom(w, f) > 0) groups.push(f);
  });
  const [tp, ...rest] = groups;
  expect(tp).toBeDefined();
  for (const f of rest) destroyFormation(w, f);
  [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
  c.moving[tp!] = 0;
  const room = transportRoom(w, tp!);
  // A group of British divisions at Portsmouth, standing: at least three quarters of the room.
  const div: number[] = [];
  let men = 0;
  w.formations.forEach((f) => {
    if (men >= 0.75 * room || c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f) || men + c.strength[f]! > room) return;
    div.push(f);
    men += c.strength[f]!;
  });
  expect(div.length).toBeGreaterThanOrEqual(2);
  expect(men).toBeGreaterThanOrEqual(0.75 * room);
  for (const f of div) {
    [c.x[f], c.y[f]] = w.cellPoint(port.cell);
    c.moving[f] = 0;
    c.engaged[f] = 0;
    c.retreat[f] = 0;
    c.home[f] = 0;
    w.paths.delete(f);
  }
  // Nobody of Britain's on the front's land or within two of `frontHeld`'s squares of the front,
  // then, when guarded, the front's guard: a British division standing on a front cell, not of
  // the group.
  const bs = Math.ceil(w.atSize(DEPLOY_RANGE_CELLS));
  const nearFront: number[] = [];
  w.formations.forEach((f) => {
    if (c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f)) return;
    const k = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    const near = front.some((q) => Math.abs((q % W) - (k % W)) <= 2 * bs && Math.abs(Math.floor(q / W) - Math.floor(k / W)) <= 2 * bs);
    if (comp[k] === comp[given] || near) nearFront.push(f);
  });
  for (const f of nearFront) destroyFormation(w, f);
  if (guarded) {
    let guard = -1;
    w.formations.forEach((f) => {
      if (guard < 0 && c.nation[f] === ENG && !div.includes(f) && !w.offLand(f) && !w.isWing(f) && !w.isFleet(f)) guard = f;
    });
    expect(guard).toBeGreaterThan(0);
    [c.x[guard], c.y[guard]] = w.cellPoint(front[0]!);
    c.moving[guard] = 0;
    c.engaged[guard] = 0;
    c.retreat[guard] = 0;
    c.home[guard] = 0;
    w.paths.delete(guard);
  }
  // The invasion AI on that day.
  w.settings.aiEnabled = true;
  invasionAi(w);
  w.settings.aiEnabled = false;
  const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === ENG);
  return { w, theirs, front, island, frontLand: comp[given]!, room, aboard };
}

describe('a landing behind the enemy front (PLAN 7.70b)', () => {
  it('a nation at war with a held land front lands its free army on the enemy coast far from that front', () => {
    // The group goes aboard, bound for a German coast far from the front.
    const { w, theirs, front, island, room, aboard } = britainsDay(true);
    const c = w.formations.cols;
    const ctl = w.cells.controller;
    const comp = navOf(w).grid.component;
    expect(aboard.length).toBeGreaterThanOrEqual(2);
    expect(aboard.reduce((m, f) => m + c.strength[f]!, 0)).toBeGreaterThanOrEqual(0.75 * room);
    const targets = new Set(aboard.map((f) => w.embarked.get(f)!.target));
    expect(targets.size).toBe(1);
    const target = [...targets][0]!;
    expect(theirs.has(ctl[target]!)).toBe(true);
    expect(comp[target]).toBe(island);
    const r = w.atSize(DEPLOY_RANGE_CELLS);
    for (const k of front) {
      const dx = (k % W) - (target % W);
      const dy = Math.floor(k / W) - Math.floor(target / W);
      expect(dx * dx + dy * dy).toBeGreaterThan(r * r);
    }
  });

  it('a front with nobody of either side near is not held: the ferry takes the free army there (PLAN 7.73c)', () => {
    const { w, island, frontLand, aboard } = britainsDay(false);
    const comp = navOf(w).grid.component;
    expect(aboard.length).toBeGreaterThanOrEqual(1);
    const targets = new Set(aboard.map((f) => comp[w.embarked.get(f)!.target]!));
    expect(targets.has(island)).toBe(false);
    expect([...targets]).toEqual([frontLand]);
  });
});
