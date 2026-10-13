/**
 * Economic AI v1 (SPEC §7, PLAN 1.26): budget balance, suppression and the build mix. Monthly,
 * just before the economy charges the month, for every living AI nation:
 *
 * 1. Balance: with B = projected gross − upkeep − admin − CE cost − suppression − tribute (the
 *    month about to be charged), the nation needs B ≥ DEBT_PAYBACK × max(0, −gold) +
 *    MARGIN × income (pay any debt back within a year, keep a margin). While it is short by S =
 *    need − B and its gold is below RUNWAY_MONTHS × S, it disbands idle (not engaged)
 *    formations: those with the least of their upkeep in tanks first (`templateArmour`), among
 *    them the weakest by men (lowest id on ties). (PLAN 3.1d: by men alone a tank brigade of
 *    1,800 went before every rifle division, and a formation's price is 200 months of its
 *    upkeep whatever it is, so the price tells nothing apart; armour takes twice to four times
 *    the days to raise again and gives the fewest men back.) A disbanded formation stops its upkeep at
 *    once and returns DISBAND_MANPOWER of its men to the pool. A nation with gold enough runs
 *    the deficit instead (PLAN 2.13: the AI disbanded 228 of the 1,054 formations of 1938 in
 *    the first hour, the Soviet Union's with six years of its deficit in the treasury). One
 *    `FormationsDisbanded` event, and so one line of the history, per nation and month.
 *    Before the army (PLAN 4.6e1): while its navy's upkeep is over NAVY_SHARE of its income, the
 *    fleets that stand (not under way, not in a sea battle) are laid up, the dearest first
 *    (`FleetsLaidUp`, a crew's DISBAND_MANPOWER back to the pool).
 * 2. Suppression: SUPPRESS_LEVEL while a province it holds has unrest ≥ SUPPRESS_FROM
 *    and the budget has room (B > SUPPRESS_ROOM × income), else 0.
 * 3. Build: up to 1 + income/PARALLEL_INCOME orders in training at once (at most MAX_PARALLEL),
 *    while army upkeep (with the orders in training) is below ARMY_SHARE × (PEACE_ARMY_BASE +
 *    (1 − PEACE_ARMY_BASE) × aggression/100) (peace: placid nations keep smaller standing
 *    armies) / ARMY_SHARE_WAR (war) of income, B stays positive after the new upkeep, and gold covers the
 *    order plus RESERVE_MONTHS of income. (Critic B1, 2026-10-03: one order at a time for
 *    everybody meant ~36 divisions a year worldwide; armies never recovered from a war and the
 *    great powers sat on unspent treasuries.) Mix: poor nations
 *    (income < POOR_INCOME) raise cadre divisions. A nation with less of its army's upkeep in
 *    tanks than it wants (`armourWanted`: none up to RICH_INCOME, rising with the income to
 *    ARMOUR_SHARE_MAX; the army with the orders in training, each order counted as it is
 *    made) orders an armoured division, in peace as at war: the best of `mix.armour` whose
 *    techs it knows (PLAN 3.1c: the division of 1938 until the medium tank of 1941 is known,
 *    and so on). Short of its price with the reserve it saves, and orders nothing more that
 *    month, while it has an order in training; with none in training it orders the best it
 *    has the gold for. Its other orders are motorised
 *    divisions (AT and heavy guns) at war against armour-heavy enemies (≥ ARMOUR_HEAVY of their
 *    elements are tanks), infantry divisions otherwise. (PLAN 3.5d: before, armour was every
 *    third order of a rich nation at war and none against an armour-heavy enemy, so the tanks'
 *    share of a great power's army fell with every year of a game.) An order the treasury
 *    cannot pay for now is replaced by the infantry division if that one can be paid (critic B1,
 *    PLAN 1.42c: the queue used to wait for the dearer division, slots empty, for months of a war).
 *    So is one whose techs the nation does not know (PLAN 3.1a).
 *    Then a fleet (PLAN 4.6e1, `pickFleet`), with what the army's orders left: a nation with a
 *    shipyard and no fleet in training orders one while its navy's upkeep is under NAVY_SHARE
 *    of its income, if its balance stays above the need with the fleet's upkeep and its gold
 *    covers the price and RESERVE_MONTHS of income.
 *    Then a wing (PLAN 5.8s2, `pickWing`), as a fleet: a nation not poor with an airfield and no
 *    wing in training orders one while its air force's upkeep is under AIR_SHARE of its army's,
 *    a fighter group while fighters are under half its wings, else a tactical bomber group.
 * 4. Research (PLAN 3.1b, `systems/research.ts`), set between 2 and 3: the budget of the days
 *    to come is RESEARCH_SHARE of income, at most what the lines can take (`researchCap`), and
 *    nothing for a nation in debt or one that step 1 would have disband (short, and the
 *    treasury below RUNWAY_MONTHS of what is short): research is cut before the army is. The
 *    month's research counts against the balance the build step works with.
 *    This step alone is also taken for a living nation without AI (its own switched off, a
 *    played one, or the AI off for the world; PLAN 3.4Rg, ADR-144): the budget is a rule of the
 *    economy (`researchBudget`), and without it such a nation would never open a line. Nothing
 *    of it is disbanded, so "would have disband" is then "is short" as the month finds it.
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { elementIndex, destroyFormation } from '../systems/elements';
import { monthlyAccounts, UPKEEP_SCALE, type EconomyTables } from '../systems/economy';
import { COST_SHARE, PEACE_CE, WAR_CE } from '../systems/efficiency';
import { TRIBUTE } from '../systems/puppets';
import { SUPPRESSION_COST } from '../systems/revolts';
import { frontierOf } from '../systems/territory';
import { neighbours4 } from '../nav/grid';
import { airfield, queueFormation, shipyard } from '../systems/production';
import { DAYS_PER_MONTH, researchBudget } from '../systems/research';
import { knowsTechs } from '../tech';
import { Domain, navBuilt, seaRangeOf, type World } from '../world';

export const DEBT_PAYBACK = 1 / 12;
export const MARGIN = 0.05;
export const DISBAND_MANPOWER = 0.5;
/**
 * A nation short of money disbands only while its gold is below this many months of what it is
 * short (PLAN 2.13): a treasury is there to be spent on the army before the army is sent home.
 */
