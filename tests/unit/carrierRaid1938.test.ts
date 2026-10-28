import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airAi } from '../../src/sim/ai/air';
import { airSystem } from '../../src/sim/systems/air';
import { destroyFormation, elementIndex } from '../../src/sim/systems/elements';
import { isDayStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { RAID_STRIDE } from '../../src/shared/protocol';
import { carrierRaids } from '../../src/worker/carrierRaids';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.154a (critic run 17): a carrier's strike out of a sea battle (ADR-738: ashore, or at a fleet in range) was
// drawn as land-based planes with no row in the ticker, and the critic's runs counted no ship sunk from the air.
// `carrierRaids` gives the ticker a row for it, by the carrier's nation and its target's; `CarrierSunk` tells the
// ships a carrier's wings sank, out of a battle and in one, which the headless report sums.

const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
/** The sim's events, [tick, kind, a, b, x, y] each (`TickOutputs.emit`; a snapshot's have a seq first). */
const STRIDE = 6;

/** Britain and Germany at war, Britain's land-based wings gone, a German fleet off the Orkneys kept or none; the AI on for Britain alone. */
function setup(keepFleet: boolean): { w: World; wing: number; fleet: number; target: number } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.nations.forEach((n) => (w.nations.cols.aiOff[n] = n === ENG ? 0 : 1));
  w.wars.start([ENG], [GER], 0);
  const c = w.formations.cols;
  for (const [id, b] of [...w.wingBase]) if (b > 0 && c.nation[id] === ENG) destroyFormation(w, id);
  const german = w.formations.ids().filter((id) => w.isFleet(id) && c.nation[id] === GER);
  const [wing, base] = [...w.wingBase].find(([id, b]) => b < 0 && c.nation[id] === ENG)!;
  let target: number;
  if (keepFleet) {
    // The fleet with the most ships, at sea east of the Orkneys.
    target = german.sort((a, b) => (elementIndex(w).get(b)?.length ?? 0) - (elementIndex(w).get(a)?.length ?? 0))[0]!;
    for (const id of german) if (id !== target) destroyFormation(w, id);
    [c.x[target], c.y[target]] = cellOf(0.5, 59.2, SIZE_1938.w, SIZE_1938.h).map((v) => Math.floor(v) + 0.5) as [number, number];
  } else {
    for (const id of german) destroyFormation(w, id);
    const [x, y] = cellOf(-4.2, 57.5, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
    target = addDivision(w, GER, x + 0.5, y + 0.5);
  }
  return { w, wing, fleet: -base, target };
}

/** The rows of `carrierRaids` as objects. */
function rows(w: World): { by: number; on: number; ashore: number; fleet: number; tx: number; ty: number; mw: number; mh: number }[] {
  const r = carrierRaids(w);
  expect(r.length % RAID_STRIDE).toBe(0);
  const out = [];
  for (let i = 0; i < r.length; i += RAID_STRIDE) out.push({ tx: r[i + 2]!, ty: r[i + 3]!, by: r[i + 4]!, on: r[i + 5]!, ashore: r[i + 6]!, fleet: r[i + 7]!, mw: r[i + 10]!, mh: r[i + 11]! });
  return out;
}

/** The ships of fleet `id` afloat. */
const ships = (w: World, id: number): number => (w.formations.has(id) ? (elementIndex(w).get(id) ?? []).reduce((s, e) => s + w.elements.cols.strength[e]!, 0) : 0);

describe("a carrier's strike out of a sea battle (PLAN 7.154a)", () => {
  it('ashore: a ticker row names the carrier\'s nation and the nation whose division it strikes', () => {
    const { w, wing, fleet, target } = setup(false);
    expect(rows(w)).toEqual([]);
    airAi(w);
    expect(w.wingMission.get(wing)?.kind).toBe('strike');
    airSystem(w);
    expect(w.sorties.has(wing)).toBe(true);
    // Its fleet's row (Britain's other carriers strike too).
    const r = rows(w).filter((x) => x.fleet === fleet);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ by: ENG, on: GER, ashore: 1, fleet });
    const c = w.formations.cols;
    expect([r[0]!.tx, r[0]!.ty]).toEqual([c.x[target], c.y[target]]);
    // Its frame holds the carrier's fleet and the target.
    expect(r[0]!.mw).toBeCloseTo(Math.abs(c.x[target]! - c.x[fleet]!), 3);
    expect(r[0]!.mh).toBeCloseTo(Math.abs(c.y[target]! - c.y[fleet]!), 3);
    // In a sea battle its fleet has no such row: the battle's is its.
    w.seaBattles.push({ fleets: [fleet], ships: [1], range: 20, a: ENG, b: GER, lostA: 0, lostB: 0, x: c.x[fleet]!, y: c.y[fleet]! });
    expect(rows(w).filter((x) => x.fleet === fleet)).toEqual([]);
  });

  it("at a fleet: the row names the fleet's nation, and the ships its wings sink are told (CarrierSunk), every one", () => {
    const { w, fleet, target } = setup(true);
    const had = ships(w, target);
    expect(had).toBeGreaterThan(0);
    let told = 0;
    let rowed = 0;
    const start = w.tick;
    for (; w.tick < start + 24 * 20 && w.formations.has(target) && ships(w, target) === had - told; w.tick++) {
      if (isDayStart(w.tick)) airAi(w);
      w.out.events.length = 0;
      airSystem(w);
      const r = rows(w).find((x) => x.fleet === fleet);
      if (r) {
        expect(r).toMatchObject({ by: ENG, on: GER, ashore: 0 });
        rowed++;
      }
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += STRIDE) {
        if (ev[i + 1] !== EventKind.CarrierSunk) continue;
        expect(ev[i + 2]).toBe(ENG);
        told += ev[i + 3]!;
      }
      if (told > 0) break;
    }
    expect(rowed, 'hours with its row').toBeGreaterThan(0);
    expect(told, 'ships told sunk by the carrier').toBeGreaterThan(0);
    // Only the deck's wings strike it: what was told is what it lost.
    expect(had - ships(w, target)).toBe(told);
  });

  it('in a sea battle: ships sunk by the carrier\'s wings are told, at the battle, a share of those the battle sank', () => {
    const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
    const sim = new Sim({ scenario: '1938', seed: 6131, assets: assets1938(SIZE_1938.w) });
    sim.command({ kind: 'declareWar', attacker: id('GER'), defender: id('ENG') });
    sim.command({ kind: 'declareWar', attacker: id('JAP'), defender: id('USA') });
    let told = 0;
    let lost = 0;
    let inBattle = 0;
    for (let hour = 0; hour < 24 * 30 && inBattle === 0; hour++) {
      sim.step(1, (w) => {
        const ev = w.out.events;
        for (let i = 0; i < ev.length; i += STRIDE) {
          if (ev[i + 1] !== EventKind.CarrierSunk) continue;
          told += ev[i + 3]!;
          if (w.seaBattles.some((b) => b.x === ev[i + 4] && b.y === ev[i + 5])) {
            inBattle += ev[i + 3]!;
            lost = w.seaBattles.filter((b) => b.x === ev[i + 4] && b.y === ev[i + 5]).reduce((s, b) => s + b.lostA + b.lostB, 0);
          }
        }
        ev.length = 0;
        w.out.fires.length = 0;
      });
    }
    expect(inBattle, 'ships told sunk by carriers in a sea battle within 30 days').toBeGreaterThan(0);
    expect(inBattle).toBeLessThanOrEqual(lost + 1e-9);
    expect(told).toBeGreaterThanOrEqual(inBattle);
  });
});
