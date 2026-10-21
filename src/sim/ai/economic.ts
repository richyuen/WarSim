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
 *    Before all (PLAN 7.3g, ADR-439): while its stockpile's upkeep is over STOCKPILE_SHARE of its
 *    income, a warhead is scrapped at a time (its WARHEAD_UPKEEP saved).
 *    Before the army (PLAN 4.6e1): while its navy's upkeep is over NAVY_SHARE of its income, the
 *    fleets that stand (not under way, not in a sea battle) are laid up, the dearest first
 *    (`FleetsLaidUp`, a crew's DISBAND_MANPOWER back to the pool). A fleet the editor placed that
 *    holds its place (`World.station`, PLAN 7.22c) is neither laid up nor counted in that share
 *    (PLAN 7.58, ADR-607: 33 of 102 placed at tick 0 of seed 99 were gone in the first hour); it
 *    still counts as a navy for the build tests (step 3).
 * 2. Suppression, while a province it holds has unrest ≥ SUPPRESS_FROM (`suppressionLevel`):
 *    SUPPRESS_FULL while the treasury holds a month of it over RESERVE_MONTHS of income, else
 *    SUPPRESS_LEVEL while the budget has room (B before any suppression > SUPPRESS_ROOM × income),
 *    else 0. B then takes the level set (PLAN 7.3e2, ADR-436: from the surplus alone, France with
 *    5,000 gold suppressed nothing while its far core land rose, and four fifths of the land given
 *    back by revolt was ceded by holders that suppressed, at the half level).
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
 *    month, while it has an order in training and an army of its peacetime share (PLAN 7.3b,
 *    `peaceShare`); else it orders the best it has the gold for. Its other orders are motorised
 *    divisions (AT and heavy guns) at war against armour-heavy enemies (≥ ARMOUR_HEAVY of their
 *    elements are tanks), infantry divisions otherwise. (PLAN 3.5d: before, armour was every
 *    third order of a rich nation at war and none against an armour-heavy enemy, so the tanks'
 *    share of a great power's army fell with every year of a game.) An order the treasury
 *    cannot pay for now is replaced by the infantry division if that one can be paid (critic B1,
 *    PLAN 1.42c: the queue used to wait for the dearer division, slots empty, for months of a war).
 *    So is one whose techs the nation does not know (PLAN 3.1a).
 *    Then a fleet (PLAN 4.6e1, `pickFleet`), with what the army's orders left: a nation with a
 *    shipyard and no fleet in training orders one while the upkeep of its armed fleets is under
 *    NAVY_SHARE of its income (PLAN 7.46b1, ADR-574: its submarine flotillas and transport groups,
 *    of no `fleetPower`, are not counted; France with nine submarine flotillas and no warship
 *    built none for years), if its balance stays above the need with the fleet's upkeep and its gold
 *    covers the price and RESERVE_MONTHS of income; none while it wants a transport group (2c).
 *    A nation without a navy (no armed fleet) that would order one saves for the cheapest warship
 *    of its income's kinds (PLAN 7.35d3b, ADR-557, `fleetPrice`): the army's orders and step 3a's
 *    refills keep its price over the reserve, in peace, at war while the army stands at its
 *    peacetime share, and at war with an enemy that has an armed fleet (PLAN 7.46b2, ADR-575:
 *    Britain, its battle line sunk, spent every month on its army and ordered its first warship
 *    years later); at war with such an enemy a navy rebuilt to a ship or two, its armed fleets
 *    under NAVY_SHARE, saves too (PLAN 7.47, ADR-579: the first destroyer ended the saving); but
 *    not at war with FEW_FORMATIONS land formations or fewer, whose army orders first (PLAN 7.49c,
 *    ADR-590).
 *    Then a wing (PLAN 5.8s2, `pickWing`), as a fleet: a nation not poor with an airfield and no
 *    wing in training orders one while its air force's upkeep is under AIR_SHARE of its army's,
 *    a fighter group while fighters are under half its wings, else a tactical bomber group.
 * 2b. A means of delivery (PLAN 7.6b, `deliveryWing`), before research takes the month's surplus:
 *    a nation with warheads and no means of delivery (`canDeliver`: no missiles, no strategic
 *    bomber with a base) and no wing in training orders a strategic bomber group, whatever its air
 *    force's share, for its price and its airfield, paid from the treasury as a deficit is (the
 *    price and DELIVERY_RESERVE_MONTHS of income, and the rest carries the shortfall with its upkeep for
 *    RUNWAY_MONTHS); while it wants one it orders no other wing (it saves for it). It held only the 1938 start's strategic wings: seed 1's Soviet Union had none from
 *    1948 and 7 warheads in 1950 that nothing could carry.
 * 2c. A transport group for a landing (PLAN 7.26h2, ADR-518, `wantsTransport`), after 2b: a
 *    nation in a war in which it has no land front (per war, as the invasion AI's landing since
 *    ADR-511), against an enemy that holds a port, with a free land formation on a land with a
 *    port of its own, and no transport group of its own afloat with a division's room (PLAN 7.55,
 *    ADR-598) or in training, orders one, paid as
 *    2b's group (the price and DELIVERY_RESERVE_MONTHS of income, the shortfall carried for
 *    RUNWAY_MONTHS), outside the navy's share; while it wants one it orders no other fleet. It was
 *    3b's first fleet, behind the navy's share, a front in any war and three months of reserve:
 *    Britain, its four groups of 1938 sunk, ordered none in the five years after on two seeds,
 *    every month over its share (0.13 to 0.31 of income), on 62 of 64 with a front in another war.
 *    A group cut down to one or two transports (2,000–4,000 men) no longer counts (PLAN 7.55):
 *    no division fits in it and no ship is refilled, so it held the nation's landings for good
 *    (seed 5683 year 20 Japan, 7247 year 20 Germany, 4513 year 10 Latvia: rich, a shipyard, no
 *    order in 60 days).
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
import { canDeliver, STOCKPILE_SHARE, WARHEAD_UPKEEP, warheadsOf } from '../systems/nuclear';
import { SUPPRESSION_COST } from '../systems/revolts';
import { frontierOf } from '../systems/territory';
import { neighbours4 } from '../nav/grid';
import { airfield, queueFormation, refillable, refillFormation, shipyard } from '../systems/production';
import { transportRoom } from '../systems/amphibious';
import { fleetPower } from '../systems/seaControl';
import { DAYS_PER_MONTH, researchBudget } from '../systems/research';
import { knowsTechs } from '../tech';
import { Domain, navBuilt, navOf, portSeaOf, seaRangeOf, type World } from '../world';

