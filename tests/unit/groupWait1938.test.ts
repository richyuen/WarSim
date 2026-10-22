import { describe, expect, it } from 'vitest';
import { invasionAi, NORMANDY_GROUP_SHARE, NORMANDY_WAIT_DAYS } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { marchingToPort, transportRoom } from '../../src/sim/systems/amphibious';
import { formationPath, marchHoursLeft, orderMove } from '../../src/sim/systems/movement';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.73b: a Normandy's group (PLAN 7.70b, ADR-623) held its nation's invasion turn with no
// bound while one of its nation marched to the transports' port, so a march that stalled kept the
// transports from the Normandy and the ferry until it ended. The fixture of `normandy1938.test.ts`
// (Britain at war with Germany, its front overseas, an island with a city handed to Germany, its
// transports at Portsmouth), with one division at the port, under the group's share of the room,
// and a second marching to the port: in a fight on the way (it does not go on), or from the far
// north of the island (more than NORMANDY_WAIT_DAYS away), the one at the port goes aboard on
// Britain's day; a march that is there within the bound is still waited for.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const GER = id('GER');

type Case = 'stalled' | 'near' | 'far';

/** Sets the case up on Britain's invasion day and runs the invasion AI: the British formations aboard, and the marcher's hours left. */
function run(kind: Case): { aboard: number[]; first: number; hours: number; world: World } {
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
  expect(declareWar(w, ENG, GER, true)).not.toBeNull();
  // The front: a British cell overseas, beside another British one, handed to Germany.
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
  // An island with a city and none of Britain's, the nearest Portsmouth, handed to Germany whole.
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
  const sea = water[pi]!;
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
  // Two British divisions on the home island: the first at the port (under the group's share of the
  // room), the second marching to it.
  const div: number[] = [];
  w.formations.forEach((f) => {
    if (div.length === 2 || c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f) || comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)] !== homeLand) return;
    div.push(f);
  });
  expect(div.length).toBe(2);
  const [first, second] = div as [number, number];
  expect(c.strength[first]!).toBeLessThan(NORMANDY_GROUP_SHARE * room);
  for (const f of div) {
    c.moving[f] = 0;
    c.engaged[f] = 0;
    c.retreat[f] = 0;
    c.home[f] = 0;
    w.paths.delete(f);
  }
  [c.x[first], c.y[first]] = w.cellPoint(home);
  // No other British land formation near the port: the first alone stands there.
  const by: number[] = [];
  w.formations.forEach((f) => {
    if (f === first || f === second || c.nation[f] !== ENG || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
    const k = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    if (Math.abs((k % W) - (home % W)) <= 10 && Math.abs(Math.floor(k / W) - Math.floor(home / W)) <= 10) by.push(f);
  });
  for (const f of by) destroyFormation(w, f);
  // The marcher's start: a British cell of the home island 4 to 6 cells from the port, or the
  // farthest from it.
  let start = -1;
  let best = kind === 'far' ? -1 : Infinity;
  for (let k = 0; k < W * H; k++) {
    if (comp[k] !== homeLand || ctl[k] !== ENG) continue;
    const d = Math.abs((k % W) - (home % W)) + Math.abs(Math.floor(k / W) - Math.floor(home / W));
    if (kind === 'far' ? d > best : d >= 4 && d <= 6 && d < best) [start, best] = [k, d];
  }
  expect(start).toBeGreaterThanOrEqual(0);
  [c.x[second], c.y[second]] = w.cellPoint(start);
  const [px, py] = w.cellPoint(home);
  expect(orderMove(w, second, px, py)).toBe(true);
  expect(formationPath(w, second)).not.toBeNull();
  expect(marchingToPort(w, second, [home])).toBe(true);
  if (kind === 'stalled') c.engaged[second] = 1;
  const hours = marchHoursLeft(w, second);
  // The invasion AI on Britain's day.
  w.settings.aiEnabled = true;
  invasionAi(w);
  w.settings.aiEnabled = false;
  const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === ENG);
  return { aboard, first, hours, world: w };
}

describe("a Normandy's group waits for a march to its port within a bound (PLAN 7.73b)", () => {
  it('a march in a fight on the way is not waited for: the division at the port goes aboard', () => {
    const { aboard, first, hours } = run('stalled');
    expect(hours).toBe(Infinity);
    expect(aboard).toContain(first);
  });

  it('a march more than NORMANDY_WAIT_DAYS from the port is not waited for', () => {
    const { aboard, first, hours } = run('far');
    expect(hours).toBeGreaterThan(NORMANDY_WAIT_DAYS * 24);
    expect(aboard).toContain(first);
  });

  it('a march there within NORMANDY_WAIT_DAYS is waited for: nobody goes aboard yet', () => {
    const { aboard, hours } = run('near');
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThanOrEqual(NORMANDY_WAIT_DAYS * 24);
    expect(aboard).toEqual([]);
  });
});
