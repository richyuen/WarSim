import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { STAGGER } from '../../src/sim/ai/strategic';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.49f: the invasion AI sends its army to a port's land cell, and `tryLanding` loads a
// formation there (by the port's land cell or its water), but the planner took aboard only those
// within AT_PORT_CELLS of the port's water. At Glasgow the water is 4 cells off the land cell: the
// army stood at the port and was never loaded (seed 2081 year 20: Germany's 56 on Britain, sent all
// 60 days, none aboard). The United Kingdom at war with Iceland (no land front), its one transport
// group at Glasgow's water, a division on Glasgow's cell: it goes aboard on its first planning day.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ICE = id('ICE');
const DEN = id('DEN');

describe('the landing\'s port (PLAN 7.49f)', () => {
  it('a division on the land cell of a port whose water is beyond AT_PORT_CELLS goes aboard', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const glasgow = w.ports.findIndex((p) => p.name === 'Glasgow');
    expect(glasgow).toBeGreaterThanOrEqual(0);
    const port = w.ports[glasgow]!;
    const sea = water[glasgow]!;
    const r = w.atSize(AT_PORT_CELLS);
    const near = (a: number, b: number): boolean => Math.abs((a % W) - (b % W)) <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
    // The case: Glasgow British, its water beyond AT_PORT_CELLS of its land cell.
    expect(w.cells.controller[port.cell]).toBe(ENG);
    expect(sea).toBeGreaterThanOrEqual(0);
    expect(near(port.cell, sea)).toBe(false);
    expect(declareWar(w, ENG, ICE, true)).not.toBeNull();
    // The air out of it, as the invasion test (PLAN 5.12b: British strikes won the peace first).
    for (const [wing] of [...w.wingBase]) if ([ENG, ICE, DEN].includes(c.nation[wing]!)) destroyFormation(w, wing);
    // One British transport group, at Glasgow's water; the others gone.
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === ENG && transportRoom(w, f) > 0) groups.push(f);
    });
    expect(groups.length).toBeGreaterThan(0);
    const [tp, ...rest] = groups;
    for (const f of rest) destroyFormation(w, f);
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    // A division on Glasgow's cell, and no other British land formation by the port's water.
    let div = 0;
    w.formations.forEach((f) => {
      if (div === 0 && c.nation[f] === ENG && !w.isFleet(f) && !w.isWing(f) && !w.offLand(f) && c.strength[f]! <= transportRoom(w, tp!)) div = f;
    });
    expect(div).toBeGreaterThan(0);
    [c.x[div], c.y[div]] = w.cellPoint(port.cell);
    c.moving[div] = 0;
    w.paths.delete(div);
    w.formations.forEach((f) => {
      if (f === div || c.nation[f] !== ENG || w.isFleet(f) || w.isWing(f)) return;
      expect(near(Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!), sea)).toBe(false);
    });
    // It goes aboard within two of its planning days.
    let embarked = -1;
    for (let d = 0; d < 2 * STAGGER && embarked < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationEmbarked && ev[i + 2] === div) embarked = d;
      });
    }
    expect(embarked).toBeGreaterThanOrEqual(0);
    expect(w.embarked.get(div)?.fleet).toBe(tp);
  });
});
