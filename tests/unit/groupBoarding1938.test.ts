import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.72: the first formation's landing order set the transports sailing, and `tryLanding` took
// standing transports alone, so every landing and every ferry trip carried one formation, whatever
// the room. The United Kingdom in 1938 at war with Germany alone, one British transport group at
// Portsmouth and two British divisions there whose men it has room for, both standing: on Britain's
// invasion day both go aboard on that group, for a landing (Britain with no land front) and for the
// ferry (Britain's only front a beachhead on an island of Germany's with a German division beside
// it, as in `beachFerry1938.test.ts`).

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const GER = id('GER');

/** The 1938 world on Britain's invasion day, Britain at war with Germany, its air wings gone. */
function start(): World {
  const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
  const w = s.world;
  s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  s.step(1);
  s.step(24 - (w.tick % 24));
  while ((w.tick / 24 + ENG) % STAGGER !== 0) s.step(24);
  expect(declareWar(w, ENG, GER, true)).not.toBeNull();
  for (const [wing] of [...w.wingBase]) destroyFormation(w, wing);
  return w;
}

/** Britain's one transport group at Portsmouth's water, standing, and two of its divisions at Portsmouth that fit in it together: [group, a, b]. */
function atPortsmouth(w: World): [number, number, number] {
  const c = w.formations.cols;
  const comp = navOf(w).grid.component;
  const pi = w.ports.findIndex((p) => p.name === 'Portsmouth');
  expect(pi).toBeGreaterThanOrEqual(0);
  const home = w.ports[pi]!.cell;
  const sea = portSeaOf(w)[pi]!;
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
  // The two smallest British land formations on the home island, the rest of the home army sent off it.
  const divs: number[] = [];
  w.formations.forEach((f) => {
    if (c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f)) return;
    if (comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)] === comp[home]) divs.push(f);
  });
  divs.sort((a, b) => c.strength[a]! - c.strength[b]! || a - b);
  const [a, b, ...others] = divs;
  expect(b).toBeDefined();
  expect(c.strength[a!]! + c.strength[b!]!).toBeLessThanOrEqual(room);
  for (const f of others) destroyFormation(w, f);
  for (const f of [a!, b!]) {
    [c.x[f], c.y[f]] = w.cellPoint(home);
    c.moving[f] = 0;
    c.engaged[f] = 0;
    c.retreat[f] = 0;
    c.home[f] = 0;
    w.paths.delete(f);
  }
  return [tp!, a!, b!];
}

/** The British formations aboard after Britain's invasion turn, each on group `tp`. */
function boarded(w: World, tp: number): number[] {
  w.settings.aiEnabled = true;
  invasionAi(w);
  w.settings.aiEnabled = false;
  const c = w.formations.cols;
  const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === ENG);
  for (const f of aboard) expect(w.embarked.get(f)!.fleet).toBe(tp);
  return aboard;
}

describe('the landing and the ferry board as a group (PLAN 7.72)', () => {
  it('a landing in a war with no front takes both divisions on the one transport group', () => {
    const w = start();
    const ctl = w.cells.controller;
    // Britain has no land front with Germany in 1938.
    for (let k = 0; k < W * H; k++) if (ctl[k] === ENG) expect(neighbours4(k, W, H, false, []).some((q) => ctl[q] === GER)).toBe(false);
    const [tp, a, b] = atPortsmouth(w);
    const aboard = boarded(w, tp);
    expect(aboard).toContain(a);
    expect(aboard).toContain(b);
    // Bound for one landing.
    expect(new Set(aboard.map((f) => w.embarked.get(f)!.water)).size).toBe(1);
  });

  it('the ferry to a front takes both divisions on the one transport group', () => {
    const w = start();
    const c = w.formations.cols;
    const ctl = w.cells.controller;
    const comp = navOf(w).grid.component;
    const z = seaOf(w);
    const home = w.ports[w.ports.findIndex((p) => p.name === 'Portsmouth')]!.cell;
    // The island: of 50 to 3,000 cells, a city on it and none of Britain's, the nearest Portsmouth.
    const size = new Map<number, number>();
    for (let k = 0; k < W * H; k++) if (comp[k]! > 0) size.set(comp[k]!, (size.get(comp[k]!) ?? 0) + 1);
    const cityLand = new Map<number, number>();
    w.cities.forEach((city) => {
      const k = w.cities.cols.cell[city]!;
      const l = comp[k]!;
      if (l === 0) return;
      if (ctl[k] === ENG) cityLand.set(l, -1);
      else if (!cityLand.has(l)) cityLand.set(l, k);
    });
    let island = 0;
    let near2 = Infinity;
    for (const [l, k] of cityLand) {
      if (k < 0 || size.get(l)! < 50 || size.get(l)! > 3000) continue;
      const dx = (k % W) - (home % W);
      const dy = Math.floor(k / W) - Math.floor(home / W);
      if (dx * dx + dy * dy < near2) [near2, island] = [dx * dx + dy * dy, l];
    }
    expect(island).toBeGreaterThan(0);
    const cells: number[] = [];
    for (let k = 0; k < W * H; k++) {
      if (comp[k] !== island) continue;
      cells.push(k);
      w.cells.owner[k] = GER;
      w.setController(k, GER);
    }
    // The beachhead: the island's coast cell nearest Portsmouth beside open water, and its cells beside it.
    const open = (q: number): boolean => z.zoneOf[q] !== 0 && z.closed[z.zoneOf[q]!] !== 1;
    let shore = -1;
    let d2 = Infinity;
    for (const k of cells) {
      if (!neighbours4(k, W, H, false, []).some(open)) continue;
      const dx = (k % W) - (home % W);
      const dy = Math.floor(k / W) - Math.floor(home / W);
      if (dx * dx + dy * dy < d2) [d2, shore] = [dx * dx + dy * dy, k];
    }
    expect(shore).toBeGreaterThanOrEqual(0);
    const beachhead = [shore, ...neighbours4(shore, W, H, false, []).filter((q) => comp[q] === island)];
    for (const k of beachhead) w.setController(k, ENG);
    const front: number[] = [];
    for (let k = 0; k < W * H; k++) if (ctl[k] === ENG && neighbours4(k, W, H, false, []).some((q) => ctl[q] === GER)) front.push(k);
    expect(front.length).toBeGreaterThan(0);
    // A German division beside the beachhead: the front not held, so the ferry, not a Normandy.
    let ger = 0;
    w.formations.forEach((f) => {
      if (ger === 0 && c.nation[f] === GER && !w.isFleet(f) && !w.isWing(f) && !w.offLand(f)) ger = f;
    });
    expect(ger).toBeGreaterThan(0);
    const inland = cells.find((k) => ctl[k] === GER && neighbours4(k, W, H, false, []).some((q) => beachhead.includes(q)))!;
    expect(inland).toBeDefined();
    [c.x[ger], c.y[ger]] = w.cellPoint(inland);
    c.moving[ger] = 0;
    w.paths.delete(ger);
    const [tp, a, b] = atPortsmouth(w);
    const aboard = boarded(w, tp);
    expect(aboard).toContain(a);
    expect(aboard).toContain(b);
    for (const f of aboard) expect(front).toContain(w.embarked.get(f)!.target);
  });
});
