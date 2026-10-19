/**
 * Economy (PLAN 1.9, SPEC §2.5 step 3, ADR-22): a monthly tick at 00:00 of day 1.
 *
 * Cell values (`cells.econ`, $M of industrial output) are fixed at scenario build: each country's
 * industrial capacity (GDP × (GDP per head / US)^INDUSTRY_EXP, from data) is spread over its land
 * cells by `cellWeight` (city by size, plus a small land base). Conquering a city therefore moves
 * a historically sized share of its country's economy.
 *
 * Per nation n each month:
 *   land    = Σ cells.econ × (1 − its bomb damage, PLAN 5.5a) over cells n controls; cells it occupies but does not own count
 *             OCCUPIED_SHARE ($M)
 *   gross   = land / 1000 × INCOME_PER_BN × incomeMult × (1 + incomeBonus / 100) × (1 + income buffs)
 *   upkeep  = UPKEEP_SCALE × Σ formation upkeep (template gold upkeep × current / full strength)
 *   admin   = min(ADMIN_BASE × (km² held / ADMIN_KM2) ^ ADMIN_EXP, ADMIN_CAP_SHARE × gross)
 *             (superlinear: anti-hegemon; capped so barren land cannot bankrupt a nation; land
 *             held is km², not cells: ADR-57)
 *   gold   += gross − upkeep − admin
 *   manpower += MANPOWER_MONTHLY_RATE × manpowerMult × owned population, up to MANPOWER_CAP_SHARE
 *               of it (a pool already above the cap after losing land is kept, not cut)
 * Bankruptcy: gold < −BANKRUPT_MONTHS × gross → bankrupt; each bankrupt month every formation
 * loses DESERTION of its strength. Recovery when gold ≥ 0. Changes emit `Bankruptcy` events.
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { dateOfTick, isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { pow } from '../core/dmath';
import { cellKm2ByRow } from '../landCounts';
import { addConvoyTake, Domain, navOf, seaOf, type AirTally, type World } from '../world';
import type { EconomyBreakdown } from '../../shared/protocol';
import { packConvoyTake, SIDE_SHIPS } from '../../shared/history';
import { bleedFormation } from './elements';
import { convoyLosses, convoyShare, type ConvoyLosses } from './convoys';
import { blocOf } from './supply';
import { BLOCKADE_SHARE, blockadedCells } from './seaControl';
import { FALLOUT_INCOME, falloutAt, WARHEAD_UPKEEP, warheadsOf } from './nuclear';

/** `cells.econ` unit: millions of 1990 $ (GDP per year, industrial-weighted). */
export const ECON_PER_BN = 1000;
/** Gold per month per billion of industrial output. */
export const INCOME_PER_BN = 6;
/** Industrial capacity = GDP × (GDP per head / US)^INDUSTRY_EXP. */
export const INDUSTRY_EXP = 0.5;
export const OCCUPIED_SHARE = 0.5;
export const UPKEEP_SCALE = 0.35;
export const ADMIN_BASE = 0.25;
/**
 * Land per unit of admin cost, km² (ADR-57). Until then the unit was 1,000 cells: this is 1,000
 * cells of the mean area of an owned cell in 1938 (212 km²).
 */
export const ADMIN_KM2 = 212_000;
export const ADMIN_EXP = 1.35;
/** Admin never exceeds this share of gross income (PLAN 1.26: barren land must not bankrupt). */
export const ADMIN_CAP_SHARE = 0.5;
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
  /**
   * The share of a template's upkeep that its tanks take, 0 to 1, per template index: what the
   * AI that is short of money sends home last (PLAN 3.1d).
   */
  templateArmour: readonly number[];
}

