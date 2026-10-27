import { describe, expect, it } from 'vitest';
import { BATTLE_FLEET_INCOME, CARRIERS_KEPT, pickFleet, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { knowsTechs } from '../../src/sim/tech';
import { BUILD_MIX_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { liveCarriers } from '../../src/sim/systems/air';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.137 (ADR-726): a nation of a battle fleet's income with fewer than CARRIERS_KEPT carriers afloat orders a
// carrier group first, where it knows its techs. On HEAD before it none was ever built: the start's 18 were sunk by year 20.

const USA = nationId('USA');
const kinds = BUILD_MIX_1938.fleets;
const world = (): World => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
const carriersOf = (w: World, n: number): number[] => {
  const out: number[] = [];
  w.formations.forEach((id) => {
    if (w.formations.cols.nation[id] === n && w.isFleet(id) && liveCarriers(w, id) > 0) out.push(id);
  });
  return out;
};

describe('the AI orders carriers (PLAN 7.137)', () => {
  it('the United States orders a carrier group before a battle squadron once under CARRIERS_KEPT carriers afloat', () => {
    const w = world();
    w.nations.cols.gold[USA] = 1e6;
    const afloat = (): number => carriersOf(w, USA).reduce((k, f) => k + liveCarriers(w, f), 0);
    // The start's six.
    expect(afloat()).toBe(6);
    expect(pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds)).toBe(kinds.battle);
    // Its groups sunk one by one: at CARRIERS_KEPT it orders the battle squadron still, under it a carrier group.
    for (const f of carriersOf(w, USA)) {
      destroyFormation(w, f);
      expect(pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds), `${afloat()} afloat`).toBe(afloat() < CARRIERS_KEPT ? kinds.carrier : kinds.battle);
    }
    expect(afloat()).toBe(0);
    // Under a battle fleet's income it orders what it did.
    expect(pickFleet(w, USA, BATTLE_FLEET_INCOME - 1, kinds)).toBe(kinds.cruiser);
  });

  it('not without the techs of a carrier: the United States, its carriers sunk and its techs taken, orders none', () => {
    const w = world();
    w.nations.cols.gold[USA] = 1e6;
    for (const f of carriersOf(w, USA)) destroyFormation(w, f);
    expect(knowsTechs(w, USA, w.rules!.templates[kinds.carrier]!.techs)).toBe(true);
    w.nations.cols.tech0[USA] = 0;
    w.nations.cols.tech1[USA] = 0;
    expect(knowsTechs(w, USA, w.rules!.templates[kinds.carrier]!.techs)).toBe(false);
    expect(pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds)).not.toBe(kinds.carrier);
  });

  it("not where it cannot pay for one: the next it can pay for", () => {
    const w = world();
    for (const f of carriersOf(w, USA)) destroyFormation(w, f);
    const rules = w.rules!;
    const cv = rules.templates[kinds.carrier]!.gold;
    const bb = rules.templates[kinds.battle]!.gold;
    // Gold for the dearer of the two but under the carrier's own price with its reserve.
    const reserve = RESERVE_MONTHS * BATTLE_FLEET_INCOME;
    w.nations.cols.gold[USA] = cv + reserve - 1;
    const pick = pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds);
    expect(pick).not.toBe(kinds.carrier);
    expect(pick === -1 || rules.templates[pick]!.gold <= Math.max(bb, cv)).toBe(true);
  });
});