export const RUNWAY_MONTHS = 3;
export const SUPPRESS_LEVEL = 0.5;
export const SUPPRESS_FROM = 40;
export const SUPPRESS_ROOM = 0.15;
export const ARMY_SHARE = 0.35;
export const ARMY_SHARE_WAR = 0.6;
export const PEACE_ARMY_BASE = 0.3;
export const RESERVE_MONTHS = 3;
export const PARALLEL_INCOME = 400;
export const MAX_PARALLEL = 6;
export const POOR_INCOME = 20;
export const RICH_INCOME = 200;
export const ARMOUR_HEAVY = 0.2;
/**
 * The most of its army's upkeep a nation wants in tanks (PLAN 3.5d): one armoured division of
 * 1938 among eight divisions is 0.29 (SPEC §4, the random world's armies), and Britain's and
 * France's armies of 1938 have 0.32 and 0.31.
 */
export const ARMOUR_SHARE_MAX = 0.3;
/** The income from which a nation wants ARMOUR_SHARE_MAX: the five richest of 1938 have it. */
export const ARMOUR_FULL_INCOME = 1000;

/**
 * The share of its army's upkeep that a nation of this monthly income wants in tanks (PLAN
 * 3.5d): none up to RICH_INCOME, then rising in a line to ARMOUR_SHARE_MAX at ARMOUR_FULL_INCOME.
 */
export function armourWanted(income: number): number {
  return ARMOUR_SHARE_MAX * Math.min(1, Math.max(0, (income - RICH_INCOME) / (ARMOUR_FULL_INCOME - RICH_INCOME)));
}

export interface BuildMix {
  infantry: number;
  cadre: number;
  motorised: number;
  /** The armoured divisions, the best first (PLAN 3.1c). */
  armour: readonly number[];
  /** The fleets the AI builds (PLAN 4.6e1); none, it builds no fleet. */
  fleets?: { battle: number; cruiser: number; destroyer: number; transport: number };
  /** The wings the AI builds (PLAN 5.8s2); none, it builds no wing. */
  wings?: { fighter: number; tactical: number };
}

/**
 * The share of its army's upkeep a nation keeps its air force's under (PLAN 5.8s2): it orders a
 * wing below it. At the start of 1938 the world's is 0.064, a great power's 0.04 to 0.11 (Britain's
 * and the United States', with small armies, 0.8).
 */
export const AIR_SHARE = 0.1;