/** Admin cost of holding `km2` of land. */
export function adminCost(km2: number): number {
  return km2 <= 0 ? 0 : ADMIN_BASE * pow(km2 / ADMIN_KM2, ADMIN_EXP);
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
  /** km² controlled (whole km² per cell, as every land rule counts it). */
  const held = new Float64Array(size);
  /** People on land the nation both owns and controls (recruitable). */
  const population = new Float64Array(size);
  const { owner, controller, econ, pop, w, h, province } = world.cells;
  const rowKm2 = cellKm2ByRow(w, h);
  // The blockade (PLAN 4.4b): a province whose every port is blockaded pays the share of it.
  const blockade = blockadedCells(world);
  // Convoys (PLAN 4.4d): what the enemy's submarines take of the income of lands joined by sea.
  const convoys = convoyLosses(world);
  const damage = world.bombDamage;
  for (let y = 0, c = 0; y < h; y++) {
    const km2 = rowKm2[y]!;
    for (let x = 0; x < w; x++, c++) {
      const n = controller[c]!;
      if (n === 0) continue;
      held[n]! += km2;
      let v = econ[c]!;
      const own = owner[c] === n;
      if (v !== 0 && blockade && (blockade.provinces.has(province[c]!) || blockade.cells.has(c))) v *= BLOCKADE_SHARE;
      if (v !== 0 && convoys) v *= convoyShare(world, convoys, n, c);
      // Bombs (PLAN 5.5a): what is out of work there until it is repaired.
      if (v !== 0 && damage.size > 0) v *= 1 - (damage.get(c) ?? 0);
      // Fallout (PLAN 6.3b): what it keeps from working.
      if (v !== 0 && world.fallout.size > 0) v *= 1 - FALLOUT_INCOME * falloutAt(world, c);
      if (v !== 0) land[n]! += own ? v : v * OCCUPIED_SHARE;
      if (own) population[n]! += pop[c]! * 1000;
    }
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
    gross[n] = (((land[n]! / ECON_PER_BN) * INCOME_PER_BN * nc.incomeMult[n]! * (100 + nc.incomeBonus[n]!)) / 100) * (1 + world.buffs.sum('income', 'nation', n));
    // A stockpile of warheads is kept (PLAN 6.1b).
    expenses[n] = upkeep[n]! + Math.min(adminCost(held[n]!), ADMIN_CAP_SHARE * gross[n]!) + WARHEAD_UPKEEP * warheadsOf(world, n);
  });
  return { gross, expenses, upkeep, held, population };
}

/** One nation's month in parts (PLAN 7.4f34): `EconomyBreakdown` of `shared/protocol`, the steps of `monthlyAccounts` taken in the same order. */
export function economyBreakdown(world: World, tables: EconomyTables, n: number): EconomyBreakdown {
  const nc = world.nations.cols;
  const { owner, controller, econ, w, h, province } = world.cells;
  const rowKm2 = cellKm2ByRow(w, h);
  const blockade = blockadedCells(world);
  const convoys = convoyLosses(world);
  const damage = world.bombDamage;
  // In $M of output, as `monthlyAccounts` sums it; turned into gold at the end.
  let land = 0;
  let held = 0;
  let own = 0;
  let occ = 0;
  const lost = { blockade: 0, convoys: 0, bombs: 0, fallout: 0 };
  for (let y = 0, c = 0; y < h; y++) {
    const km2 = rowKm2[y]!;
    for (let x = 0; x < w; x++, c++) {
      if (controller[c] !== n) continue;
      held += km2;
      let v = econ[c]!;
      const mine = owner[c] === n;
      const share = mine ? 1 : OCCUPIED_SHARE;
      let was = v;
      if (v !== 0 && blockade && (blockade.provinces.has(province[c]!) || blockade.cells.has(c))) v *= BLOCKADE_SHARE;
      lost.blockade += (was - v) * share;
      was = v;
      if (v !== 0 && convoys) v *= convoyShare(world, convoys, n, c);
      lost.convoys += (was - v) * share;
      was = v;
      if (v !== 0 && damage.size > 0) v *= 1 - (damage.get(c) ?? 0);
      lost.bombs += (was - v) * share;
      was = v;
      if (v !== 0 && world.fallout.size > 0) v *= 1 - FALLOUT_INCOME * falloutAt(world, c);
      lost.fallout += (was - v) * share;
      if (v !== 0) {
        land += mine ? v : v * OCCUPIED_SHARE;
        if (mine) own += v;
        else occ += v * OCCUPIED_SHARE;
      }
    }
  }
  const living = nc.living[n] === 1;
  const gold = (m: number): number => (m / ECON_PER_BN) * INCOME_PER_BN;
  const gross = living ? (((land / ECON_PER_BN) * INCOME_PER_BN * nc.incomeMult[n]! * (100 + nc.incomeBonus[n]!)) / 100) * (1 + world.buffs.sum('income', 'nation', n)) : 0;
  const up = { army: 0, navy: 0, air: 0 };
  const fc = world.formations.cols;
  let upkeep = 0;
  world.formations.forEach((id) => {
    if (fc.nation[id] !== n) return;
    const t = fc.template[id]!;
    const full = tables.templateStrength[t] ?? 0;
    if (full <= 0) return;
    const u = (UPKEEP_SCALE * (tables.templateUpkeep[t] ?? 0) * fc.strength[id]!) / full;
    upkeep += u;
    const d = world.rules?.templates[t]?.domain ?? Domain.land;
    if (d === Domain.sea) up.navy += u;
    else if (d === Domain.air) up.air += u;
    else up.army += u;
  });
  const admin = living ? Math.min(adminCost(held), ADMIN_CAP_SHARE * gross) : 0;
  const warheads = living ? WARHEAD_UPKEEP * warheadsOf(world, n) : 0;
  return {
    ownLand: gold(own),
    occupiedLand: gold(occ),
    blockade: gold(lost.blockade),
    convoys: gold(lost.convoys),
    bombs: gold(lost.bombs),
    fallout: gold(lost.fallout),
    bonuses: gross - gold(land),
    gross,
    ...up,
    admin,
    warheads,
    expenses: living ? upkeep + admin + warheads : 0,
  };
}

