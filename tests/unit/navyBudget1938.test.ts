import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BATTLE_FLEET_INCOME, budgetOf, NAVY_SHARE, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { bleedFormation, destroyFormation } from '../../src/sim/systems/elements';
import { placeFleet } from '../../src/sim/placeForces';
import { Refusal } from '../../src/shared/commands';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { declareWar } from '../../src/sim/systems/war';
import { refillable } from '../../src/sim/systems/production';
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

  // PLAN 7.26h2 (ADR-518): measured on two seeds, Britain, its four groups of 1938 sunk, ordered
  // none for five years: every month over its navy's share, with a front in another war, its gold
  // under three months of income. The transport is a landing's means, as 2b's bomber is a warhead's.
  it('a nation that wants a landing orders a transport group over its navy\'s share, with a front in another war, on a month of reserve', () => {
    const setUp = (wars: string[], army = true): { w: World; ENG: number } => {
      const s = peaceful();
      const w = s.world;
      const ENG = id('ENG');
      w.formations.forEach((f) => {
        const c = w.formations.cols;
        if (c.nation[f] !== ENG) return;
        if ((w.isFleet(f) && c.template[f] === fleets.transport) || (!army && !w.isFleet(f) && !w.isWing(f))) destroyFormation(w, f);
      });
      for (const t of wars) expect(declareWar(w, ENG, id(t), true)).not.toBeNull();
      // Its navy of 1938 is just under its share (250 against 289): two battle squadrons more.
      const port = w.ports.find((p) => w.cells.controller[p.cell] === ENG)!;
      for (let k = 0; k < 2; k++) expect(placeFleet(w, ENG, fleets.battle, port.x, port.y)).toBe(Refusal.None);
      const { income } = budgetOf(w, ENG, monthlyAccounts(w, T));
      const price = w.rules!.templates[fleets.transport]!.gold;
      w.nations.cols.gold[ENG] = price + 2 * income;
      expect(w.nations.cols.gold[ENG]).toBeLessThan(price + RESERVE_MONTHS * income);
      expect(navyUpkeep(w, ENG)).toBeGreaterThan(NAVY_SHARE * income);
      runEvents(s, 1);
      return { w, ENG };
    };
    // At war with Saudi Arabia, a land front by Aden and Iraq, and with Iceland across the sea.
    const both = setUp(['SAU', 'ICE']);
    expect(ships(both.w, both.ENG)).toEqual([fleets.transport]);
    // With Saudi Arabia alone every war has its front: none.
    const fronted = setUp(['SAU']);
    expect(ships(fronted.w, fronted.ENG)).toEqual([]);
    // No army to carry: none.
    const empty = setUp(['SAU', 'ICE'], false);
    expect(ships(empty.w, empty.ENG)).toEqual([]);
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

// PLAN 7.35d3b (ADR-557): a navy lost was not built again, the treasury taken by the army's line
// (a division's 1,001 and the reserve, 119 gold under a destroyer's) each time it neared a warship's.
describe('a nation without a navy saves for a warship (PLAN 7.35d3b)', () => {
  // Norway's army of 1938 stands just under its peacetime share (aggression 0), Brazil's at 1.9 of it.
  const setUp = (opts: { tag: string; enemy?: string; army: boolean; bleed?: boolean; flotilla?: boolean }): { s: Sim; w: World; NOR: number } => {
    const s = peaceful();
    const w = s.world;
    const NOR = id(opts.tag);
    w.formations.forEach((f) => {
      const c = w.formations.cols;
      if (c.nation[f] !== NOR) return;
      if (w.isFleet(f) || (!opts.army && !w.isWing(f))) destroyFormation(w, f);
    });
    // A navy rebuilt to one destroyer flotilla (PLAN 7.47): armed, its upkeep under the share.
    if (opts.flotilla) {
      expect(w.ports.some((p) => w.cells.controller[p.cell] === NOR && placeFleet(w, NOR, fleets.destroyer, p.x, p.y) === Refusal.None)).toBe(true);
      expect(navyUpkeep(w, NOR)).toBeGreaterThan(0);
      expect(navyUpkeep(w, NOR)).toBeLessThan(NAVY_SHARE * budgetOf(w, NOR, monthlyAccounts(w, T)).income);
    }
    if (opts.enemy) expect(declareWar(w, NOR, id(opts.enemy), true)).not.toBeNull();
    w.nations.cols.manpower[NOR] = 1e7;
    // A division bled to half, so the refills have men to give back.
    if (opts.bleed) {
      const div = w.formations.ids().find((f) => w.formations.cols.nation[f] === NOR && refillable(w, f) === false && !w.isFleet(f) && !w.isWing(f) && !w.offLand(f));
      expect(div).toBeDefined();
      bleedFormation(w, div!, 0.5);
      expect(refillable(w, div!)).toBe(true);
    }
    const { income } = budgetOf(w, NOR, monthlyAccounts(w, T));
    const line = w.rules!.templates[fleets.destroyer]!.gold + RESERVE_MONTHS * income;
    // Gold for a destroyer with its reserve, not for a division and then a destroyer.
    w.nations.cols.gold[NOR] = line + 100;
    expect(w.nations.cols.gold[NOR]! - w.rules!.templates[BUILD_MIX_1938.infantry]!.gold).toBeLessThan(line);
    return { s, w, NOR };
  };
  const land = (w: World, n: number): number => w.production.ids().filter((p) => w.production.cols.nation[p] === n && w.rules!.templates[w.production.cols.template[p]!]!.domain === Domain.land).length;

  it('in peace, its army under its share, it orders a destroyer and no division (red without: a division, no ship)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', army: false });
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
  });

  it('at war, its army at its peacetime share, the army waits and the refills keep the price (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'BRA', enemy: 'BOL', army: true, bleed: true });
    const before = w.nations.cols.gold[NOR]!;
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
    // The destroyer's price paid, and no more than the 100 over its line in refills.
    expect(before - w.nations.cols.gold[NOR]!).toBeLessThanOrEqual(w.rules!.templates[fleets.destroyer]!.gold + 100 + 1e-6);
  });

  // The enemy was Sweden until PLAN 7.46b2 (ADR-575): an enemy with an armed fleet now makes it
  // save. Finland holds submarines alone, no armed fleet.
  it('at war with an enemy without an armed fleet, its army under its peacetime share, the army orders first: no ship is saved for', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'FIN', army: false });
    runEvents(s, 1);
    expect(land(w, NOR)).toBeGreaterThan(0);
    expect(ships(w, NOR)).toEqual([]);
  });

  // PLAN 7.46b2 (ADR-575): Britain, its battle line sunk by the chase (seeds 7019, 3613), spent
  // each month on its army at war and ordered its first warship years later.
  it('at war with an enemy that has an armed fleet, its army under its peacetime share, it orders a destroyer and no division (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: false });
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
  });

  // PLAN 7.47: Britain's first destroyer rebuilt ended the saving (seeds 7019, 3613 with the
  // chase): its army's orders took the gold again while its navy stood far under its peak.
  it('with a navy rebuilt to one flotilla under its share, at war with an enemy that has an armed fleet, it orders a destroyer and no division (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: false, flotilla: true });
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
  });

  it('with a navy of one flotilla, at war with an enemy without an armed fleet, the army orders first: no ship is saved for', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'FIN', army: false, flotilla: true });
    runEvents(s, 1);
    expect(land(w, NOR)).toBeGreaterThan(0);
    expect(ships(w, NOR)).toEqual([]);
  });
});