/** The share of its income a nation keeps its navy's upkeep near (PLAN 4.6e1): it builds below it and lays up above it when short. */
export const NAVY_SHARE = 0.12;
/** The income from which a nation builds battle squadrons (below it, cruiser squadrons from RICH_INCOME, destroyer flotillas under that). */
export const BATTLE_FLEET_INCOME = 1000;

export function economicAi(tables: EconomyTables, mix: BuildMix): (world: World) => void {
  const upkeepOf = (world: World, id: number): number => {
    const f = world.formations.cols;
    const t = f.template[id]!;
    const full = tables.templateStrength[t] ?? 0;
    return full > 0 ? (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0) * f.strength[id]!) / full : 0;
  };
  return function economicAiSystem(world: World): void {
    if (!isMonthStart(world.startDay, world.tick)) return;
    const nc = world.nations.cols;
    if (!world.settings.aiEnabled && !world.rules) return;
    const f = world.formations.cols;
    const armourOf = (id: number): number => tables.templateArmour[f.template[id]!] ?? 0;
    // Per nation: own formations and their upkeep.
    const own = new Map<number, number[]>();
    const army = new Map<number, number>();
    /** Upkeep the orders in training will add. */
    const training = new Map<number, number>();
    /** The tanks' part of the army's upkeep, the orders in training with it. */
    const tanks = new Map<number, number>();
    /** Per nation: its fleets and their upkeep (PLAN 4.6e1). */
    const fleets = new Map<number, number[]>();
    const navy = new Map<number, number>();
    /** Per nation: its wings and their upkeep (PLAN 5.8s2). */
    const wings = new Map<number, number[]>();
    const air = new Map<number, number>();
    world.formations.forEach((id) => {
      // A fleet is not of the army (PLAN 4.2b): it is not sent home with it, and its upkeep is
      // no part of the share of the income an army may take; it has a share of its own (PLAN
      // 4.6e1). An army aboard is of the army.
      if (world.isFleet(id)) {
        const n = f.nation[id]!;
        const l = fleets.get(n) ?? [];
        l.push(id);
        fleets.set(n, l);
        navy.set(n, (navy.get(n) ?? 0) + upkeepOf(world, id));
        return;
      }
      // A wing is not of the army either: its air force has a share of the army's (PLAN 5.8s2).
      if (world.isWing(id)) {
        const n = f.nation[id]!;
        const l = wings.get(n) ?? [];
        l.push(id);
        wings.set(n, l);
        air.set(n, (air.get(n) ?? 0) + upkeepOf(world, id));
        return;
      }
      if (world.offLand(id)) return;
      const n = f.nation[id]!;
      const l = own.get(n) ?? [];
      l.push(id);
      own.set(n, l);
      const u = upkeepOf(world, id);
      army.set(n, (army.get(n) ?? 0) + u);
      tanks.set(n, (tanks.get(n) ?? 0) + armourOf(id) * u);
    });
    const pending = new Map<number, number>();
    const upkeepOfTemplate = (t: number): number => (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0)) || 0;
    /** Per nation: the fleets in training, and the wings (PLAN 5.8s2). */
    const shipsPending = new Map<number, number>();
    const wingsPending = new Map<number, number>();
    world.production.forEach((id) => {
      const n = world.production.cols.nation[id]!;
      const t = world.production.cols.template[id]!;
      if (world.rules?.templates[t]?.domain === Domain.sea) {
        shipsPending.set(n, (shipsPending.get(n) ?? 0) + 1);
        return;
      }
      if (world.rules?.templates[t]?.domain === Domain.air) {
        wingsPending.set(n, (wingsPending.get(n) ?? 0) + 1);
        return;
      }
      pending.set(n, (pending.get(n) ?? 0) + 1);
      training.set(n, (training.get(n) ?? 0) + upkeepOfTemplate(t));
      tanks.set(n, (tanks.get(n) ?? 0) + (tables.templateArmour[t] ?? 0) * upkeepOfTemplate(t));
    });
    const restless = restlessNations(world);
    const acc = monthlyAccounts(world, tables);
    world.nations.forEach((n) => {
      if (nc.living[n] !== 1) return;
      // Projected accounts for the month about to be charged (the AI runs before the economy).
      const { income, need } = budgetOf(world, n, acc);
      let { balance } = budgetOf(world, n, acc);
      // A nation without AI: the research budget alone, which is a rule and not a choice (step 4).
      if (!world.settings.aiEnabled || nc.aiOff[n] === 1) {
        if (world.rules) nc.research[n] = researchBudget(world.rules, nc.gold[n]!, income, balance, need, RUNWAY_MONTHS);
        return;
      }
      // 1. Disband while the books do not balance and the treasury cannot carry what is short:
      // first the fleets that stand, the dearest first, while the navy is over its share (PLAN
      // 4.6e1: laid up, their crews home), then the army.
      if (balance < need) {
        let laid = 0;
        const standing = (fleets.get(n) ?? []).filter((id) => f.moving[id] !== 1 && f.engaged[id] !== 1 && seaRangeOf(world, id) === undefined).sort((a, b) => upkeepOf(world, b) - upkeepOf(world, a) || a - b);
        for (const id of standing) {
          if (balance >= need || nc.gold[n]! >= RUNWAY_MONTHS * (need - balance) || (navy.get(n) ?? 0) <= NAVY_SHARE * income) break;
          const u = upkeepOf(world, id);
          if (u <= 0) continue;
          nc.manpower[n] = nc.manpower[n]! + DISBAND_MANPOWER * f.strength[id]!;
          destroyFormation(world, id);
          balance += u;
          navy.set(n, (navy.get(n) ?? 0) - u);
          laid++;
        }
        if (laid > 0) world.out.emit(world.tick, EventKind.FleetsLaidUp, n, laid, NaN, NaN);
        const idle = (own.get(n) ?? []).filter((id) => f.engaged[id] !== 1).sort((a, b) => armourOf(a) - armourOf(b) || f.strength[a]! - f.strength[b]! || a - b);
        let cut = 0;
        for (const id of idle) {
          if (balance >= need || nc.gold[n]! >= RUNWAY_MONTHS * (need - balance)) break;
          const u = upkeepOf(world, id);
          if (u <= 0) continue;
          nc.manpower[n] = nc.manpower[n]! + DISBAND_MANPOWER * f.strength[id]!;
          destroyFormation(world, id);
          balance += u;
          army.set(n, (army.get(n) ?? 0) - u);
          tanks.set(n, (tanks.get(n) ?? 0) - armourOf(id) * u);
          cut++;
        }
        if (cut > 0) world.out.emit(world.tick, EventKind.FormationsDisbanded, n, cut, NaN, NaN);
      }
      // 2. Suppression.
      nc.suppression[n] = restless.has(n) && balance > SUPPRESS_ROOM * income ? SUPPRESS_LEVEL : 0;
      if (!world.rules) return;
      // 4. Research.
      nc.research[n] = researchBudget(world.rules, nc.gold[n]!, income, balance, need, RUNWAY_MONTHS);
      balance -= nc.research[n]! * DAYS_PER_MONTH;
      // 3. Build.
      const atWar = world.wars.list.some((w) => w.sides[0].includes(n) || w.sides[1].includes(n));
      const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
      // The orders in training count as army already, and against the balance.
      let upkeep = (army.get(n) ?? 0) + (training.get(n) ?? 0);
      let inTanks = tanks.get(n) ?? 0;
      balance -= training.get(n) ?? 0;
      // The army's orders first; what they leave may pay for a fleet.
      const rules = world.rules;
      const armyOrders = (): void => {
        for (let k = pending.get(n) ?? 0; k < slots; k++) {
          if (upkeep >= (atWar ? ARMY_SHARE_WAR : ARMY_SHARE * (PEACE_ARMY_BASE + ((1 - PEACE_ARMY_BASE) * nc.aggression[n]!) / 100)) * income) return;
          let t = pickTemplate(world, n, income, atWar, mix, upkeep > 0 ? inTanks / upkeep : 0, k > 0);
          // It saves for its armour: no order more this month.
          if (t < 0) return;
          let rule = rules.templates[t]!;
          const plain = rules.templates[mix.infantry];
          if (plain && rule.gold > plain.gold && nc.gold[n]! < rule.gold + RESERVE_MONTHS * income) {
            t = mix.infantry;
            rule = plain;
          }
          // And one it has not the techs for by the plain division, or the cadre one, which asks for none (PLAN 3.1a).
          for (const next of [mix.infantry, mix.cadre]) {
            if (knowsTechs(world, n, rule.techs)) break;
            const other = rules.templates[next];
            if (!other) continue;
            t = next;
            rule = other;
          }
          const newUpkeep = upkeepOfTemplate(t);
          if (balance - newUpkeep <= need) return;
          if (nc.gold[n]! < rule.gold + RESERVE_MONTHS * income || nc.manpower[n]! < rule.manpower) return;
          if (queueFormation(world, n, t) === 0) return;
          nc.builds[n] = nc.builds[n]! + 1;
          balance -= newUpkeep;
          upkeep += newUpkeep;
          inTanks += (tables.templateArmour[t] ?? 0) * newUpkeep;
        }
      };
      armyOrders();
      // 3b. A fleet (PLAN 4.6e1), with what the army's orders left: one at a time, while the
      // navy is under its share of the income.
      const fleet = mix.fleets && (shipsPending.get(n) ?? 0) === 0 && (navy.get(n) ?? 0) < NAVY_SHARE * income ? pickFleet(world, n, income, atWar, mix.fleets, fleets.get(n) ?? []) : -1;
      if (fleet >= 0 && shipyard(world, n) >= 0) {
        const rule = rules.templates[fleet]!;
        const u = upkeepOfTemplate(fleet);
        if (balance - u > need && nc.gold[n]! >= rule.gold + RESERVE_MONTHS * income && nc.manpower[n]! >= rule.manpower && queueFormation(world, n, fleet) !== 0) {
          nc.builds[n] = nc.builds[n]! + 1;
          balance -= u;
        }
      }
      // 3c. A wing (PLAN 5.8s2), with what is left: one at a time, while the air force is under
      // its share of the army's upkeep (the orders in training with it).
      const wing = mix.wings && income >= POOR_INCOME && (wingsPending.get(n) ?? 0) === 0 && (air.get(n) ?? 0) < AIR_SHARE * upkeep ? pickWing(world, n, mix.wings, wings.get(n) ?? []) : -1;
      if (wing >= 0 && airfield(world, n, wing) >= 0) {
        const rule = rules.templates[wing]!;
        const u = upkeepOfTemplate(wing);
        if (balance - u > need && nc.gold[n]! >= rule.gold + RESERVE_MONTHS * income && nc.manpower[n]! >= rule.manpower && queueFormation(world, n, wing) !== 0) {
          nc.builds[n] = nc.builds[n]! + 1;
          balance -= u;
        }
      }
    });
  };
}