export const DEBT_PAYBACK = 1 / 12;
/**
 * The most of its template's men a land formation is refilled by in a month (PLAN 7.3e1,
 * ADR-435): a shell is whole again in a little over three months, about an infantry division's
 * training (90 days), and one bled to half in under two.
 */
export const REFILL_MONTH = 0.3;
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
/** The level a treasury over its reserve pays for (PLAN 7.3e2, ADR-436): the most there is. */
export const SUPPRESS_FULL = 1;
export const ARMY_SHARE = 0.35;
export const ARMY_SHARE_WAR = 0.6;
export const PEACE_ARMY_BASE = 0.3;
export const RESERVE_MONTHS = 3;
/**
 * The months of income a nation keeps in its treasury after a delivery wing's price (PLAN 7.6b):
 * less than the other orders' RESERVE_MONTHS, its warheads' means of use first. Seed 1's Soviet
 * Union, 3,100 to 4,200 gold on 950 a month, never held a group's 980 and three months more.
 */
export const DELIVERY_RESERVE_MONTHS = 1;
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
  wings?: { fighter: number; tactical: number; strategic?: number };
}

/**
 * The share of its income a nation's army's upkeep is kept under in peace (ADR-47 §6): placid
 * nations keep smaller standing armies. Below it a nation does not save for its armour (PLAN
 * 7.3b): it raises what it can pay for first.
 */
