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

// PLAN 7.73a: a Normandy's target was worth its city alone over the enemy's formations near it, so
// of two cities alike the nearest by sea won, however far from the war's front: the armies landed
// where nobody fought (engaged land formations per war-day 0.238 → 0.219 with 7.70b's rule). 7.70b's
// text asks for a city near the enemy's front's rear. The United Kingdom in 1938 at war with Germany
// alone, its front with Germany overseas (as `normandy1938.test.ts`), two islands with cities and no
// British cell handed to Germany: the one nearest Portsmouth and the one nearest that front (beyond
// DEPLOY_RANGE_CELLS of it). The group sails for the one nearest the front; before, for the other.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const GER = id('GER');

describe("a Normandy near the enemy front's rear (PLAN 7.73a)", () => {
  it('of two enemy coasts alike, the group lands on the one nearer its front', () => {
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
    // The front: a British cell far from Britain's home island, beside another British one, handed to Germany.
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
    const r = w.atSize(DEPLOY_RANGE_CELLS);
    const toFront2 = (k: number): number => {
      let d2 = Infinity;
      for (const f of front) {
        const dx = (f % W) - (k % W);
        const dy = Math.floor(f / W) - Math.floor(k / W);
        d2 = Math.min(d2, dx * dx + dy * dy);
      }
      return d2;
    };
    // Islands of 50 to 3,000 cells with a city, no British cell, every cell beyond the deploy range of the front.
    const british = new Set<number>();
    const farOff = new Map<number, boolean>();
    for (let k = 0; k < W * H; k++) {
      const l = comp[k]!;
      if (l === 0) continue;
      if (ctl[k] === ENG) british.add(l);
      if (toFront2(k) <= r * r) farOff.set(l, false);
      else if (!farOff.has(l)) farOff.set(l, true);
    }
    const cityAt = new Map<number, number>();
    w.cities.forEach((city) => {
      const k = w.cities.cols.cell[city]!;
      const l = comp[k]!;
      if (l === 0 || british.has(l) || !farOff.get(l) || size.get(l)! < 50 || size.get(l)! > 3000) return;
      if (!cityAt.has(l)) cityAt.set(l, k);
    });
    const home = w.ports[pi]!.cell;
    const toHome2 = (k: number): number => ((k % W) - (home % W)) ** 2 + (Math.floor(k / W) - Math.floor(home / W)) ** 2;
    const lands = [...cityAt.keys()];
    expect(lands.length).toBeGreaterThanOrEqual(2);
    // The first in order of nearness to the front that has a rival nearer Portsmouth and at least
    // twice as far from the front (the island off Portsmouth is the nearest both); the rival nearest
    // Portsmouth.
    const byFront = [...lands].sort((a, b) => toFront2(cityAt.get(a)!) - toFront2(cityAt.get(b)!) || a - b);
    let nearFront = 0;
    let nearHome = 0;
    for (const l of byFront) {
      const at = cityAt.get(l)!;
      const rivals = lands.filter((m) => toFront2(cityAt.get(m)!) >= 4 * toFront2(at) && toHome2(cityAt.get(m)!) < toHome2(at));
      if (rivals.length === 0) continue;
      rivals.sort((a, b) => toHome2(cityAt.get(a)!) - toHome2(cityAt.get(b)!) || a - b);
      [nearFront, nearHome] = [l, rivals[0]!];
      break;
    }
    expect(nearFront).toBeGreaterThan(0);
    for (let k = 0; k < W * H; k++) {
      if (comp[k] !== nearHome && comp[k] !== nearFront) continue;
      w.cells.owner[k] = GER;
      w.setController(k, GER);
    }
    // One British transport group at Portsmouth's water, and a group of divisions there that fills
    // at least three quarters of its room.
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
    let men = 0;
    w.formations.forEach((f) => {
      if (men >= 0.75 * room || c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f) || men + c.strength[f]! > room) return;
      [c.x[f], c.y[f]] = w.cellPoint(home);
      c.moving[f] = 0;
      c.engaged[f] = 0;
      c.retreat[f] = 0;
      c.home[f] = 0;
      w.paths.delete(f);
      men += c.strength[f]!;
    });
    expect(men).toBeGreaterThanOrEqual(0.75 * room);
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === ENG);
    expect(aboard.length).toBeGreaterThanOrEqual(2);
    const targets = new Set(aboard.map((f) => w.embarked.get(f)!.target));
    expect(targets.size).toBe(1);
    expect(comp[[...targets][0]!]).toBe(nearFront);
  });
});