/**
 * The month about to be charged, as the economic AI sees it for nation `n`: `income` (gross, not
 * below 0), `balance` (income − expenses − CE cost − suppression − tribute) and `need`, what the
 * balance has to be (a debt paid back within a year, and a margin). `need − balance`, when
 * above 0, is what the nation is short each month. `acc` is `monthlyAccounts` of the world.
 */
export function budgetOf(world: World, n: number, acc: { gross: ArrayLike<number>; expenses: ArrayLike<number> }): { income: number; balance: number; need: number } {
  const nc = world.nations.cols;
  const income = Math.max(0, acc.gross[n]!);
  const extra =
    (COST_SHARE * Math.max(0, nc.efficiency[n]! - PEACE_CE)) / (WAR_CE - PEACE_CE) * income +
    SUPPRESSION_COST * nc.suppression[n]! * income +
    (nc.overlord[n] !== 0 ? TRIBUTE * (1 - nc.autonomy[n]! / 100) * income : 0);
  return { income, balance: income - acc.expenses[n]! - extra, need: DEBT_PAYBACK * Math.max(0, -nc.gold[n]!) + MARGIN * income };
}

/** Nations holding a province with unrest ≥ SUPPRESS_FROM (non-core land, or an overextended empire's periphery). */
function restlessNations(world: World): Set<number> {
  const out = new Set<number>();
  const pv = world.provinces;
  if (pv.count === 0) return out;
  const g = navBuilt(world)?.graph;
  if (!g) return out;
  for (let p = 1; p < pv.count; p++) {
    if (pv.unrest[p]! < SUPPRESS_FROM) continue;
    const c = g.centre[p] ?? -1;
    if (c < 0) continue;
    const o = world.cells.owner[c]!;
    if (o !== 0) out.add(o);
  }
  return out;
}

