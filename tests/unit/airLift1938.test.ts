import { describe, expect, it } from 'vitest';
import { RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { isTransport, orderMission } from '../../src/sim/systems/air';
import { AIR_LIFT, airLift } from '../../src/sim/systems/airLift';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.8u1: air supply. A transport wing's sortie on a supply mission lifts AIR_LIFT of a
// formation's supply an aircraft to its side's formations short of it at the target, shared; a
// wing not of transports is refused the mission; the mission is saved.

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const [cx, cy] = cellOf(19.0, 52.0, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
const TARGET: [number, number] = [cx + 0.5, cy + 0.5];
function sim(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.settings.aiEnabled = false;
  const c = w.formations.cols;
  for (const id of [...w.formations.ids()]) if (!w.offLand(id) && Math.abs(c.x[id]! - TARGET[0]) <= 3 && Math.abs(c.y[id]! - TARGET[1]) <= 3) destroyFormation(w, id);
  w.wars.start([GER], [POL], 0);
  return s;
}
const transports = (w: World): number => [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && tmpl(w, id) === 'air_transport_group')![0];
/** Wing `id` reaching the target this hour on a `kind` mission there. */
function arriving(w: World, id: number, kind: 'supply' | 'strike' = 'supply'): void {
  w.wingMission.set(id, { kind, x: TARGET[0], y: TARGET[1] });
  w.sorties.set(id, { bx: TARGET[0] - 2, by: TARGET[1], tx: TARGET[0], ty: TARGET[1], launch: w.tick - 0.5, kmh: 400, km: 200, over: 0 });
}
const aircraft = (w: World, id: number): number => {
  let n = 0;
  w.elements.forEach((e) => void (w.elements.cols.formation[e] === id && (n += w.elements.cols.strength[e]!)));
  return n;
};

describe('air supply (PLAN 5.8u1)', () => {
  it('a German transport group lifts a German division cut off at the target by its aircraft × AIR_LIFT; a Polish one there gets none', () => {
    const w = sim().world;
    const wing = transports(w);
    expect(isTransport(w, wing)).toBe(true);
    expect(aircraft(w, wing)).toBe(24);
    const div = addDivision(w, GER, cx, cy);
    const pol = addDivision(w, POL, cx + 1, cy);
    const c = w.formations.cols;
    [c.supply[div], c.supply[pol]] = [0.1, 0.1];
    arriving(w, wing);
    airLift(w);
    expect(c.supply[div]).toBeCloseTo(0.1 + 24 * AIR_LIFT, 12);
    expect(c.supply[pol]).toBe(0.1);
    // Not again the next hour: it is on its way home.
    w.tick++;
    airLift(w);
    expect(c.supply[div]).toBeCloseTo(0.1 + 24 * AIR_LIFT, 12);
  });

  it('two divisions short: the same share each, none past full; one in full supply takes none', () => {
    const w = sim().world;
    const wing = transports(w);
    const [a, b, full] = [addDivision(w, GER, cx, cy), addDivision(w, GER, cx, cy + 1), addDivision(w, GER, cx + 1, cy)];
    const c = w.formations.cols;
    [c.supply[a], c.supply[b], c.supply[full]] = [0.1, 0.9, 1];
    arriving(w, wing);
    airLift(w);
    expect(c.supply[a]).toBeCloseTo(0.1 + (24 * AIR_LIFT) / 2, 12);
    expect(c.supply[b]).toBe(1);
    expect(c.supply[full]).toBe(1);
  });

  it('a fighter group is refused a supply mission; a transport group\'s is kept, and saved', () => {
    const s = sim();
    const w = s.world;
    const fighter = [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && tmpl(w, id) === 'fighter_group')![0];
    expect(orderMission(w, fighter, 'supply', ...TARGET)).toBe(RejectReason.NotLand);
    const wing = transports(w);
    expect(orderMission(w, wing, 'supply', ...TARGET)).toBe(0);
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    expect(u.world.wingMission.get(wing)).toEqual({ kind: 'supply', x: TARGET[0], y: TARGET[1] });
    expect(u.hash()).toBe(s.hash());
  });
});
