import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BATTLE_FLEET_INCOME, NAVY_SHARE } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { declareWar } from '../../src/sim/systems/war';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

// PLAN 4.6e1: the navy's cost. A nation keeps its navy's upkeep near NAVY_SHARE of its income:
// under it, with the gold, it orders a fleet a time (a battle squadron when rich, a cruiser
// squadron, a destroyer flotilla; transports first at war with no front and none of them);
// over it and short of money, it lays up its fleets in port, the dearest first, before its
// army is sent home.

const { w: W } = SIZE_1938;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const T = ECONOMY_TABLES_1938;
const fleets = BUILD_MIX_1938.fleets;

function peaceful(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.nations.forEach((n) => (s.world.nations.cols.aggression[n] = 0));
  for (const war of [...s.world.wars.list]) s.world.wars.end(war);
  return s;
}
const ships = (w: World, n: number): number[] => w.production.ids().filter((p) => w.production.cols.nation[p] === n && w.rules!.templates[w.production.cols.template[p]!]!.domain === Domain.sea).map((p) => w.production.cols.template[p]!);
const navyUpkeep = (w: World, n: number): number => {
  let u = 0;
  w.formations.forEach((f) => void (w.isFleet(f) && w.formations.cols.nation[f] === n && (u += UPKEEP_SCALE * T.templateUpkeep[w.formations.cols.template[f]!]!)));
  return u;
};

describe('the navy\'s cost (PLAN 4.6e1)', () => {
  it('under its share a rich nation orders a battle squadron, a poorer one a destroyer flotilla; one over its share orders none', () => {
    const s = peaceful();
    const w = s.world;
    const [USA, SWE, JAP] = [id('USA'), id('SWE'), id('JAP')];
    w.nations.cols.gold[SWE] = 1e6;
    w.nations.cols.manpower[SWE] = 1e7;
    const acc = monthlyAccounts(w, T);
    expect(acc.gross[USA]).toBeGreaterThan(BATTLE_FLEET_INCOME);
    expect(navyUpkeep(w, USA)).toBeLessThan(NAVY_SHARE * acc.gross[USA]!);
    expect(navyUpkeep(w, JAP)).toBeGreaterThan(NAVY_SHARE * acc.gross[JAP]!);
    runEvents(s, 1);
    expect(ships(w, USA)).toEqual([fleets.battle]);
    expect(ships(w, SWE)).toEqual([fleets.destroyer]);
    expect(ships(w, JAP)).toEqual([]);
    // One at a time: the next month, with the first in training, no second.
    runEvents(s, 24 * 31);
    expect(ships(w, USA)).toEqual([fleets.battle]);
  });

  it('at war with no front and no transports, its first fleet is a transport group', () => {
    const s = peaceful();
    const w = s.world;
    const [SWE, ICE] = [id('SWE'), id('ICE')];
    w.formations.forEach((f) => void (w.formations.cols.nation[f] === SWE && w.formations.cols.template[f] === fleets.transport && expect.unreachable('Sweden has transports')));
    w.nations.cols.gold[SWE] = 1e6;
    w.nations.cols.manpower[SWE] = 1e7;
    expect(declareWar(w, SWE, ICE, true)).not.toBeNull();
    runEvents(s, 1);
    expect(ships(w, SWE)).toEqual([fleets.transport]);
  });

  it('short of money, a nation over its share lays up its fleets in port, the dearest first, before its army goes home', () => {
    const s = peaceful();
    const w = s.world;
    const JAP = id('JAP');
    const tpl = (f: number): number => w.formations.cols.template[f]!;
    const own = (): number[] => w.formations.ids().filter((f) => w.formations.cols.nation[f] === JAP);
    const before = own();
    const battle = before.filter((f) => w.isFleet(f) && tpl(f) === fleets.battle).length;
    expect(battle).toBeGreaterThan(0);
    // In debt: a year's payback of it is far over its balance.
    w.nations.cols.gold[JAP] = -1e5;
    // What the navy may cost after: its share of the income.
    const income = monthlyAccounts(w, T).gross[JAP]!;
    const ev = runEvents(s, 1);
    const laid = ev.filter((e) => e[1] === EventKind.FleetsLaidUp && e[2] === JAP);
    expect(laid.length).toBe(1);
    const after = own();
    expect(laid[0]![3]).toBeGreaterThan(0);
    // Laid up until the navy is within its share.
    expect(navyUpkeep(w, JAP)).toBeLessThanOrEqual(NAVY_SHARE * income);
    // The dearest went first: Japan's battle squadrons before its cruisers and flotillas.
    expect(after.filter((f) => w.isFleet(f) && tpl(f) === fleets.battle).length).toBeLessThan(battle);
    process.stderr.write(`Japan laid up ${laid[0]![3]} fleets; its navy ${navyUpkeep(w, JAP).toFixed(0)} a month after, its share ${(NAVY_SHARE * income).toFixed(0)}\n`);
  });
});