/** Rows of the month's air war in the log, of each kind (PLAN 5.11a): its largest, so that the log stays a log of the war's turns. */
export const AIR_ROWS = 3;

/**
 * Rows of a quarter's raids on convoys in the log (PLAN 7.33a, the critic's R9 stats: a row a
 * zone a month was 41 % of a late history, with no figure in it): this many, the largest.
 */
export const CONVOY_ROWS = 3;

/** A nation's raids on a bloc's convoys: the gold they took, and in each zone. */
export interface ConvoyRaid {
  raider: number;
  bloc: number;
  gold: number;
  zones: Map<number, number>;
}

/**
 * What each nation's submarines take of each bloc's convoys this month (PLAN 7.33a), in gold as
 * `economyBreakdown` counts the convoys' line (a cell's $M after the blockade, at the occupied
 * share where it is occupied): each land's cells' loss split among the raiders by `takes`. In the
 * order first met.
 */
export function convoyRaids(world: World, losses: ConvoyLosses | null): ConvoyRaid[] {
  if (!losses) return [];
  const { owner, controller, econ, province } = world.cells;
  const component = navOf(world).grid.component;
  const blockade = blockadedCells(world);
  const sum = new Map<number, ConvoyRaid>();
  const blocs = new Map<number, number>();
  const toGold = INCOME_PER_BN / ECON_PER_BN;
  for (let c = 0; c < econ.length; c++) {
    const n = controller[c]!;
    if (n === 0 || econ[c] === 0) continue;
    let b = blocs.get(n);
    if (b === undefined) blocs.set(n, (b = blocOf(world, n)));
    const taken = losses.takes.get(b)?.get(component[c]!);
    if (!taken) continue;
    let v = econ[c]! * toGold;
    if (blockade && (blockade.provinces.has(province[c]!) || blockade.cells.has(c))) v *= BLOCKADE_SHARE;
    if (owner[c] !== n) v *= OCCUPIED_SHARE;
    for (const t of taken) {
      const key = t.raider * SIDE_SHIPS + b;
      let r = sum.get(key);
      if (!r) sum.set(key, (r = { raider: t.raider, bloc: b, gold: 0, zones: new Map() }));
      r.gold += v * t.share;
      r.zones.set(t.zone, (r.zones.get(t.zone) ?? 0) + v * t.share);
    }
  }
  return [...sum.values()];
}

