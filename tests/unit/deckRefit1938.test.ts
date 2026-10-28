import { describe, expect, it } from 'vitest';
import { RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { freeDecks, liveCarriers } from '../../src/sim/systems/air';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

// PLAN 7.151 (ADR-746): a carrier afloat with no wing aboard gets one from the economic AI, a fleet a deck a
// month, at the carrier wing's price. Before, a deck wing came only with its carrier (PLAN 7.137) and one lost was
// never replaced: on critic run 17's year-20 saves 12 of 15 carrier groups at war held none.

const id = (t: string): number => TAGS_1938.indexOf(t) + 1;

function peaceful(rich: string[]): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.nations.forEach((n) => (w.nations.cols.aggression[n] = 0));
  for (const war of [...w.wars.list]) w.wars.end(war);
  for (const t of rich) [w.nations.cols.gold[id(t)], w.nations.cols.manpower[id(t)]] = [1e6, 1e7];
  return s;
}
/** Nation `n`'s fleets with two carriers or more afloat, by ascending id. */
const carrierFleets = (w: World, n: number): number[] => {
  const out: number[] = [];
  w.formations.forEach((f) => {
    if (w.isFleet(f) && w.formations.cols.nation[f] === n && liveCarriers(w, f) >= 2) out.push(f);
  });
  return out.sort((a, b) => a - b);
};
const aboard = (w: World, fleet: number): number[] => [...w.wingBase].filter(([, b]) => b === -fleet).map(([f]) => f).sort((a, b) => a - b);

describe('a carrier\'s deck re-manned (PLAN 7.151)', () => {
  it('the United States, two deck wings of a carrier group lost, gets one back at the month and the other a month on', () => {
    const s = peaceful(['USA']);
    const w = s.world;
    const USA = id('USA');
    const fleet = carrierFleets(w, USA)[0]!;
    expect(fleet).toBeDefined();
    const before = aboard(w, fleet);
    expect(before.length).toBe(liveCarriers(w, fleet));
    for (const f of before.slice(0, 2)) destroyFormation(w, f);
    expect(freeDecks(w, fleet)).toBe(2);
    const gold = w.nations.cols.gold[USA]!;
    const price = w.rules!.templates[w.rules!.carrierWing!]!.gold;
    runEvents(s, 1);
    const now = aboard(w, fleet);
    expect(freeDecks(w, fleet)).toBe(1);
    // Of the carrier wing's template (an id freed may be given again: counted, not compared).
    expect(now).toHaveLength(before.length - 1);
    for (const f of now) expect(w.formations.cols.template[f]).toBe(w.rules!.carrierWing);
    // Paid: its price at least (the month's other orders take more).
    expect(gold - w.nations.cols.gold[USA]!).toBeGreaterThanOrEqual(price);
    // A month on, the second.
    runEvents(s, 24 * 31);
    expect(freeDecks(w, fleet)).toBe(0);
  });

  it('with no gold past the reserve, none', () => {
    const s = peaceful([]);
    const w = s.world;
    const USA = id('USA');
    const fleet = carrierFleets(w, USA)[0]!;
    for (const f of aboard(w, fleet)) destroyFormation(w, f);
    const income = Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[USA]!);
    w.nations.cols.gold[USA] = RESERVE_MONTHS * income;
    runEvents(s, 1);
    expect(aboard(w, fleet)).toEqual([]);
  });
});
