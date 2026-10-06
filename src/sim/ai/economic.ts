/**
 * Economic AI v1 (SPEC §7, PLAN 1.26): budget balance, suppression and the build mix. Monthly,
 * just before the economy charges the month, for every living AI nation:
 *
 * 1. Balance: with B = projected gross − upkeep − admin − CE cost − suppression − tribute (the
 *    month about to be charged), the nation needs B ≥ DEBT_PAYBACK × max(0, −gold) +
 *    MARGIN × income (pay any debt back within a year, keep a margin). While it is short by S =
 *    need − B and its gold is below RUNWAY_MONTHS × S, it disbands idle (not engaged)
 *    formations, weakest first (lowest id on ties); a disbanded formation stops its upkeep at
 *    once and returns DISBAND_MANPOWER of its men to the pool. A nation with gold enough runs
 *    the deficit instead (PLAN 2.13: the AI disbanded 228 of the 1,054 formations of 1938 in
 *    the first hour, the Soviet Union's with six years of its deficit in the treasury). One
 *    `FormationsDisbanded` event, and so one line of the history, per nation and month.
 * 2. Suppression: SUPPRESS_LEVEL while a province it holds has unrest ≥ SUPPRESS_FROM
 *    and the budget has room (B > SUPPRESS_ROOM × income), else 0.
 * 3. Build: up to 1 + income/PARALLEL_INCOME orders in training at once (at most MAX_PARALLEL),
 *    while army upkeep (with the orders in training) is below ARMY_SHARE × (PEACE_ARMY_BASE +
 *    (1 − PEACE_ARMY_BASE) × aggression/100) (peace: placid nations keep smaller standing
 *    armies) / ARMY_SHARE_WAR (war) of income, B stays positive after the new upkeep, and gold covers the
 *    order plus RESERVE_MONTHS of income. (Critic B1, 2026-10-03: one order at a time for
 *    everybody meant ~36 divisions a year worldwide; armies never recovered from a war and the
 *    great powers sat on unspent treasuries.) Mix: poor nations
 *    (income < POOR_INCOME) raise cadre divisions; against armour-heavy enemies (≥ ARMOUR_HEAVY of
 *    their elements are tanks) motorised divisions (AT and heavy guns); rich nations at war add a
 *    panzer division every third order; infantry divisions otherwise. An order the treasury
 *    cannot pay for now is replaced by the infantry division if that one can be paid (critic B1,
 *    PLAN 1.42c: the queue used to wait for the dearer division, slots empty, for months of a war).
 *    So is one whose techs the nation does not know (PLAN 3.1a).
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { elementIndex, destroyFormation } from '../systems/elements';
import { monthlyAccounts, UPKEEP_SCALE, type EconomyTables } from '../systems/economy';
import { COST_SHARE, PEACE_CE, WAR_CE } from '../systems/efficiency';
import { TRIBUTE } from '../systems/puppets';
import { SUPPRESSION_COST } from '../systems/revolts';
import { queueFormation } from '../systems/production';
import { knowsTechs } from '../tech';
import type { World } from '../world';

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

export interface BuildMix {
  infantry: number;
  cadre: number;
  motorised: number;
  panzer: number;
}

export function economicAi(tables: EconomyTables, mix: BuildMix): (world: World) => void {
  const upkeepOf = (world: World, id: number): number => {
    const f = world.formations.cols;
    const t = f.template[id]!;
    const full = tables.templateStrength[t] ?? 0;
    return full > 0 ? (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0) * f.strength[id]!) / full : 0;
  };
  return function economicAiSystem(world: World): void {
    if (!world.settings.aiEnabled || !isMonthStart(world.startDay, world.tick)) return;
    const nc = world.nations.cols;
    const f = world.formations.cols;
    // Per nation: own formations and their upkeep.
    const own = new Map<number, number[]>();
    const army = new Map<number, number>();
    /** Upkeep the orders in training will add. */
    const training = new Map<number, number>();
    world.formations.forEach((id) => {
      const n = f.nation[id]!;
      const l = own.get(n) ?? [];
      l.push(id);
      own.set(n, l);
      army.set(n, (army.get(n) ?? 0) + upkeepOf(world, id));
    });
    const pending = new Map<number, number>();
    const upkeepOfTemplate = (t: number): number => (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0)) || 0;
    world.production.forEach((id) => {
      const n = world.production.cols.nation[id]!;
      pending.set(n, (pending.get(n) ?? 0) + 1);
      training.set(n, (training.get(n) ?? 0) + upkeepOfTemplate(world.production.cols.template[id]!));
    });
    const restless = restlessNations(world);
    const acc = monthlyAccounts(world, tables);
    world.nations.forEach((n) => {
      if (nc.living[n] !== 1 || nc.aiOff[n] === 1) return;
      // Projected accounts for the month about to be charged (the AI runs before the economy).
      const { income, need } = budgetOf(world, n, acc);
      let { balance } = budgetOf(world, n, acc);
      // 1. Disband while the books do not balance and the treasury cannot carry what is short.
      if (balance < need) {
        const idle = (own.get(n) ?? []).filter((id) => f.engaged[id] !== 1).sort((a, b) => f.strength[a]! - f.strength[b]! || a - b);
        let cut = 0;
        for (const id of idle) {
          if (balance >= need || nc.gold[n]! >= RUNWAY_MONTHS * (need - balance)) break;
          const u = upkeepOf(world, id);
          if (u <= 0) continue;
          nc.manpower[n] = nc.manpower[n]! + DISBAND_MANPOWER * f.strength[id]!;
          destroyFormation(world, id);
          balance += u;
          army.set(n, (army.get(n) ?? 0) - u);
          cut++;
        }
        if (cut > 0) world.out.emit(world.tick, EventKind.FormationsDisbanded, n, cut, NaN, NaN);
      }
      // 2. Suppression.
      nc.suppression[n] = restless.has(n) && balance > SUPPRESS_ROOM * income ? SUPPRESS_LEVEL : 0;
      // 3. Build.
      if (!world.rules) return;
      const atWar = world.wars.list.some((w) => w.sides[0].includes(n) || w.sides[1].includes(n));
      const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
      // The orders in training count as army already, and against the balance.
      let upkeep = (army.get(n) ?? 0) + (training.get(n) ?? 0);
      balance -= training.get(n) ?? 0;
      for (let k = pending.get(n) ?? 0; k < slots; k++) {
        if (upkeep >= (atWar ? ARMY_SHARE_WAR : ARMY_SHARE * (PEACE_ARMY_BASE + ((1 - PEACE_ARMY_BASE) * nc.aggression[n]!) / 100)) * income) return;
        let t = pickTemplate(world, n, income, atWar, mix);
        let rule = world.rules.templates[t]!;
        const plain = world.rules.templates[mix.infantry];
        if (plain && rule.gold > plain.gold && nc.gold[n]! < rule.gold + RESERVE_MONTHS * income) {
          t = mix.infantry;
          rule = plain;
        }
        // And one it has not the techs for by the plain division, or the cadre one, which asks for none (PLAN 3.1a).
        for (const next of [mix.infantry, mix.cadre]) {
          if (knowsTechs(world, n, rule.techs)) break;
          const other = world.rules.templates[next];
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
  const g = world.nav?.graph;
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

function pickTemplate(world: World, n: number, income: number, atWar: boolean, mix: BuildMix): number {
  if (income < POOR_INCOME) return mix.cadre;
  if (atWar && armourShareOfEnemies(world, n) >= ARMOUR_HEAVY) return mix.motorised;
  if (atWar && income >= RICH_INCOME && (world.nations.cols.builds[n] ?? 0) % 3 === 2) return mix.panzer;
  return mix.infantry;
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
    if (!world.wars.atWar(n, f.nation[id]!)) return;
    for (const e of idx.get(id) ?? []) {
      all++;
      if (units[ec.unit[e]!]!.cls.startsWith('armor')) tanks++;
    }
  });
  return all > 0 ? tanks / all : 0;
}
