import { describe, expect, it } from 'vitest';
import { economicAi, pickFleet, BATTLE_FLEET_INCOME } from '../../src/sim/ai/economic';
import { isMonthStart } from '../../src/shared/calendar';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.141: a carrier group in training holds back no other warship. Before, its 800 days were a fleet in training
// like any (ADR-726), and a nation that kept carriers ordered nothing else at sea for years: the late navies thinned
// (critic run 16: transports at year 20 −9 %, ships sunk late −7 %).

const USA = nationId('USA');
const kinds = BUILD_MIX_1938.fleets;
const run = economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938);

/** The United States' sea orders in training, by template. */
function seaOrders(w: World): number[] {
  const pc = w.production.cols;
  const out: number[] = [];
  w.production.forEach((p) => {
    if (pc.nation[p] === USA && w.rules!.templates[pc.template[p]!]!.domain === Domain.sea) out.push(pc.template[p]!);
  });
  return out.sort((a, b) => a - b);
}

/** The next month's start after `tick`. */
function nextMonth(w: World, tick: number): number {
  let t = tick + 24;
  while (!isMonthStart(w.startDay, t)) t += 24;
  return t;
}

describe('a carrier group in training holds back no other warship (PLAN 7.141)', () => {
  it('pickFleet with a carrier group in training picks the next warship, not a second carrier group', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    w.nations.cols.gold[USA] = 1e6;
    w.formations.forEach((id) => {
      if (w.isFleet(id) && w.formations.cols.nation[id] === USA) destroyFormation(w, id);
    });
    expect(pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds)).toBe(kinds.carrier);
    expect(pickFleet(w, USA, BATTLE_FLEET_INCOME, kinds, true)).toBe(kinds.battle);
  });

  it('the United States, its navy sunk, orders a carrier group and the next month a battle squadron beside it', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    // Its fleets sunk (under its navy's share, under CARRIERS_KEPT carriers), its sea orders of the start cancelled,
    // a treasury for anything.
    w.formations.forEach((id) => {
      if (w.isFleet(id) && w.formations.cols.nation[id] === USA) destroyFormation(w, id);
    });
    const pc = w.production.cols;
    for (const p of w.production.ids()) if (pc.nation[p] === USA && w.rules!.templates[pc.template[p]!]!.domain === Domain.sea) w.production.remove(p);
    w.nations.cols.gold[USA] = 1e6;
    w.tick = nextMonth(w, 0);
    run(w);
    expect(seaOrders(w)).toEqual([kinds.carrier]);
    w.nations.cols.gold[USA] = 1e6;
    w.tick = nextMonth(w, w.tick);
    run(w);
    expect(seaOrders(w)).toEqual([kinds.carrier, kinds.battle].sort((a, b) => a - b));
  });
});
