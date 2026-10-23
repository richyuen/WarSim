import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { LANDING_ORG, orderLanding, TRANSPORT_MEN, transportRoom } from '../../src/sim/systems/amphibious';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, runEvents } from '../helpers/sim1938';

// PLAN 4.5a: embark, sail, land. AT: a British infantry division at Portsmouth ordered to
// Calais goes aboard the transports there, sails, and lands on the French coast (the critic's
// R3-B1: it had walked to the coast of Kent and stood there).

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const portCell = (w: World, name: string): number => w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name)!.cell;
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
const comp = (w: World, x: number, y: number): number => navOf(w).grid.component[Math.floor(y) * W + Math.floor(x)]!;
const cellOfF = (w: World, f: number): number => Math.floor(w.formations.cols.y[f]!) * W + Math.floor(w.formations.cols.x[f]!);
/** A British infantry division standing in Portsmouth's cell. */
const atPortsmouth = (w: World): number => {
  const c = portCell(w, 'Portsmouth');
  const [x, y] = w.cellPoint(c);
  return addDivision(w, ENG, x, y);
};
const order = (s: Sim, f: number, x: number, y: number): boolean => {
  s.command({ kind: 'moveFormation', id: f, x, y });
  let no = false;
  s.applyNow((world) => {
    for (let i = 0; i < world.out.events.length; i += 6) if (world.out.events[i + 1] === EventKind.MoveRejected && world.out.events[i + 2] === f) no = true;
  });
  return !no;
};