/**
 * The next order of `n`, whose army (the orders in training with it) has `armour` of its upkeep
 * in tanks; `busy`: it has an order in training. -1: none, it saves for its armour.
 *
 * A nation that wants armour orders the best armoured division of `mix.armour` (the best
 * first) that it knows the techs of. Short of that one's price with the reserve, a busy nation
 * orders nothing (PLAN 3.5d: an army's upkeep costs the same gold in armour as on foot, and a
 * treasury that buys the infantry division whenever it has its price never has the price of
 * an armoured one); one with nothing in training orders the best it has the gold for, and with
 * the gold for none the best it knows, which the caller replaces by infantry (PLAN 1.42c: the
 * queue does not stand empty). Knowing none, its order is what it would be with armour enough.
 */
function pickTemplate(world: World, n: number, income: number, atWar: boolean, mix: BuildMix, armour: number, busy: boolean): number {
  if (income < POOR_INCOME) return mix.cadre;
  if (armour < armourWanted(income)) {
    const templates = world.rules!.templates;
    const known = mix.armour.filter((t) => templates[t] !== undefined && knowsTechs(world, n, templates[t]!.techs));
    const gold = world.nations.cols.gold[n]!;
    const pays = (t: number): boolean => gold >= templates[t]!.gold + RESERVE_MONTHS * income;
    if (known.length > 0) return busy ? (pays(known[0]!) ? known[0]! : -1) : (known.find(pays) ?? known[0]!);
  }
  if (atWar && armourShareOfEnemies(world, n) >= ARMOUR_HEAVY) return mix.motorised;
  return mix.infantry;
}

