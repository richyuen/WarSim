import { describe, expect, it } from 'vitest';
import { wantsFerry } from '../../src/sim/ai/economic';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.70c, ADR-624: the ferry took a nation's army only to a port of its own (or an ally's) on a
// front's land, so a beachhead on a land with no such port (a Normandy's, PLAN 7.70b) was never
// reinforced, and the ferry's want bought no transports for it. The United Kingdom in 1938 at war
// with Germany alone; an island with a city, the nearest Portsmouth of those of 50 to 3,000 cells
// with no city of Britain's, handed to Germany whole, but for a beachhead of British cells on its
// coast (Britain's only front), a German division on the island (the front not held: no Normandy);
// British transports at Portsmouth with a division there. On Britain's invasion day the division
// goes aboard for the beachhead; and the ferry's want stands.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const GER = id('GER');

describe('the ferry to a beachhead with no port (PLAN 7.70c)', () => {
  it('ships the home army to a front cell on the coast of a land with no port of its own', () => {
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
    const z = seaOf(w);
    expect(declareWar(w, ENG, GER, true)).not.toBeNull();
    for (const [wing] of [...w.wingBase]) destroyFormation(w, wing);
    const pi = w.ports.findIndex((p) => p.name === 'Portsmouth');
    expect(pi).toBeGreaterThanOrEqual(0);
    const home = w.ports[pi]!.cell;
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
    // No port on the island passes for Britain's: none of Britain's, none of an ally's.
    for (const p of w.ports) if (comp[p.cell] === island) expect(ctl[p.cell]).toBe(GER);
    // The beachhead: the coast cell of the island nearest Portsmouth beside open water, and the
    // island's cells beside it, under British control.
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
    // Britain's only front: the beachhead's cells beside German ones.
    const front: number[] = [];
    for (let k = 0; k < W * H; k++) if (ctl[k] === ENG && neighbours4(k, W, H, false, []).some((q) => ctl[q] === GER)) front.push(k);
    expect(front.length).toBeGreaterThan(0);
    for (const k of front) expect(comp[k]).toBe(island);
    // A German division on the island, beside the beachhead: the front is not held, so no Normandy.
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
    // The ferry's want: the home army stands on a land with a port of Britain's and no front, and the
    // front's land has its beach (before, no port of Britain's there: no want).
    expect(wantsFerry(w, ENG, [])).toBe(true);
    // A British division at Portsmouth, standing.
    let div = 0;
    w.formations.forEach((f) => {
      if (div !== 0 || c.nation[f] !== ENG || w.offLand(f) || w.isWing(f) || w.isFleet(f) || c.strength[f]! > room) return;
      if (comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)] === comp[home]) div = f;
    });
    expect(div).toBeGreaterThan(0);
    [c.x[div], c.y[div]] = w.cellPoint(home);
    c.moving[div] = 0;
    c.engaged[div] = 0;
    c.retreat[div] = 0;
    c.home[div] = 0;
    w.paths.delete(div);
    // The invasion AI on that day: a British division goes aboard, bound for the beachhead.
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    const aboard = [...w.embarked.keys()].filter((f) => c.nation[f] === ENG);
    expect(aboard.length).toBeGreaterThanOrEqual(1);
    for (const f of aboard) {
      const target = w.embarked.get(f)!.target;
      expect(comp[target]).toBe(island);
      expect(ctl[target]).toBe(ENG);
      expect(front).toContain(target);
    }
  });
});
