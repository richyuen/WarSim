import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airSystem, kmFromBase, liveCarriers, orderRebase, wingRange } from '../../src/sim/systems/air';
import { elementIndex, settleFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8l: a fleet keeps a wing to each of its live carriers; the wings beyond them are lost with
// the carriers sunk, the lowest ids kept; a rebase counts its live carriers, not its template's.

const sim = (): World => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
/** A carrier fleet with two carriers and a wing on each. */
function carrierFleet(w: World): { fleet: number; wings: number[] } {
  const fleets = new Set([...w.wingBase.values()].filter((b) => b < 0).map((b) => -b));
  const fleet = [...fleets].sort((a, b) => a - b).find((f) => liveCarriers(w, f) === 2)!;
  const wings = [...w.wingBase].filter(([, b]) => b === -fleet).map(([id]) => id).sort((a, b) => a - b);
  return { fleet, wings };
}
/** Sinks `n` of fleet `fleet`'s carriers, its other ships afloat. */
function sinkCarriers(w: World, fleet: number, n: number): void {
  const cv = w.rules!.units.findIndex((u) => u.cls === 'cv');
  const ec = w.elements.cols;
  const cvs = elementIndex(w).get(fleet)!.filter((e) => ec.unit[e] === cv).slice(0, n);
  for (const e of cvs) ec.strength[e] = 0;
  settleFormation(w, fleet);
}
const destroyed = (w: World): number[] => {
  const out: number[] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.FormationDestroyed) out.push(w.out.events[i + 2]!);
  return out;
};

describe('wings beyond their fleet\'s live carriers (PLAN 5.8l)', () => {
  it('a carrier sunk and the fleet afloat: its wing beyond the live carrier is lost, the lower id kept; both sunk, both lost', () => {
    const w = sim();
    const { fleet, wings } = carrierFleet(w);
    expect(wings).toHaveLength(2);
    sinkCarriers(w, fleet, 1);
    expect(w.formations.has(fleet)).toBe(true);
    expect(liveCarriers(w, fleet)).toBe(1);
    w.out.events.length = 0;
    airSystem(w);
    expect(destroyed(w)).toEqual([wings[1]]);
    expect(w.formations.has(wings[0]!)).toBe(true);
    expect(w.wingBase.get(wings[0]!)).toBe(-fleet);
    expect(w.wingBase.has(wings[1]!)).toBe(false);
    sinkCarriers(w, fleet, 1);
    expect(w.formations.has(fleet)).toBe(true);
    w.out.events.length = 0;
    airSystem(w);
    expect(destroyed(w)).toEqual([wings[0]]);
    expect([...w.wingBase.values()]).not.toContain(-fleet);
  });

  it('a rebase to a fleet counts its live carriers', () => {
    const w = sim();
    const c = w.formations.cols;
    const { fleet, wings } = carrierFleet(w);
    const nation = c.nation[fleet]!;
    const other = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === nation && kmFromBase(w, id, c.x[fleet]!, c.y[fleet]!) < wingRange(w, id));
    expect(other).toBeDefined();
    const [id, home] = other!;
    // A deck freed of one: room for it while both carriers float; not with one sunk.
    w.wingBase.set(wings[1]!, home);
    sinkCarriers(w, fleet, 1);
    expect(orderRebase(w, id, c.x[fleet]!, c.y[fleet]!)).toBe(RejectReason.NoBase);
    expect(w.wingBase.get(id)).toBe(home);
  });
});