describe('amphibious movement (PLAN 4.5a)', () => {
  it('the AT: a division at Portsmouth ordered to Calais embarks, sails and lands on the French coast, in disorder', () => {
    const s = sim();
    const w = s.world;
    const div = atPortsmouth(w);
    const [cx, cy] = at(1.86, 50.95);
    expect(comp(w, cx, cy)).not.toBe(comp(w, w.formations.cols.x[div]!, w.formations.cols.y[div]!));
    expect(order(s, div, cx, cy)).toBe(true);
    expect(w.embarked.has(div)).toBe(true);
    expect(w.afloat(div)).toBe(true);
    expect(w.isFleet(div)).toBe(false);
    const fleet = w.embarked.get(div)!.fleet;
    expect(w.isFleet(fleet)).toBe(true);
    expect(w.formations.cols.moving[fleet]).toBe(1);
    let landed = -1;
    let hours = 0;
    while (landed < 0 && hours < 72) {
      for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationLanded && e[2] === div) landed = hours;
      hours++;
      // Aboard, where its transports are.
      if (landed < 0) expect([w.formations.cols.x[div], w.formations.cols.y[div]]).toEqual([w.formations.cols.x[fleet], w.formations.cols.y[fleet]]);
    }
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(w.embarked.has(div)).toBe(false);
    expect(w.afloat(div)).toBe(false);
    // On the land of Calais, in France, within a few cells of it; its org at most LANDING_ORG.
    const here = cellOfF(w, div);
    expect(comp(w, w.formations.cols.x[div]!, w.formations.cols.y[div]!)).toBe(comp(w, cx, cy));
    expect(w.formations.cols.org[div]).toBeLessThanOrEqual(LANDING_ORG);
    expect(Math.abs((here % W) - Math.floor(cx)) + Math.abs(Math.floor(here / W) - Math.floor(cy))).toBeLessThan(12);
    process.stderr.write(`Portsmouth to Calais: landed in hour ${landed} at cell (${here % W}, ${Math.floor(here / W)}), Calais (${Math.floor(cx)}, ${Math.floor(cy)})\n`);
  });

  it('a division at no port of its nation, or with no transports with room there, marches as before: to the coast of its own land within TARGET_SNAP_CELLS', () => {
    const s = sim();
    const w = s.world;
    const [bx, by] = at(-1.9, 52.48); // Birmingham: inland
    const inland = addDivision(w, ENG, bx, by);
    const [cx, cy] = at(1.86, 50.95);
    // Not aboard: it marches to the coast of Kent, the nearest cell of Britain to Calais.
    expect(order(s, inland, cx, cy)).toBe(true);
    expect(w.embarked.has(inland)).toBe(false);
    expect(w.formations.cols.moving[inland]).toBe(1);
    const goal = w.formations.cols.targetCell[inland]!;
    expect(comp(w, (goal % W) + 0.5, Math.floor(goal / W) + 0.5)).toBe(comp(w, bx, by));
    // Room: Portsmouth's two transport groups carry 2 × 12 × TRANSPORT_MEN; divisions go aboard until one does not fit.
    const room = [...w.formations.ids()].filter((f) => w.isFleet(f) && transportRoom(w, f) > 0 && Math.abs((cellOfF(w, f) % W) - (portCell(w, 'Portsmouth') % W)) <= 3 && Math.abs(Math.floor(cellOfF(w, f) / W) - Math.floor(portCell(w, 'Portsmouth') / W)) <= 3).reduce((s2, f) => s2 + transportRoom(w, f), 0);
    expect(room).toBe(2 * 12 * TRANSPORT_MEN);
    let aboard = 0;
    let refused = false;
    for (let k = 0; k < 6 && !refused; k++) {
      const d = atPortsmouth(w);
      order(s, d, cx, cy);
      if (w.embarked.has(d)) aboard++;
      else refused = true;
    }
    expect(refused).toBe(true);
    // A player's order sets a group sailing with its first division, so each takes one: two go
    // aboard, the third marches (the AI's next goes on the group it names, below).
    expect(aboard).toBe(2);
  });

  // PLAN 7.90d (ADR-647): a group's 12 transports were given 24,000 men, "two divisions", and a
  // division of 1938 is 12,460, so every ferry trip and landing took one a group.
  it('a transport group takes two full infantry divisions on one trip, the second on the group already under way', () => {
    const s = sim();
    const w = s.world;
    const [cx, cy] = at(1.86, 50.95);
    const first = atPortsmouth(w);
    const second = atPortsmouth(w);
    expect(w.formations.cols.strength[first]).toBe(12460);
    expect(w.formations.cols.strength[second]).toBe(12460);
    expect(orderLanding(w, first, cx, cy)).toBe(true);
    const fleet = w.embarked.get(first)!.fleet;
    expect(transportRoom(w, fleet)).toBe(12 * TRANSPORT_MEN);
    expect(orderLanding(w, second, cx, cy, fleet)).toBe(true);
    expect(w.embarked.get(second)?.fleet).toBe(fleet);
  });

  // PLAN 7.90g (ADR-649): with the group it names full, a formation is refused, and no other group at
  // the port sails with it alone (critic run 12, 6421 year 20: 21 groups at Norfolk sailed with one
  // division each on one ferry turn; 1129 year 10: four divisions aboard three groups, 2 / 1 / 1).
  it('a formation ordered on a full group is refused, and Portsmouth\'s other group stays', () => {
    const s = sim();
    const w = s.world;
    const c = w.formations.cols;
    const [cx, cy] = at(1.86, 50.95);
    const divs = [atPortsmouth(w), atPortsmouth(w), atPortsmouth(w)];
    const groupsUnderWay = (): number => {
      let k = 0;
      w.formations.forEach((o) => {
        if (w.isFleet(o) && c.nation[o] === ENG && transportRoom(w, o) > 0 && c.moving[o] === 1) k++;
      });
      return k;
    };
    expect(groupsUnderWay()).toBe(0);
    expect(orderLanding(w, divs[0]!, cx, cy)).toBe(true);
    const fleet = w.embarked.get(divs[0]!)!.fleet;
    expect(orderLanding(w, divs[1]!, cx, cy, fleet)).toBe(true);
    // Full: the third is refused, though the port's other group has room for it.
    expect(orderLanding(w, divs[2]!, cx, cy, fleet)).toBe(false);
    expect(w.embarked.has(divs[2]!)).toBe(false);
    expect(groupsUnderWay()).toBe(1);
    // Named, the other group takes it.
    let other = 0;
    w.formations.forEach((o) => {
      if (other === 0 && o !== fleet && w.isFleet(o) && c.nation[o] === ENG && transportRoom(w, o) > 0 && c.moving[o] === 0 && orderLanding(w, divs[2]!, cx, cy, o)) other = o;
    });
    expect(other).toBeGreaterThan(0);
    expect(w.embarked.get(divs[2]!)?.fleet).toBe(other);
  });

  it('transports sunk with a division aboard take it with them', () => {
    const s = sim();
    const w = s.world;
    const div = atPortsmouth(w);
    const [cx, cy] = at(1.86, 50.95);
    expect(order(s, div, cx, cy)).toBe(true);
    s.step(2);
    const fleet = w.embarked.get(div)!.fleet;
    destroyFormation(w, fleet);
    s.step(1);
    expect(w.formations.has(div)).toBe(false);
    expect(w.embarked.size).toBe(0);
  });

  it('a save in the middle of the crossing loads to the same state and lands the same', () => {
    const s = sim();
    const w = s.world;
    const div = atPortsmouth(w);
    const [cx, cy] = at(1.86, 50.95);
    expect(order(s, div, cx, cy)).toBe(true);
    s.step(3);
    expect(w.embarked.has(div)).toBe(true);
    const t = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect([...t.world.embarked]).toEqual([...w.embarked]);
    s.step(48);
    t.step(48);
    expect(t.hash()).toBe(s.hash());
    expect(t.world.embarked.has(div)).toBe(false);
  });
});