// PLAN 7.46b1 (ADR-574): France, its battle line sunk, held nine submarine flotillas and no armed
// fleet for years (the chase, seed 3613): their upkeep filled NAVY_SHARE, and no warship was ordered.
describe('a navy\'s share counts its armed fleets (PLAN 7.46b1)', () => {
  it('a nation with submarines over its share and no armed fleet orders a warship (red without: none)', () => {
    const s = peaceful();
    const w = s.world;
    const FRA = id('FRA');
    w.formations.forEach((f) => void (w.formations.cols.nation[f] === FRA && w.isFleet(f) && destroyFormation(w, f)));
    const sub = TEMPLATES_1938.findIndex((t) => t.id === 'submarine_flotilla');
    expect(sub).toBeGreaterThanOrEqual(0);
    const port = w.ports.find((p) => w.cells.controller[p.cell] === FRA && placeFleet(w, FRA, sub, p.x, p.y) === Refusal.None)!;
    const { income } = budgetOf(w, FRA, monthlyAccounts(w, T));
    while (navyUpkeep(w, FRA) <= NAVY_SHARE * income) expect(placeFleet(w, FRA, sub, port.x, port.y)).toBe(Refusal.None);
    // Its submarines alone are over the share, and none of its fleets is armed.
    expect(navyUpkeep(w, FRA)).toBeGreaterThan(NAVY_SHARE * budgetOf(w, FRA, monthlyAccounts(w, T)).income);
    w.nations.cols.gold[FRA] = w.rules!.templates[fleets.destroyer]!.gold + RESERVE_MONTHS * income + 100;
    w.nations.cols.manpower[FRA] = 1e7;
    runEvents(s, 1);
    expect(ships(w, FRA)).toEqual([fleets.destroyer]);
  });
});
