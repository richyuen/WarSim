import { describe, expect, it } from 'vitest';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, kmFromBase, ofSide, orderFerry, orderMission, seaFerryKmh, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.133 (ADR-723): a wing whose hop toward its front finds no airbase goes over the sea to a base of
// its side in reach of the front, at sea for the hours a convoy takes; until then it flies nothing.

const [USA, ENG, GER] = ['USA', 'ENG', 'GER'].map(nationId) as [number, number, number];
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const usFighters = (w: World): number[] => [...w.wingBase].filter(([id, b]) => b > 0 && w.formations.cols.nation[id] === USA && tmpl(w, id) === 'fighter_group').map(([id]) => id).sort((a, b) => a - b);

/** The United States and Britain at war with Germany; the AI on for the United States alone. */
function atlantic(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.nations.forEach((n) => (w.nations.cols.aiOff[n] = n === USA ? 0 : 1));
  w.wars.start([USA, ENG], [GER], 0);
  return s;
}
const quiet = (w: World): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
const sim = atlantic();
const w = sim.world;
// Days until a US fighter wing is at sea (its hops to the coast come first).
let ship = -1;
for (let d = 0; d < 40 && ship < 0; d++) {
  sim.step(24, quiet);
  ship = usFighters(w).find((id) => w.wingFerry.has(id)) ?? -1;
}

describe('wings cross the sea (PLAN 7.133)', () => {
  it('a US fighter wing with no hop toward Germany sails to a base of its side in reach of a German division', () => {
    expect(ship).toBeGreaterThan(0);
    const c = w.formations.cols;
    const base = w.wingBase.get(ship)!;
    expect(base).toBeGreaterThan(0);
    const cell = w.airbases[base - 1]!.cell;
    expect(ofSide(w, USA, w.cells.controller[cell]!)).toBe(true);
    expect(w.cells.controller[cell]).not.toBe(USA);
    // A German land formation within its range of the new base.
    const [bx, by] = basePlace(w, base)!;
    let near = false;
    w.formations.forEach((g) => {
      if (c.nation[g] === GER && !w.isWing(g) && !w.isFleet(g) && !w.offLand(g) && seaKm(w, bx, by, c.x[g]!, c.y[g]!) <= wingRange(w, ship)) near = true;
    });
    expect(near).toBe(true);
    // It is still where it sailed from: the far side of the Atlantic.
    expect(seaKm(w, c.x[ship]!, c.y[ship]!, bx, by)).toBeGreaterThan(2 * wingRange(w, ship));
  });

  it('at sea it flies nothing and takes no order; on arrival it is at its base and the AI tasks it', () => {
    const due = w.wingFerry.get(ship)!;
    const c = w.formations.cols;
    const from: [number, number] = [c.x[ship]!, c.y[ship]!];
    const [bx, by] = basePlace(w, w.wingBase.get(ship)!)!;
    // The hours a convoy takes over the straight line.
    expect(due - w.tick).toBeLessThanOrEqual(Math.ceil(seaKm(w, from[0], from[1], bx, by) / seaFerryKmh(w)));
    expect(orderMission(w, ship, 'patrol', bx, by)).not.toBe(0);
    while (w.tick < due - 1) {
      sim.step(1, quiet);
      expect(w.sorties.has(ship)).toBe(false);
      expect(w.wingMission.has(ship)).toBe(false);
    }
    sim.step(2, quiet);
    expect(w.wingFerry.has(ship)).toBe(false);
    expect([c.x[ship], c.y[ship]]).toEqual([bx, by]);
    // The next day's orders give it a mission within its range.
    sim.step(24, quiet);
    const m = w.wingMission.get(ship);
    expect(m).toBeDefined();
    expect(kmFromBase(w, ship, m!.x, m!.y)).toBeLessThanOrEqual(wingRange(w, ship));
  });

  it('a wing at sea saves and loads bit-identically; an order from a carrier or to a base not of its side is refused', () => {
    const s = atlantic();
    const ww = s.world;
    const id = usFighters(ww)[0]!;
    const own = ww.wingBase.get(id)!;
    const eng = ww.airbases.findIndex((b) => ww.cells.controller[b.cell] === ENG) + 1;
    const ger = ww.airbases.findIndex((b) => ww.cells.controller[b.cell] === GER) + 1;
    expect(orderFerry(ww, id, ger)).not.toBe(0);
    expect(orderFerry(ww, id, own)).not.toBe(0);
    expect(orderFerry(ww, id, eng)).toBe(0);
    expect(ww.wingBase.get(id)).toBe(eng);
    expect(orderFerry(ww, id, eng)).not.toBe(0);
    const bytes = s.save();
    const t = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    t.load(bytes);
    expect(t.world.wingFerry.get(id)).toBe(ww.wingFerry.get(id));
    expect(t.hash()).toBe(s.hash());
    const carried = [...ww.wingBase].find(([, b]) => b < 0)?.[0];
    if (carried !== undefined) expect(orderFerry(ww, carried, eng)).not.toBe(0);
  });
});
