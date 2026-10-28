import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { LEVY_MONTH, outnumberedOnLand } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { declareWar } from '../../src/sim/systems/war';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds, runEvents } from '../helpers/sim1938';

// PLAN 7.150 (ADR-745): late, the weak side of the quiet land wars held millions of men in its pool
// and a few formations, its orders held by the gold for a division. Outnumbered on a land front, an AI
// nation raises LEVY_MONTH cadre divisions a month from its manpower, for no gold.

const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const NOR = id('NOR');
const SWE = id('SWE');
const CADRE = BUILD_MIX_1938.cadre;

/** Per nation, its land formations on land, as the economic AI gathers them. */
const landArmies = (w: World): Map<number, number[]> => {
  const m = new Map<number, number[]>();
  w.formations.forEach((f) => {
    if (w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
    const n = w.formations.cols.nation[f]!;
    (m.get(n) ?? m.set(n, []).get(n)!).push(f);
  });
  return m;
};
const landOrders = (w: World, n: number): number[] => w.production.ids().filter((p) => w.production.cols.nation[p] === n && w.rules!.templates[w.production.cols.template[p]!]!.domain === Domain.land).map((p) => w.production.cols.template[p]!);

/**
 * A 1938 world at peace but for Norway's war on Sweden across their border; Norway without gold, so
 * that it pays for no order, and with `manpower` men. `foeArmy: false`: Sweden's land formations gone.
 */
function scene(opts: { manpower: number; foeArmy?: boolean }): { s: Sim; w: World } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.nations.forEach((n) => (w.nations.cols.aggression[n] = 0));
  for (const war of [...w.wars.list]) w.wars.end(war);
  expect(declareWar(w, NOR, SWE, true)).not.toBeNull();
  if (opts.foeArmy === false) for (const f of w.formations.ids()) if (w.formations.cols.nation[f] === SWE && !w.isFleet(f) && !w.isWing(f)) destroyFormation(w, f);
  w.nations.cols.gold[NOR] = 0;
  w.nations.cols.manpower[NOR] = opts.manpower;
  return { s, w };
}

describe('the levy (PLAN 7.150)', () => {
  it('outnumbered on its land front, with no gold, a nation raises LEVY_MONTH cadre divisions from its manpower (red without: none)', () => {
    const { s, w } = scene({ manpower: 1e7 });
    expect(outnumberedOnLand(w, landArmies(w)).has(NOR)).toBe(true);
    const ev = runEvents(s, 1);
    expect(landOrders(w, NOR)).toEqual(new Array<number>(LEVY_MONTH).fill(CADRE));
    // Their men from the pool: against the same month not outnumbered (the month's growth is the same).
    const other = scene({ manpower: 1e7, foeArmy: false });
    runEvents(other.s, 1);
    expect(other.w.nations.cols.manpower[NOR]! - w.nations.cols.manpower[NOR]!).toBeCloseTo(LEVY_MONTH * w.rules!.templates[CADRE]!.manpower, 3);
    // Seen as orders, in the ticker's events.
    expect(eventKinds(ev, EventKind.ProductionQueued).filter(([, n]) => n === NOR).length).toBe(LEVY_MONTH);
  });

  it('not outnumbered (the enemy has no land army), it raises none', () => {
    const { s, w } = scene({ manpower: 1e7, foeArmy: false });
    expect(outnumberedOnLand(w, landArmies(w)).has(NOR)).toBe(false);
    runEvents(s, 1);
    expect(landOrders(w, NOR)).toEqual([]);
  });

  it('short of a cadre division’s men, it raises none', () => {
    const { s, w } = scene({ manpower: 0 });
    w.nations.cols.manpower[NOR] = w.rules!.templates[CADRE]!.manpower - 1;
    expect(outnumberedOnLand(w, landArmies(w)).has(NOR)).toBe(true);
    runEvents(s, 1);
    expect(landOrders(w, NOR)).toEqual([]);
  });
});
