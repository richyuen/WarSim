import { describe, expect, it } from 'vitest';
import { CARRIER_WING, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { liveCarriers } from '../../src/sim/systems/air';
import { queueFormation } from '../../src/sim/systems/production';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.137 (ADR-725): a carrier group delivered carries its air groups, a CARRIER_WING aboard each carrier,
// their gold and manpower in its price, as the start's carriers carry theirs (`addWings`).

const USA = nationId('USA');
const index = (id: string): number => TEMPLATES_1938.findIndex((t) => t.id === id);
const quiet = (w: World): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};

describe('a carrier group delivered (PLAN 7.137)', () => {
  it("is priced with its air groups: the fleet's ships and a carrier wing's gold for each carrier", () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const rules = w.rules!;
    const group = rules.templates[index('carrier_group')]!;
    const wing = rules.templates[index(CARRIER_WING)]!;
    const cruisers = rules.templates[index('cruiser_squadron')]!;
    // The carrier group: 2 carriers, 2 heavy cruisers, 6 destroyers; the wings: 2 naval bomber groups.
    const carriers = group.elements.filter((e) => rules.units[e.unit]!.cls === 'cv').reduce((s, e) => s + e.count, 0);
    expect(carriers).toBe(2);
    const ships = group.gold - carriers * wing.gold;
    expect(ships).toBeGreaterThan(cruisers.gold);
    expect(rules.carrierWing).toBe(index(CARRIER_WING));
  });

  it('comes with a wing aboard each carrier, and the state saves and loads bit-identically', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    const w = s.world;
    const nc = w.nations.cols;
    const t = index('carrier_group');
    nc.gold[USA] = 1e6;
    nc.manpower[USA] = 1e6;
    const row = queueFormation(w, USA, t);
    expect(row).toBeGreaterThan(0);
    // Ready tomorrow, not in 800 days.
    w.production.cols.readyDay[row] = Math.floor(w.tick / 24) + 1;
    const before = new Set<number>();
    w.formations.forEach((id) => before.add(id));
    s.step(48, quiet);
    const c = w.formations.cols;
    const fleets: number[] = [];
    w.formations.forEach((id) => {
      if (!before.has(id) && w.isFleet(id) && c.template[id] === t) fleets.push(id);
    });
    expect(fleets).toHaveLength(1);
    const fleet = fleets[0]!;
    expect(liveCarriers(w, fleet)).toBe(2);
    const aboard = [...w.wingBase].filter(([, b]) => b === -fleet).map(([id]) => id);
    expect(aboard).toHaveLength(2);
    for (const id of aboard) {
      expect(c.nation[id]).toBe(USA);
      expect(TEMPLATES_1938[c.template[id]!]!.id).toBe(CARRIER_WING);
      expect(c.strength[id]).toBeGreaterThan(0);
    }
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    expect([...u.world.wingBase].filter(([, b]) => b === -fleet).length).toBe(2);
  });
});
