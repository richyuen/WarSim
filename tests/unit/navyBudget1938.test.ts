import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BATTLE_FLEET_INCOME, budgetOf, FEW_FORMATIONS, NAVY_SHARE, OUTNUMBERED_SLOTS, outnumberedOnLand, PARALLEL_INCOME, peaceShare, RESERVE_MONTHS, wantsFerry, wantsTransport } from '../../src/sim/ai/economic';
import { frontReach } from '../../src/sim/ai/invasion';
import { neighbours4 } from '../../src/sim/nav/grid';
import { passageOf } from '../../src/sim/systems/movement';
import { applyLoss, bleedFormation, destroyFormation, elementIndex, settleFormation } from '../../src/sim/systems/elements';
import { TRANSPORT_MEN, transportRoom } from '../../src/sim/systems/amphibious';
import { placeFleet } from '../../src/sim/placeForces';
import { Refusal } from '../../src/shared/commands';
import { addFormations, BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938, TEMPLATES_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { declareWar } from '../../src/sim/systems/war';
import { queueFormation, refillable } from '../../src/sim/systems/production';
import { Domain, navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { project } from '../../src/sim/data/projection';
import { runEvents } from '../helpers/sim1938';

// PLAN 4.6e1: the navy's cost. A nation keeps its navy's upkeep near NAVY_SHARE of its income:
// under it, with the gold, it orders a fleet a time (a battle squadron when rich, a cruiser
// squadron, a destroyer flotilla; transports first at war with no front and none of them);
// over it and short of money, it lays up its fleets in port, the dearest first, before its
// army is sent home.

const { w: W, h: H } = SIZE_1938;
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

  // PLAN 7.55 (ADR-598): a group sunk to one or two transports carries no division and is never
  // refilled; it held the landings of 5683's Japan, 7247's Germany and 4513's Latvia for good.
  it('at war with no front, a transport group with room under a division\'s is none: it orders another; one with a division\'s room, not', () => {
    const setUp = (left: number): { w: World; SWE: number } => {
      const s = peaceful();
      const w = s.world;
      const [SWE, ICE] = [id('SWE'), id('ICE')];
      const port = w.ports.find((p) => w.cells.controller[p.cell] === SWE)!;
      expect(placeFleet(w, SWE, fleets.transport, port.x, port.y)).toBe(Refusal.None);
      const group = w.formations.ids().find((f) => w.formations.cols.nation[f] === SWE && w.formations.cols.template[f] === fleets.transport)!;
      // All but `left` transports sunk.
      const els = elementIndex(w).get(group)!;
      for (const e of els.slice(left)) applyLoss(w, e, w.elements.cols.strength[e]!);
      settleFormation(w, group);
      expect(transportRoom(w, group)).toBe(left * TRANSPORT_MEN);
      w.nations.cols.gold[SWE] = 1e6;
      w.nations.cols.manpower[SWE] = 1e7;
      expect(declareWar(w, SWE, ICE, true)).not.toBeNull();
      runEvents(s, 1);
      return { w, SWE };
    };
    const division = T.templateStrength[BUILD_MIX_1938.infantry]!;
    expect(TRANSPORT_MEN).toBeLessThan(division);
    const one = setUp(1);
    expect(ships(one.w, one.SWE)).toEqual([fleets.transport]);
    // Room for a division (6 × 2,100 against 12,460): it has its transports.
    const seven = setUp(Math.ceil(division / TRANSPORT_MEN));
    expect(ships(seven.w, seven.SWE)).not.toContain(fleets.transport);
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
    // With Saudi Arabia alone every war has its front: the landing wants none. Its home army on
    // Great Britain, beyond that front, orders one for the ferry since PLAN 7.49d3 (ADR-614; the
    // case below).
    const fronted = setUp(['SAU']);
    expect(wantsTransport(fronted.w, fronted.ENG, fleets.transport, [], T.templateStrength[BUILD_MIX_1938.infantry])).toBe(false);
    expect(ships(fronted.w, fronted.ENG)).toEqual([fleets.transport]);
    // No army to carry: none.
    const empty = setUp(['SAU', 'ICE'], false);
    expect(ships(empty.w, empty.ENG)).toEqual([]);
  });

  // PLAN 7.49d3 (ADR-614; the user's, ADR-591 b): a nation with a land front and its home army
  // beyond it, with no transports, never had any (90 and 155 island formations of such nations on
  // the critic's year-10 and year-20 saves): only a landing in a war with no front ordered a group.
  it('at war with a land front, its island army over its transports\' room, it orders a group for the ferry, and its warships go on (red without)', () => {
    const setUp = (home = true): { s: Sim; w: World; ENG: number } => {
      const s = peaceful();
      const w = s.world;
      const ENG = id('ENG');
      const comp = navOf(w).grid.component;
      // The front's land: Saudi Arabia's (Asia, by Aden and Iraq).
      const front = comp[w.cells.controller.findIndex((h) => h === id('SAU'))]!;
      w.formations.forEach((f) => {
        const c = w.formations.cols;
        if (c.nation[f] !== ENG) return;
        const island = comp[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)] !== front;
        if ((w.isFleet(f) && c.template[f] === fleets.transport) || (!home && !w.isFleet(f) && !w.isWing(f) && island)) destroyFormation(w, f);
      });
      expect(declareWar(w, ENG, id('SAU'), true)).not.toBeNull();
      if (!home) {
        // Nor on the front's land beyond the front's reach (India's, Burma's: Persia between, closed
        // to it): the ferry's since PLAN 7.79c, the want's since PLAN 7.90e (ADR-648). The army that
        // reaches the front (Aden's, Iraq's) stays.
        const { controller } = w.cells;
        const frontCells: number[] = [];
        for (let k = 0; k < W * H; k++) if (controller[k] === ENG && neighbours4(k, W, H, false, []).some((q) => controller[q] === id('SAU'))) frontCells.push(k);
        const reach = frontReach(w, ENG, frontCells, passageOf(w, ENG));
        const c = w.formations.cols;
        const ids: number[] = [];
        w.formations.forEach((f) => ids.push(f));
        let kept = 0;
        for (const f of ids) {
          if (c.nation[f] !== ENG || w.isFleet(f) || w.isWing(f) || w.offLand(f)) continue;
          const k = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
          if (comp[k] === front && !reach(k)) destroyFormation(w, f);
          else kept++;
        }
        expect(kept).toBeGreaterThan(0);
      }
      w.nations.cols.gold[ENG] = 1e6;
      w.nations.cols.manpower[ENG] = 1e7;
      return { s, w, ENG };
    };
    const a = setUp();
    expect(wantsFerry(a.w, a.ENG, [])).toBe(true);
    runEvents(a.s, 1);
    expect(ships(a.w, a.ENG)).toContain(fleets.transport);
    // A group already in training: no second, and it holds back no warship (its navy under its
    // share). Else the want, back each month, ordered a group a time and never a warship.
    const c = setUp();
    expect(queueFormation(c.w, c.ENG, fleets.transport)).not.toBe(0);
    runEvents(c.s, 1);
    expect(ships(c.w, c.ENG).filter((t) => t === fleets.transport)).toHaveLength(1);
    expect(ships(c.w, c.ENG).filter((t) => t !== fleets.transport).length).toBeGreaterThan(0);
    // No army off the front's land: no ferry, no group.
    const b = setUp(false);
    expect(wantsFerry(b.w, b.ENG, [])).toBe(false);
    runEvents(b.s, 1);
    expect(ships(b.w, b.ENG)).not.toContain(fleets.transport);
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
  // `four`: Norway's three divisions of 1938 and a fourth like them, each bled to half, so that
  // its army is over FEW_FORMATIONS and under its peacetime share (PLAN 7.49c, ADR-590).
  const setUp = (opts: { tag: string; enemy?: string; army: boolean; bleed?: boolean; flotilla?: boolean; four?: boolean; foeArmy?: boolean }): { s: Sim; w: World; NOR: number } => {
    const s = peaceful();
    const w = s.world;
    const NOR = id(opts.tag);
    w.formations.forEach((f) => {
      const c = w.formations.cols;
      if (c.nation[f] !== NOR) return;
      if (w.isFleet(f) || (!opts.army && !w.isWing(f))) destroyFormation(w, f);
    });
    if (opts.four) {
      const onLand = (): number[] => w.formations.ids().filter((f) => w.formations.cols.nation[f] === NOR && !w.isFleet(f) && !w.isWing(f) && !w.offLand(f));
      const first = onLand()[0]!;
      const c = w.formations.cols;
      addFormations(w, [{ nation: NOR, template: TEMPLATES_LAND[c.template[first]!]!.id, x: c.x[first]!, y: c.y[first]!, cell: 0, group: 0 }]);
      const divisions = onLand();
      expect(divisions.length).toBe(FEW_FORMATIONS + 1);
      for (const f of divisions) bleedFormation(w, f, 0.5);
      let army = 0;
      for (const f of divisions) army += (UPKEEP_SCALE * T.templateUpkeep[c.template[f]!]! * c.strength[f]!) / T.templateStrength[c.template[f]!]!;
      expect(army).toBeLessThan(peaceShare(w.nations.cols.aggression[NOR]!) * budgetOf(w, NOR, monthlyAccounts(w, T)).income);
    }
    // A navy rebuilt to one destroyer flotilla (PLAN 7.47): armed, its upkeep under the share.
    if (opts.flotilla) {
      expect(w.ports.some((p) => w.cells.controller[p.cell] === NOR && placeFleet(w, NOR, fleets.destroyer, p.x, p.y) === Refusal.None)).toBe(true);
      expect(navyUpkeep(w, NOR)).toBeGreaterThan(0);
      expect(navyUpkeep(w, NOR)).toBeLessThan(NAVY_SHARE * budgetOf(w, NOR, monthlyAccounts(w, T)).income);
    }
    if (opts.enemy) expect(declareWar(w, NOR, id(opts.enemy), true)).not.toBeNull();
    // `foeArmy: false`: the enemy's land formations gone (its fleets kept), so that it is not
    // outnumbered on its land front (PLAN 7.146, ADR-739).
    if (opts.enemy && opts.foeArmy === false) {
      const FOE = id(opts.enemy);
      for (const f of w.formations.ids()) if (w.formations.cols.nation[f] === FOE && !w.isFleet(f) && !w.isWing(f)) destroyFormation(w, f);
    }
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
  // Norway's army of four bled divisions since PLAN 7.49c (ADR-590): with none, its army orders first.
  // Sweden's land army gone since PLAN 7.146 (ADR-739): outnumbered on its land front, Norway's army
  // orders first (the case below); not outnumbered, it saves.
  it('at war with an enemy that has an armed fleet, its army under its peacetime share, it orders a destroyer and no division (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: true, four: true, foeArmy: false });
    expect(outnumberedOnLand(w, landArmies(w)).has(NOR)).toBe(false);
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
  });

  // PLAN 7.47: Britain's first destroyer rebuilt ended the saving (seeds 7019, 3613 with the
  // chase): its army's orders took the gold again while its navy stood far under its peak.
  it('with a navy rebuilt to one flotilla under its share, at war with an enemy that has an armed fleet, it orders a destroyer and no division (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: true, flotilla: true, four: true, foeArmy: false });
    runEvents(s, 1);
    expect(ships(w, NOR)).toEqual([fleets.destroyer]);
    expect(land(w, NOR)).toBe(0);
  });

  // PLAN 7.146 (ADR-739): the weak side of the late long-front wars, 100–1,000 a month, saved for a
  // destroyer in a third of its months while its front thinned. Norway's four bled divisions against
  // Sweden's army across their border: outnumbered on a land front, it saves for no warship.
  it('holding a land front where its side is outnumbered on land, at war with an enemy that has an armed fleet, the army orders first: no ship is saved for (red without)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: true, four: true });
    expect(outnumberedOnLand(w, landArmies(w)).has(NOR)).toBe(true);
    expect(outnumberedOnLand(w, landArmies(w)).has(id('SWE'))).toBe(false);
    runEvents(s, 1);
    expect(land(w, NOR)).toBeGreaterThan(0);
    expect(ships(w, NOR)).toEqual([]);
  });

  // PLAN 7.146b (ADR-739): and it has OUTNUMBERED_SLOTS order slots more. Norway's income gives it one
  // (under PARALLEL_INCOME); with the gold for three divisions it orders 1 + OUTNUMBERED_SLOTS.
  it('holding a land front where its side is outnumbered on land, it has OUTNUMBERED_SLOTS order slots more (red without: one order)', () => {
    const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', army: true, four: true });
    expect(budgetOf(w, NOR, monthlyAccounts(w, T)).income).toBeLessThan(PARALLEL_INCOME);
    w.nations.cols.gold[NOR] = 3 * w.rules!.templates[BUILD_MIX_1938.infantry]!.gold;
    runEvents(s, 1);
    expect(land(w, NOR)).toBe(1 + OUTNUMBERED_SLOTS);
    expect(ships(w, NOR)).toEqual([]);
  });

  // PLAN 7.49c (ADR-590): 6421's Soviet Union, one division and 2,407 gold at war with Germany in
  // year 20, bought nothing while Germany walked in: the warship's price was kept over its reserve.
  it('with FEW_FORMATIONS land formations or fewer, at war with an enemy that has an armed fleet, the army orders first: no ship is saved for (red without)', () => {
    for (const opts of [{ army: false }, { army: true }, { army: false, flotilla: true }]) {
      const { s, w, NOR } = setUp({ tag: 'NOR', enemy: 'SWE', ...opts });
      expect(w.formations.ids().filter((f) => w.formations.cols.nation[f] === NOR && !w.isFleet(f) && !w.isWing(f)).length).toBeLessThanOrEqual(FEW_FORMATIONS);
      runEvents(s, 1);
      expect(land(w, NOR)).toBeGreaterThan(0);
      expect(ships(w, NOR)).toEqual([]);
    }
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

// PLAN 7.58 (ADR-607): a fleet the editor placed at tick 0 (a month's start) was laid up in that
// hour by the navy's budget when its nation's navy was over its share: 33 of the 102 living
// nations' battle squadrons of seed 99, placed on open sea, gone with one history line each.
describe('a fleet the editor placed is not laid up (PLAN 7.58)', () => {
  it('a battle squadron placed for each living nation at tick 0 of seed 99 stands after the month\'s start (red without: 33 gone)', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    expect(w.tick).toBe(0);
    // 7.41b's grid: 11 a row, 3 cells apart, about 38° W 28° N (open Atlantic, no enemy in an hour).
    const [u, v] = project(-38, 28);
    const [x0, y0] = [u * W, v * SIZE_1938.h];
    const living: number[] = [];
    w.nations.forEach((n) => void (w.nations.cols.living[n] === 1 && living.push(n)));
    expect(living.length).toBe(102);
    const rows = Math.ceil(living.length / 11);
    const placed: { n: number; id: number; generation: number }[] = [];
    living.forEach((n, k) => {
      const x = x0 + ((k % 11) - 5) * 3;
      const y = y0 + (Math.floor(k / 11) - (rows - 1) / 2) * 3;
      expect(placeFleet(w, n, fleets.battle, x, y)).toBe(Refusal.None);
      const id = Math.max(...w.formations.ids().filter((f) => w.formations.cols.nation[f] === n && w.isFleet(f)));
      expect(w.station.has(id)).toBe(true);
      placed.push({ n, id, generation: w.formations.generation[id]! });
    });
    const ev = runEvents(s, 1);
    const gone = placed.filter((p) => !w.formations.has(p.id) || w.formations.generation[p.id] !== p.generation);
    process.stderr.write(`placed ${placed.length}, gone after the first hour ${gone.length}; nations laying up ${ev.filter((e) => e[1] === EventKind.FleetsLaidUp).length}\n`);
    expect(gone.map((p) => TAGS_1938[p.n - 1])).toEqual([]);
  });

  it('a nation in debt keeps a squadron the editor placed and lays up its own as before (red without: the placed one, the dearest, goes)', () => {
    const s = peaceful();
    const w = s.world;
    const JAP = id('JAP');
    const tpl = (f: number): number => w.formations.cols.template[f]!;
    const battles = (): number[] => w.formations.ids().filter((f) => w.formations.cols.nation[f] === JAP && w.isFleet(f) && tpl(f) === fleets.battle);
    const own = battles();
    expect(own.length).toBeGreaterThan(0);
    const port = w.ports.find((p) => w.cells.controller[p.cell] === JAP)!;
    expect(placeFleet(w, JAP, fleets.battle, port.x, port.y)).toBe(Refusal.None);
    const mine = Math.max(...battles());
    expect(w.station.has(mine)).toBe(true);
    const generation = w.formations.generation[mine]!;
    w.nations.cols.gold[JAP] = -1e5;
    const income = monthlyAccounts(w, T).gross[JAP]!;
    const ev = runEvents(s, 1);
    expect(ev.filter((e) => e[1] === EventKind.FleetsLaidUp && e[2] === JAP).length).toBe(1);
    // The placed squadron stands, its place held.
    expect(w.formations.has(mine) && w.formations.generation[mine] === generation).toBe(true);
    expect(w.station.has(mine)).toBe(true);
    // Its own battle squadrons laid up as before, until its own navy is within its share.
    expect(battles().filter((f) => f !== mine).length).toBeLessThan(own.length);
    expect(navyUpkeep(w, JAP) - UPKEEP_SCALE * T.templateUpkeep[fleets.battle]!).toBeLessThanOrEqual(NAVY_SHARE * income);
  });
});
