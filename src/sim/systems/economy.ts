/**
 * Economy (PLAN 1.9, SPEC §2.5 step 3, ADR-22): a monthly tick at 00:00 of day 1.
 *
 * Cell values (`cells.econ`, $M of industrial output) are fixed at scenario build: each country's
 * industrial capacity (GDP × (GDP per head / US)^INDUSTRY_EXP, from data) is spread over its land
 * cells by `cellWeight` (city by size, plus a small land base). Conquering a city therefore moves
 * a historically sized share of its country's economy.
 *
 * Per nation n each month:
 *   land    = Σ cells.econ over cells n controls; cells it occupies but does not own count
 *             OCCUPIED_SHARE ($M)
 *   gross   = land / 1000 × INCOME_PER_BN × incomeMult × (1 + incomeBonus / 100)
 *   upkeep  = UPKEEP_SCALE × Σ formation upkeep (template gold upkeep × current / full strength)
 *   admin   = ADMIN_BASE × (cells held / 1000) ^ ADMIN_EXP   (superlinear: anti-hegemon)
 *   gold   += gross − upkeep − admin
 *   manpower += MANPOWER_MONTHLY_RATE × manpowerMult × owned population, up to MANPOWER_CAP_SHARE
 *               of it (a pool already above the cap after losing land is kept, not cut)
 * Bankruptcy: gold < −BANKRUPT_MONTHS × gross → bankrupt; each bankrupt month every formation
 * loses DESERTION of its strength. Recovery when gold ≥ 0. Changes emit `Bankruptcy` events.
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { pow } from '../core/dmath';
import type { World } from '../world';
import { bleedFormation } from './elements';

/** `cells.econ` unit: millions of 1990 $ (GDP per year, industrial-weighted). */
export const ECON_PER_BN = 1000;
/** Gold per month per billion of industrial output. */
export const INCOME_PER_BN = 6;
/** Industrial capacity = GDP × (GDP per head / US)^INDUSTRY_EXP. */
export const INDUSTRY_EXP = 0.5;
export const OCCUPIED_SHARE = 0.5;
export const UPKEEP_SCALE = 0.35;
export const ADMIN_BASE = 0.25;
export const ADMIN_EXP = 1.35;
export const BANKRUPT_MONTHS = 3;
/** Manpower (PLAN 1.10): monthly growth and cap as shares of owned, controlled population. */
export const MANPOWER_MONTHLY_RATE = 0.0005;
export const MANPOWER_CAP_SHARE = 0.03;
export const MANPOWER_START_SHARE = 0.01;
export const DESERTION = 0.05;
/** City weight by size 1..5, relative to one plains cell of land at LAND_WEIGHT 1. */
export const CITY_WEIGHT = [0, 1, 2.5, 6, 15, 35] as const;
/** Weight of one plains cell (true area at the equator) relative to a size-1 city. */
export const LAND_WEIGHT = 0.05;

const ECON_WEIGHT = terrainJson.terrain.map((t) => t.econWeight);

/** Relative economic weight of a cell within its country. */
export function cellWeight(terrain: number, areaFactor: number, citySize: number): number {
  return (ECON_WEIGHT[terrain] ?? 0) * areaFactor * LAND_WEIGHT + (CITY_WEIGHT[citySize] ?? 0);
}

/** Industrial capacity (bn) of a country from its GDP (bn) and GDP per head. */
export function industrialCapacity(gdpBn: number, perCapita: number, usPerCapita: number): number {
  return gdpBn * pow(perCapita / usPerCapita, INDUSTRY_EXP);
}

export interface EconomyTables {
  /** Monthly gold upkeep of a full-strength formation, per template index. */
  templateUpkeep: readonly number[];
  /** Full strength (men) per template index. */
  templateStrength: readonly number[];
}

/** Admin cost of holding `cells` cells. */
export function adminCost(cells: number): number {
  return cells <= 0 ? 0 : ADMIN_BASE * pow(cells / 1000, ADMIN_EXP);
}

/** Builds the monthly economy system over the scenario's template tables. */
export function economySystem(tables: EconomyTables) {
  return function economy(world: World): void {
    if (!isMonthStart(world.startDay, world.tick)) return;
    runEconomyMonth(world, tables);
  };
}

/** Gross income and expenses per nation id for the current state (no side effects). */
export function monthlyAccounts(
  world: World,
  tables: EconomyTables,
): { gross: Float64Array; expenses: Float64Array; upkeep: Float64Array; held: Float64Array; population: Float64Array } {
  const nc = world.nations.cols;
  const size = world.nations.highWater;
  const land = new Float64Array(size);
  const held = new Float64Array(size);
  /** People on land the nation both owns and controls (recruitable). */
  const population = new Float64Array(size);
  const { owner, controller, econ, pop } = world.cells;
  for (let c = 0; c < controller.length; c++) {
    const n = controller[c]!;
    if (n === 0) continue;
    held[n]!++;
    const v = econ[c]!;
    const own = owner[c] === n;
    if (v !== 0) land[n]! += own ? v : v * OCCUPIED_SHARE;
    if (own) population[n]! += pop[c]! * 1000;
  }
  const upkeep = new Float64Array(size);
  const fc = world.formations.cols;
  world.formations.forEach((id) => {
    const t = fc.template[id]!;
    const full = tables.templateStrength[t] ?? 0;
    if (full > 0) upkeep[fc.nation[id]!]! += (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0) * fc.strength[id]!) / full;
  });
  const gross = new Float64Array(size);
  const expenses = new Float64Array(size);
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    gross[n] = ((land[n]! / ECON_PER_BN) * INCOME_PER_BN * nc.incomeMult[n]! * (100 + nc.incomeBonus[n]!)) / 100;
    expenses[n] = upkeep[n]! + adminCost(held[n]!);
  });
  return { gross, expenses, upkeep, held, population };
}

/** One economic month (exported for tests and God Mode). */
export function runEconomyMonth(world: World, tables: EconomyTables): void {
  const nc = world.nations.cols;
  const fc = world.formations.cols;
  const { gross, expenses, population } = monthlyAccounts(world, tables);
  const deserting = new Uint8Array(world.nations.highWater);
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    nc.income[n] = gross[n]!;
    nc.expenses[n] = expenses[n]!;
    nc.gold[n] = nc.gold[n]! + gross[n]! - expenses[n]!;
    const cap = MANPOWER_CAP_SHARE * population[n]!;
    nc.manpower[n] = Math.min(Math.max(cap, nc.manpower[n]!), nc.manpower[n]! + MANPOWER_MONTHLY_RATE * nc.manpowerMult[n]! * population[n]!);
    const wasBankrupt = nc.bankrupt[n] === 1;
    if (!wasBankrupt && nc.gold[n]! < -BANKRUPT_MONTHS * gross[n]!) {
      nc.bankrupt[n] = 1;
      world.out.emit(world.tick, EventKind.Bankruptcy, n, 1, NaN, NaN);
    } else if (wasBankrupt && nc.gold[n]! >= 0) {
      nc.bankrupt[n] = 0;
      world.out.emit(world.tick, EventKind.Bankruptcy, n, 0, NaN, NaN);
    }
    if (nc.bankrupt[n] === 1) deserting[n] = 1;
  });
  world.formations.forEach((id) => {
    if (deserting[fc.nation[id]!]) bleedFormation(world, id, DESERTION); // through the elements
  });
}