export function peaceShare(aggression: number): number {
  return ARMY_SHARE * (PEACE_ARMY_BASE + ((1 - PEACE_ARMY_BASE) * aggression) / 100);
}

/**
 * The share of its army's upkeep a nation keeps its air force's under (PLAN 5.8s2): it orders a
 * wing below it. At the start of 1938 the world's is 0.064, a great power's 0.04 to 0.11 (Britain's
 * and the United States', with small armies, 0.8).
 */
export const AIR_SHARE = 0.1;

/**
 * The share of its income a nation keeps its navy's upkeep near (PLAN 4.6e1): it builds below it (the
 * upkeep of its armed fleets, PLAN 7.46b1) and lays up above it when short (the upkeep of all its fleets).
 */
export const NAVY_SHARE = 0.12;
/** The income from which a nation builds battle squadrons (below it, cruiser squadrons from RICH_INCOME, destroyer flotillas under that). */
export const BATTLE_FLEET_INCOME = 1000;
/**
 * At war with a naval enemy, a nation with this many land formations on land or fewer does not save
 * for a warship (PLAN 7.49c, ADR-590): its army orders first, as in a war with no naval enemy.
 */
export const FEW_FORMATIONS = 3;

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
    /** Per nation: the upkeep of its armed fleets (`fleetPower` > 0; PLAN 7.46b1, ADR-574): what the share's build tests read. */
    const armed = new Map<number, number>();
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
        const u = upkeepOf(world, id);
        // A fleet the editor placed (PLAN 7.58, ADR-607) is the player's: no part of the share a lay-up reads.
        if (!world.station.has(id)) navy.set(n, (navy.get(n) ?? 0) + u);
        if (fleetPower(world, id) > 0) armed.set(n, (armed.get(n) ?? 0) + u);
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
    /** The nations with a transport group in training (PLAN 7.26h2). */
    const transportsPending = new Set<number>();
    world.production.forEach((id) => {
      const n = world.production.cols.nation[id]!;
      const t = world.production.cols.template[id]!;
      if (world.rules?.templates[t]?.domain === Domain.sea) {
        shipsPending.set(n, (shipsPending.get(n) ?? 0) + 1);
        if (t === mix.fleets?.transport) transportsPending.add(n);
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
    /**
     * 3a. Refills (PLAN 7.3e1, ADR-435), after the army's new orders: n's land formations that may be
     * refilled (`refillable`), in the order of their ids, each by up to REFILL_MONTH of its
     * template's men, a man of the pool for a man and gold at the template's price a man, under
     * what bounds a new order: the treasury keeps RESERVE_MONTHS of income, the balance stays above
     * the need with the men's upkeep, and the army's upkeep under `cap`; and `keep` gold more (the
     * price of the next order, PLAN 7.3e3). Returns what is left.
     */
    const refill = (n: number, income: number, need: number, balance: number, upkeep: number, cap: number, keep = 0): { balance: number; upkeep: number } => {
      for (const id of own.get(n) ?? []) {
        if (upkeep >= cap || nc.manpower[n]! < 1) break;
        if (!refillable(world, id)) continue;
        const t = f.template[id]!;
        const rule = world.rules!.templates[t]!;
        const perMan = rule.gold / rule.manpower;
        const full = tables.templateStrength[t] ?? 0;
        const upkeepPerMan = full > 0 ? upkeepOfTemplate(t) / full : 0;
        const byGold = perMan > 0 ? (nc.gold[n]! - RESERVE_MONTHS * income - keep) / perMan : Infinity;
        const byUpkeep = upkeepPerMan > 0 ? Math.min(balance - need, cap - upkeep) / upkeepPerMan : Infinity;
        const men = Math.min(REFILL_MONTH * rule.manpower, nc.manpower[n]!, byGold, byUpkeep);
        if (!(men >= 1)) continue;
        const got = refillFormation(world, id, men);
        if (got === 0) continue;
        nc.manpower[n] = nc.manpower[n]! - got;
        nc.gold[n] = nc.gold[n]! - got * perMan;
        const u = got * upkeepPerMan;
        balance -= u;
        upkeep += u;
      }
      return { balance, upkeep };
    };
    world.nations.forEach((n) => {
      if (nc.living[n] !== 1) return;
      // Projected accounts for the month about to be charged (the AI runs before the economy).
      const { income, need } = budgetOf(world, n, acc);
      let { balance } = budgetOf(world, n, acc);
      // A nation without AI: the research budget alone, which is a rule and not a choice (step 4).
      const atWar = world.wars.list.some((w) => w.sides[0].includes(n) || w.sides[1].includes(n));
      const peace = peaceShare(nc.aggression[n]!) * income;
      // A nation without AI: the research budget and the refills alone, which are rules and not
      // choices (steps 4 and 3a).
      if (!world.settings.aiEnabled || nc.aiOff[n] === 1) {
        if (!world.rules) return;
        nc.research[n] = researchBudget(world.rules, nc.gold[n]!, income, balance, need, RUNWAY_MONTHS);
        balance -= nc.research[n]! * DAYS_PER_MONTH + (training.get(n) ?? 0);
        refill(n, income, need, balance, (army.get(n) ?? 0) + (training.get(n) ?? 0), atWar ? ARMY_SHARE_WAR * income : peace);
        return;
      }
      // 1. Disband while the books do not balance and the treasury cannot carry what is short:
      // first the fleets that stand, the dearest first, while the navy is over its share (PLAN
      // 4.6e1: laid up, their crews home), then the army.
      if (balance < need) {
        // The warheads over the stockpile's share first (PLAN 7.3g, ADR-439): bombs nobody uses go
        // before the ships and the men.
        const stock = world.warheads.get(n);
        while (stock && stock.stock > 0 && WARHEAD_UPKEEP * stock.stock > STOCKPILE_SHARE * income) {
          if (balance >= need || nc.gold[n]! >= RUNWAY_MONTHS * (need - balance)) break;
          stock.stock--;
          balance += WARHEAD_UPKEEP;
        }
        let laid = 0;
        const standing = (fleets.get(n) ?? []).filter((id) => f.moving[id] !== 1 && f.engaged[id] !== 1 && seaRangeOf(world, id) === undefined && !world.station.has(id)).sort((a, b) => upkeepOf(world, b) - upkeepOf(world, a) || a - b);
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
      // 2. Suppression, and the month's balance with the level set (it was taken with last month's).
      const was = nc.suppression[n]!;
      nc.suppression[n] = suppressionLevel(restless.has(n), nc.gold[n]!, income, balance + SUPPRESSION_COST * was * income);
      balance -= SUPPRESSION_COST * (nc.suppression[n]! - was) * income;
      if (!world.rules) return;
      // 2b. A means of delivery for its warheads (PLAN 7.6b), before research takes the month's
      // surplus: a strategic bomber group, for its price and its airfield, with no other wing in
      // training; then no other wing this month.
      const carrier = mix.wings && (wingsPending.get(n) ?? 0) === 0 ? deliveryWing(world, n, mix.wings) : -1;
      // It saves for it: no other wing while it wants one (seed 1's Soviet Union, 3,850 gold for a
      // group of 980 and a reserve of 3,040, bought fighters month after month and the group in
      // the 36th month).
      const carried = carrier >= 0;
      if (carrier >= 0 && airfield(world, n, carrier) >= 0) {
        const rule = world.rules.templates[carrier]!;
        const u = upkeepOfTemplate(carrier);
        // Paid from the treasury as a deficit is (step 1): the price and DELIVERY_RESERVE_MONTHS of
        // income in gold, and what is left carries the month's shortfall with its upkeep for
        // RUNWAY_MONTHS. A great power runs a deficit (seed 1's Soviet Union, −179 a month on 7,000
        // gold in 1938), and no wing passed the balance's test of the others.
        const left = nc.gold[n]! - rule.gold;
        if (left >= DELIVERY_RESERVE_MONTHS * income && left >= RUNWAY_MONTHS * Math.max(0, need - (balance - u)) && nc.manpower[n]! >= rule.manpower && queueFormation(world, n, carrier) !== 0) {
          nc.builds[n] = nc.builds[n]! + 1;
          balance -= u;
        }
      }
      // 2c. A transport group for a landing (PLAN 7.26h2, ADR-518), as 2b's group: before research
      // and the army's orders, outside the navy's share; while it wants one, no other fleet.
      const wants = mix.fleets !== undefined && atWar && income >= POOR_INCOME && !transportsPending.has(n) && wantsTransport(world, n, mix.fleets.transport, fleets.get(n) ?? [], tables.templateStrength[mix.infantry] ?? 0);
      if (wants && shipyard(world, n) >= 0) {
        const t = mix.fleets!.transport;
        const rule = world.rules.templates[t]!;
        const u = upkeepOfTemplate(t);
        const left = nc.gold[n]! - rule.gold;
        if (left >= DELIVERY_RESERVE_MONTHS * income && left >= RUNWAY_MONTHS * Math.max(0, need - (balance - u)) && nc.manpower[n]! >= rule.manpower && queueFormation(world, n, t) !== 0) {
          nc.builds[n] = nc.builds[n]! + 1;
          balance -= u;
          shipsPending.set(n, (shipsPending.get(n) ?? 0) + 1);
        }
      }
      // 3b's saving (PLAN 7.35d3b, ADR-557): a nation without a navy (no armed fleet, none in
      // training) that would order a warship saves for the cheapest it wants: the army's orders and
      // the refills keep that price over the reserve, in peace, and at war while its army stands at
      // its peacetime share (a war's army under it is not starved for a ship). Before, the army's
      // line (a division's 1,001 and the reserve) came 119 gold under a destroyer's, and the
      // treasury never climbed past it.
      // At war with an enemy that has an armed fleet it saves whatever its army's share (PLAN 7.46b2,
      // ADR-575): the war at sea is one it has lost, and the army's orders took every month.
      const navalFoe = atWar && world.wars.list.some((w) => {
        const other = w.sides[0].includes(n) ? w.sides[1] : w.sides[1].includes(n) ? w.sides[0] : undefined;
        return other !== undefined && other.some((m) => armed.has(m));
      });
      // A navy rebuilt to a ship or two (armed, under its share) saves too while at war with such an
      // enemy (PLAN 7.47, ADR-579): Britain's first destroyer ended the saving, and its army's orders took
      // the gold again while its navy stood far under its peak.
      // Not with an army of a few formations or none (PLAN 7.49c, ADR-590): 6421's Soviet Union, one
      // division and 2,407 gold at war with Germany in year 20, bought nothing while Germany walked in.
      const saves = !atWar || (navalFoe && (own.get(n)?.length ?? 0) > FEW_FORMATIONS);
      const shipPrice = mix.fleets && !wants && (shipsPending.get(n) ?? 0) === 0 && income >= POOR_INCOME && (armed.get(n) ?? 0) < NAVY_SHARE * income && (navalFoe || !(fleets.get(n) ?? []).some((id) => fleetPower(world, id) > 0)) && shipyard(world, n) >= 0 ? fleetPrice(world, income, mix.fleets) : 0;
      // 4. Research.
      nc.research[n] = researchBudget(world.rules, nc.gold[n]!, income, balance, need, RUNWAY_MONTHS);
      balance -= nc.research[n]! * DAYS_PER_MONTH;
      // 3. Build.
      const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
      // The orders in training count as army already, and against the balance.
      let upkeep = (army.get(n) ?? 0) + (training.get(n) ?? 0);
      let inTanks = tanks.get(n) ?? 0;
      balance -= training.get(n) ?? 0;
      // The army's orders first; what they leave may pay for refills, and then for a fleet.
      const rules = world.rules;
      let ordered = 0;
      const armyOrders = (): void => {
        for (let k = pending.get(n) ?? 0; k < slots; k++) {
          if (upkeep >= (atWar ? ARMY_SHARE_WAR * income : peace)) return;
          // It saves for its armour only with an army of its peacetime share (PLAN 7.3b).
          let t = pickTemplate(world, n, income, atWar, mix, upkeep > 0 ? inTanks / upkeep : 0, k > 0 && upkeep >= peace);
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
          // It saves for a warship: an order only with the warship's price left over the reserve.
          if (shipPrice > 0 && (saves || upkeep >= peace) && nc.gold[n]! - rule.gold < shipPrice + RESERVE_MONTHS * income) return;
          if (nc.gold[n]! < rule.gold + RESERVE_MONTHS * income || nc.manpower[n]! < rule.manpower) return;
          if (queueFormation(world, n, t) === 0) return;
          nc.builds[n] = nc.builds[n]! + 1;
          ordered++;
          balance -= newUpkeep;
          upkeep += newUpkeep;
          inTanks += (tables.templateArmour[t] ?? 0) * newUpkeep;
        }
      };
      armyOrders();
      // 3a. The refills, with what the orders left (PLAN 7.3e1, ADR-435: taken first, they spent
      // the treasury to the reserve every month, and a nation whose army died in contact, where
      // none is refilled, raised nothing for years). With no army order in training and room for
      // one, they keep its price (PLAN 7.3e3: else they spent each month's surplus to the reserve,
      // and the Soviet Union of seed 1 raised nothing in ten years, 3,150 gold against 3,686). Not
      // at war (PLAN 7.26c2b, ADR-514): a nation of an income near 100 saved for most of a year
      // and refilled nothing while its army stood at a fraction of its strength through the war.
      const cap = atWar ? ARMY_SHARE_WAR * income : peace;
      // And the warship's price while it saves for one (ADR-557), at war too (ADR-575).
      const keep = Math.max(!atWar && (pending.get(n) ?? 0) + ordered === 0 && slots > 0 && upkeep < cap ? nextOrderPrice(world, n, income, mix) : 0, shipPrice > 0 && (saves || upkeep >= peace) ? shipPrice : 0);
      ({ balance, upkeep } = refill(n, income, need, balance, upkeep, cap, keep));
      // 3b. A fleet (PLAN 4.6e1), with what the army's orders left: one at a time, while the
      // armed navy is under its share of the income (PLAN 7.46b1, ADR-574: its submarines and
      // transports are not of the battle line it builds).
      const fleet = mix.fleets && !wants && (shipsPending.get(n) ?? 0) === 0 && (armed.get(n) ?? 0) < NAVY_SHARE * income ? pickFleet(world, n, income, mix.fleets) : -1;
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
      const wing = mix.wings && !carried && income >= POOR_INCOME && (wingsPending.get(n) ?? 0) === 0 && (air.get(n) ?? 0) < AIR_SHARE * upkeep ? pickWing(world, n, mix.wings, wings.get(n) ?? []) : -1;
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

/**
 * The suppression level of a nation (PLAN 7.3e2, ADR-436) with a restless province or none, `gold`,
 * `income` and `balance`, the month's balance before any suppression: SUPPRESS_FULL while its
 * treasury holds a month of it over RESERVE_MONTHS of income, else SUPPRESS_LEVEL while the
 * balance has room for it (over SUPPRESS_ROOM of income), else 0.
 */
export function suppressionLevel(restless: boolean, gold: number, income: number, balance: number): number {
  if (!restless) return 0;
  if (gold - SUPPRESSION_COST * SUPPRESS_FULL * income >= RESERVE_MONTHS * income) return SUPPRESS_FULL;
  return balance > SUPPRESS_ROOM * income ? SUPPRESS_LEVEL : 0;
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
 * in tanks; `saves`: it has an order in training and an army of its peacetime share
 * (`peaceShare`). -1: none, it saves for its armour.
 *
 * A nation that wants armour orders the best armoured division of `mix.armour` (the best
 * first) that it knows the techs of. Short of that one's price with the reserve, a nation that
 * saves orders nothing (PLAN 3.5d: an army's upkeep costs the same gold in armour as on foot, and
 * a treasury that buys the infantry division whenever it has its price never has the price of
 * an armoured one). One whose army is under its peacetime share does not save (PLAN 7.3b: the
 * Soviet Union of seed 7321, its army gone at war, raised one division at a time for ten years
 * with two slots and gold for both); it, and one with nothing in training, orders the best it
 * has the gold for, and with
 * the gold for none the best it knows, which the caller replaces by infantry (PLAN 1.42c: the
 * queue does not stand empty). Knowing none, its order is what it would be with armour enough.
 */
function pickTemplate(world: World, n: number, income: number, atWar: boolean, mix: BuildMix, armour: number, saves: boolean): number {
  if (income < POOR_INCOME) return mix.cadre;
  if (armour < armourWanted(income)) {
    const templates = world.rules!.templates;
    const known = mix.armour.filter((t) => templates[t] !== undefined && knowsTechs(world, n, templates[t]!.techs));
    const gold = world.nations.cols.gold[n]!;
    const pays = (t: number): boolean => gold >= templates[t]!.gold + RESERVE_MONTHS * income;
    if (known.length > 0) return saves ? (pays(known[0]!) ? known[0]! : -1) : (known.find(pays) ?? known[0]!);
  }
  if (atWar && armourShareOfEnemies(world, n) >= ARMOUR_HEAVY) return mix.motorised;
  return mix.infantry;
}

/**
 * The price of the order nation `n` places when it can pay for no dearer one (PLAN 7.3e3): a poor
 * nation's cadre division, else the infantry division, or the cadre one without its techs (as the
 * build step replaces an order).
 */
function nextOrderPrice(world: World, n: number, income: number, mix: BuildMix): number {
  const templates = world.rules!.templates;
  const plain = templates[mix.infantry];
  const t = income >= POOR_INCOME && plain && knowsTechs(world, n, plain.techs) ? plain : templates[mix.cadre];
  return t?.gold ?? 0;
}

/**
 * The fleet nation `n` orders next (PLAN 4.6e1), its navy under its share, by its income: the
 * best it can pay for with the reserve it keeps: a battle squadron from BATTLE_FLEET_INCOME, a
 * cruiser squadron from RICH_INCOME, a destroyer flotilla. -1 for a poor nation, or one that can
 * pay for none of them. (Its transport group is step 2c's, PLAN 7.26h2.)
 */
export function pickFleet(world: World, n: number, income: number, kinds: NonNullable<BuildMix['fleets']>): number {
  if (income < POOR_INCOME) return -1;
  const templates = world.rules!.templates;
  const gold = world.nations.cols.gold[n]!;
  const pays = (t: number): boolean => templates[t] !== undefined && gold >= templates[t]!.gold + RESERVE_MONTHS * income;
  return fleetsWanted(income, kinds).find(pays) ?? -1;
}

/** The warships a nation of `income` orders (PLAN 4.6e1), the best first. */
function fleetsWanted(income: number, kinds: NonNullable<BuildMix['fleets']>): number[] {
  return income >= BATTLE_FLEET_INCOME ? [kinds.battle, kinds.cruiser, kinds.destroyer] : income >= RICH_INCOME ? [kinds.cruiser, kinds.destroyer] : [kinds.destroyer];
}

/**
 * The price a nation without a navy saves for (PLAN 7.35d3b, ADR-557): the cheapest warship of
 * its income's kinds; 0 when it has none of them.
 */
export function fleetPrice(world: World, income: number, kinds: NonNullable<BuildMix['fleets']>): number {
  const prices = fleetsWanted(income, kinds).map((t) => world.rules!.templates[t]?.gold ?? Infinity);
  const p = Math.min(...prices);
  return Number.isFinite(p) ? p : 0;
}

/**
 * The wing nation `n` orders next (PLAN 5.8s2), its air force under its share: a fighter group
 * while fighters are under half its wings `own`, else a tactical bomber group; the other when it
 * lacks the techs of that one; -1 when it lacks both.
 */
/**
 * The strategic bomber group nation `n` orders to deliver its warheads (PLAN 7.6b): it has a
 * warhead and no means of delivery (`canDeliver`), and knows the template's techs; else -1.
 */
export function deliveryWing(world: World, n: number, kinds: NonNullable<BuildMix['wings']>): number {
  const t = kinds.strategic;
  if (t === undefined || t < 0 || warheadsOf(world, n) < 1 || canDeliver(world, n)) return -1;
  const rule = world.rules!.templates[t];
  return rule && knowsTechs(world, n, rule.techs) ? t : -1;
}

function pickWing(world: World, n: number, kinds: NonNullable<BuildMix['wings']>, own: number[]): number {
  const f = world.formations.cols;
  const fighters = own.filter((id) => f.template[id] === kinds.fighter).length;
  const order = 2 * fighters < own.length || own.length === 0 ? [kinds.fighter, kinds.tactical] : [kinds.tactical, kinds.fighter];
  return order.find((t) => world.rules!.templates[t] !== undefined && knowsTechs(world, n, world.rules!.templates[t]!.techs)) ?? -1;
}

/**
 * Whether nation `n`, at war, wants a transport group for a landing (PLAN 7.26h2, ADR-518): it has
 * none of template `transport` among its fleets `own`, it is in a war in which it holds no cell
 * beside one of the other side's (the invasion AI's per-war front, ADR-511) and a nation of that
 * side holds a port with water, and a free land formation of its own (not under way, in no fight,
 * not retreating or going home) stands on a land with a port it holds: men to carry, from where
 * they go aboard, to a coast to land on.
 * A group of its with room under `division` men is not one (PLAN 7.55, ADR-598): its transports
 * sunk to one or two, it carries no division, and no ship is refilled.
 */
export function wantsTransport(world: World, n: number, transport: number, own: readonly number[], division = 0): boolean {
  const f = world.formations.cols;
  if (own.some((id) => f.template[id] === transport && transportRoom(world, id) >= division)) return false;
  const { w, h, controller } = world.cells;
  const nb: number[] = [];
  const fronted = new Set<number>();
  for (const c of frontierOf(world)) {
    if (controller[c] !== n) continue;
    for (const k of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
      const m = controller[k]!;
      if (m !== 0 && m !== n && world.wars.atWar(n, m)) fronted.add(m);
    }
  }
  const foes = new Set<number>();
  for (const war of world.wars.list) {
    const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
    if (i < 0) continue;
    const other = war.sides[1 - i]!;
    if (other.some((e) => fronted.has(e))) continue;
    for (const e of other) if (world.wars.atWar(n, e)) foes.add(e);
  }
  if (foes.size === 0) return false;
  const water = portSeaOf(world);
  const comp = navOf(world).grid.component;
  const lands = new Set<number>();
  let target = false;
  world.ports.forEach((p, i) => {
    if (water[i]! < 0) return;
    const holder = controller[p.cell]!;
    if (holder === n) lands.add(comp[p.cell]!);
    else if (foes.has(holder)) target = true;
  });
  if (!target || lands.size === 0) return false;
  let free = false;
  world.formations.forEach((id) => {
    if (free || f.nation[id] !== n || world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    if (f.moving[id] === 1 || f.engaged[id] === 1 || f.retreat[id] !== 0 || f.home[id] !== 0) return;
    if (lands.has(comp[Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!)]!)) free = true;
  });
  return free;
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