/**
 * The fleet nation `n` orders next (PLAN 4.6e1), its navy under its share: a transport group
 * when it is at war with no land front and has none (the invasion AI's want, PLAN 4.6b); else
 * by its income, the best it can pay for with the reserve it keeps: a battle squadron from
 * BATTLE_FLEET_INCOME, a cruiser squadron from RICH_INCOME, a destroyer flotilla. -1 for a
 * poor nation, or one that can pay for none of them.
 */
function pickFleet(world: World, n: number, income: number, atWar: boolean, kinds: NonNullable<BuildMix['fleets']>, own: number[]): number {
  if (income < POOR_INCOME) return -1;
  const templates = world.rules!.templates;
  const gold = world.nations.cols.gold[n]!;
  const pays = (t: number): boolean => templates[t] !== undefined && gold >= templates[t]!.gold + RESERVE_MONTHS * income;
  const f = world.formations.cols;
  if (atWar && !own.some((id) => f.template[id] === kinds.transport) && !hasFront(world, n)) return pays(kinds.transport) ? kinds.transport : -1;
  const wanted = income >= BATTLE_FLEET_INCOME ? [kinds.battle, kinds.cruiser, kinds.destroyer] : income >= RICH_INCOME ? [kinds.cruiser, kinds.destroyer] : [kinds.destroyer];
  return wanted.find(pays) ?? -1;
}

/**
 * The wing nation `n` orders next (PLAN 5.8s2), its air force under its share: a fighter group
 * while fighters are under half its wings `own`, else a tactical bomber group; the other when it
 * lacks the techs of that one; -1 when it lacks both.
 */
function pickWing(world: World, n: number, kinds: NonNullable<BuildMix['wings']>, own: number[]): number {
  const f = world.formations.cols;
  const fighters = own.filter((id) => f.template[id] === kinds.fighter).length;
  const order = 2 * fighters < own.length || own.length === 0 ? [kinds.fighter, kinds.tactical] : [kinds.tactical, kinds.fighter];
  return order.find((t) => world.rules!.templates[t] !== undefined && knowsTechs(world, n, world.rules!.templates[t]!.techs)) ?? -1;
}

/** Whether nation `n` holds a cell beside one held by a nation at war with it. */
function hasFront(world: World, n: number): boolean {
  const { w, h, controller } = world.cells;
  const nb: number[] = [];
  for (const c of frontierOf(world)) {
    if (controller[c] !== n) continue;
    for (const k of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
      const m = controller[k]!;
      if (m !== 0 && m !== n && world.wars.atWar(n, m)) return true;
    }
  }
  return false;
}

/** Share of tank elements among the elements of n's enemies' formations. */
function armourShareOfEnemies(world: World, n: number): number {
  const idx = elementIndex(world);
  const f = world.formations.cols;
  const ec = world.elements.cols;
  const units = world.rules!.units;
  let tanks = 0;
  let all = 0;
  world.formations.forEach((id) => {
    if (!world.wars.atWar(n, f.nation[id]!) || world.offLand(id)) return; // of the enemies' armies (PLAN 4.2b)
    for (const e of idx.get(id) ?? []) {
      all++;
      if (units[ec.unit[e]!]!.cls.startsWith('armor')) tanks++;
    }
  });
  return all > 0 ? tanks / all : 0;
}
