/**
 * Economic AI v1 (SPEC §7, PLAN 1.26): budget balance, suppression and the build mix. Monthly,
 * just before the economy charges the month, for every living AI nation:
 *
 * 1. Balance: with B = projected gross − upkeep − admin − CE cost − suppression − tribute (the
 *    month about to be charged), the nation needs B ≥ DEBT_PAYBACK × max(0, −gold) +
 *    MARGIN × income (pay any debt back within a year, keep a margin). While short, it disbands
 *    idle (not engaged) formations, weakest first (lowest id on ties); a disbanded formation
 *    stops its upkeep at once and returns DISBAND_MANPOWER of its men to the pool.
 * 2. Suppression: SUPPRESS_LEVEL while a non-core province it holds has unrest ≥ SUPPRESS_FROM
 *    and the budget has room (B > SUPPRESS_ROOM × income), else 0.
 * 3. Build: at most one order a month, none while one is pending, when army upkeep is below
 *    ARMY_SHARE (peace) / ARMY_SHARE_WAR (war) of income, B stays positive after the new
 *    upkeep, and gold covers the order plus RESERVE_MONTHS of income. Mix: poor nations
 *    (income < POOR_INCOME) raise cadre divisions; against armour-heavy enemies (≥ ARMOUR_HEAVY of
 *    their elements are tanks) motorised divisions (AT and heavy guns); rich nations at war add a
 *    panzer division every third order; infantry divisions otherwise.
 */
import { isMonthStart } from '../../shared/calendar';
import { elementIndex, destroyFormation } from '../systems/elements';
import { monthlyAccounts, UPKEEP_SCALE, type EconomyTables } from '../systems/economy';
import { COST_SHARE, PEACE_CE, WAR_CE } from '../systems/efficiency';
import { TRIBUTE } from '../systems/puppets';
import { SUPPRESSION_COST } from '../systems/revolts';
import { queueFormation } from '../systems/production';
import type { World } from '../world';

export const DEBT_PAYBACK = 1 / 12;
export const MARGIN = 0.05;
export const DISBAND_MANPOWER = 0.5;
export const SUPPRESS_LEVEL = 0.5;
export const SUPPRESS_FROM = 40;
export const SUPPRESS_ROOM = 0.15;
export const ARMY_SHARE = 0.35;
export const ARMY_SHARE_WAR = 0.6;
export const RESERVE_MONTHS = 3;
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
    world.formations.forEach((id) => {
      const n = f.nation[id]!;
      const l = own.get(n) ?? [];
      l.push(id);
      own.set(n, l);
      army.set(n, (army.get(n) ?? 0) + upkeepOf(world, id));
    });
    const pending = new Set<number>();
    world.production.forEach((id) => void pending.add(world.production.cols.nation[id]!));
    const restless = restlessNations(world);
    const acc = monthlyAccounts(world, tables);
    world.nations.forEach((n) => {
      if (nc.living[n] !== 1 || nc.aiOff[n] === 1) return;
      // Projected accounts for the month about to be charged (the AI runs before the economy).
      const income = Math.max(0, acc.gross[n]!);
      const extra =
        (COST_SHARE * Math.max(0, nc.efficiency[n]! - PEACE_CE)) / (WAR_CE - PEACE_CE) * income +
        SUPPRESSION_COST * nc.suppression[n]! * income +
        (nc.overlord[n] !== 0 ? TRIBUTE * (1 - nc.autonomy[n]! / 100) * income : 0);
      let balance = income - acc.expenses[n]! - extra;
      const need = DEBT_PAYBACK * Math.max(0, -nc.gold[n]!) + MARGIN * income;
      // 1. Disband until the books balance.
      if (balance < need) {
        const idle = (own.get(n) ?? []).filter((id) => f.engaged[id] !== 1).sort((a, b) => f.strength[a]! - f.strength[b]! || a - b);
        for (const id of idle) {
          if (balance >= need) break;
          const u = upkeepOf(world, id);
          if (u <= 0) continue;
          nc.manpower[n] = nc.manpower[n]! + DISBAND_MANPOWER * f.strength[id]!;
          destroyFormation(world, id);
          balance += u;
          army.set(n, (army.get(n) ?? 0) - u);
        }
      }
      // 2. Suppression.
      nc.suppression[n] = restless.has(n) && balance > SUPPRESS_ROOM * income ? SUPPRESS_LEVEL : 0;
      // 3. Build.
      if (pending.has(n) || !world.rules) return;
      const atWar = world.wars.list.some((w) => w.sides[0].includes(n) || w.sides[1].includes(n));
      if ((army.get(n) ?? 0) >= (atWar ? ARMY_SHARE_WAR : ARMY_SHARE) * income) return;
      const t = pickTemplate(world, n, income, atWar, mix);
      const rule = world.rules.templates[t]!;
      const newUpkeep = (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0)) || 0;
      if (balance - newUpkeep <= need) return;
      if (nc.gold[n]! < rule.gold + RESERVE_MONTHS * income || nc.manpower[n]! < rule.manpower) return;
      if (queueFormation(world, n, t) !== 0) nc.builds[n] = nc.builds[n]! + 1;
    });
  };
}

/** Nations holding a non-core province with unrest ≥ SUPPRESS_FROM. */
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
    if (o !== 0 && o !== pv.core[p]) out.add(o);
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