/**
 * The quarter's raids on convoys in the log (PLAN 7.33a): of each nation on each bloc, the gold
 * taken, at the zone it took most in (the lowest on a tie); those under half a gold left out, the
 * CONVOY_ROWS largest, the least first. Then anew.
 */
export function tellConvoyQuarter(world: World): void {
  const z = seaOf(world);
  const rows = world.convoyQuarter
    .map((t) => {
      let gold = 0;
      let zone = 0;
      let most = -1;
      for (const [zn, g] of t.zones) {
        gold += g;
        if (g > most || (g === most && zn < zone)) [zone, most] = [zn, g];
      }
      return { raider: t.raider, bloc: t.bloc, gold, zone };
    })
    .filter((r) => r.gold >= 0.5)
    .sort((p, q) => p.gold - q.gold || p.raider - q.raider || p.bloc - q.bloc)
    .slice(-CONVOY_ROWS);
  for (const r of rows) {
    const seed = z.seedCell[r.zone]!;
    world.out.emit(world.tick, EventKind.ConvoyRaided, r.raider, packConvoyTake(r.bloc, r.gold), (seed % world.cells.w) + 0.5, Math.floor(seed / world.cells.w) + 0.5);
  }
  world.convoyQuarter = [];
}

/** One economic month (exported for tests and God Mode). */
export function runEconomyMonth(world: World, tables: EconomyTables): void {
  const nc = world.nations.cols;
  const fc = world.formations.cols;
  const { gross, expenses, population } = monthlyAccounts(world, tables);
  // The raids on convoys (PLAN 4.4d), in the log a quarter at a time (PLAN 7.33a): at a quarter's
  // start the last quarter's are told, then the month's are added to the new one's.
  if ((dateOfTick(world.startDay, world.tick).month - 1) % 3 === 0 && world.convoyQuarter.length > 0) tellConvoyQuarter(world);
  for (const r of convoyRaids(world, convoyLosses(world))) for (const [zone, g] of r.zones) addConvoyTake(world, r.raider, r.bloc, zone, g);
  // The month's air war (PLAN 5.11a): rows of the AIR_ROWS largest fights of two nations, by the
  // aircraft lost, then of the AIR_ROWS largest strikes of a nation on another, by what they took;
  // the least first of each (the ticker takes an hour's last). Then anew.
  const size = (t: AirTally): number => (t.fight === 1 ? t.va + t.vb : t.vb);
  const order = (p: AirTally, q: AirTally): number => size(p) - size(q) || p.a - q.a || p.b - q.b;
  const largest = (fight: number): AirTally[] => world.airMonth.filter((r) => r.fight === fight).sort(order).slice(-AIR_ROWS);
  for (const t of largest(1)) world.out.emit(world.tick, EventKind.AirWar, t.a + SIDE_SHIPS * Math.round(t.va), t.b + SIDE_SHIPS * Math.round(t.vb), t.x, t.y);
  for (const t of largest(0)) world.out.emit(world.tick, EventKind.AirRaids, t.a, t.b + SIDE_SHIPS * Math.round(t.vb), t.x, t.y);
  world.airMonth = [];
  const deserting = new Uint8Array(world.nations.highWater);
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    nc.income[n] = gross[n]!;
    nc.expenses[n] = expenses[n]!;
    nc.gold[n] = nc.gold[n]! + gross[n]! - expenses[n]!;
    const cap = MANPOWER_CAP_SHARE * population[n]!;
    nc.manpower[n] = Math.min(Math.max(cap, nc.manpower[n]!), nc.manpower[n]! + MANPOWER_MONTHLY_RATE * nc.manpowerMult[n]! * (1 + world.buffs.sum('manpower', 'nation', n)) * population[n]!);
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
    // Through the elements. A fleet keeps its ships (PLAN 4.2b): the rule counts men.
    if (deserting[fc.nation[id]!] && !world.offLand(id)) bleedFormation(world, id, DESERTION);
  });
}
