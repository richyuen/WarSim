/**
 * Revolts v1 (SPEC §4, PLAN 1.19): province unrest, suppression spending, rebel nation spawn.
 *
 * A province's holder is the owner of its representative (centre) cell; it is occupied when
 * that cell's controller differs. Monthly (00:00 of day 1), for every province with a living
 * holder, in id order:
 *   unrest += NON_CORE (holder ≠ core) + OCCUPIED (occupied) + AT_WAR (holder at war, non-core
 *             only) + BANKRUPT (holder bankrupt, non-core only) − DECAY − SUPPRESS × suppression,
 *             clamped
 * A province held and controlled by its owner with unrest ≥ REVOLT_FROM revolts with
 *   p = MAX_P × (unrest − REVOLT_FROM)/(100 − REVOLT_FROM) × (1 − SUPPRESS_P × suppression)
 * drawn with hash32(seed, tick, province). Suppression (0..1 per nation, `setSuppression`)
 * costs SUPPRESSION_COST × suppression × gross income per month.
 *
 * A revolt takes the province (mode 'province') or, in mode 'region', also the neighbouring
 * provinces with the same holder and core whose unrest ≥ REGION_JOIN (breadth-first, up to
 * REGION_MAX provinces). A new rebel nation receives the area's land (owner and controller),
 * becomes its core, gets its largest city as capital, MILITIA_PER_CELLS militia divisions
 * (1..MILITIA_MAX) and START_GOLD; with probability 1/2 (hash) the former holder declares war.
 * Unrest in the area resets to AFTER_REVOLT. Event `RevoltSpawned` (a = rebel, b = former holder).
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { hash32, hashToUnit } from '../core/hash';
import { navOf, type World } from '../world';
import { relocateCapital } from './capitals';
import { deadClaimant, reviveNation } from './revival';
import { equipFormation } from './elements';
import { declareWar } from './war';

export const NON_CORE = 4;
export const OCCUPIED = 6;
export const AT_WAR = 2;
export const BANKRUPT = 3;
export const DECAY = 2;
export const SUPPRESS = 5;
export const REVOLT_FROM = 50;
export const MAX_P = 0.5;
export const SUPPRESS_P = 0.7;
export const SUPPRESSION_COST = 0.15;
export const REGION_JOIN = 40;
export const REGION_MAX = 8;
export const AFTER_REVOLT = 10;
export const MILITIA_PER_CELLS = 40;
export const MILITIA_MAX = 4;
/** Start gold of rebels (≈ two years of one militia division's upkeep at 1938 prices). */
export const START_GOLD = 150;
/** Aggression of new rebel nations (strategic AI). */
export const REBEL_AGGRESSION = 40;
const SALT_REVOLT = 0x7e01;
const SALT_WAR = 0x7e02;

/** Sets each province's core to the owner of its centre cell (scenario creation). */
export function initProvinceCores(world: World, claims: readonly { nation: number; adm0?: readonly string[]; adm1?: readonly string[] }[] = [], meta: readonly { id: number; adm0: string; adm1: string }[] = []): void {
  const g = navOf(world).graph;
  let max = 0;
  for (let c = 0; c < world.cells.province.length; c++) if (world.cells.province[c]! > max) max = world.cells.province[c]!;
  world.provinces.resize(max + 1);
  for (let p = 1; p <= max; p++) {
    const c = g.centre[p] ?? -1;
    if (c >= 0) world.provinces.core[p] = world.cells.owner[c]!;
  }
  // Extra cores (scenario `extraCores`: whole countries by admin-0 code, or single provinces).
  for (const cl of claims) {
    const a0 = new Set(cl.adm0 ?? []);
    const a1 = new Set(cl.adm1 ?? []);
    for (const m of meta) if (m.id <= max && (a0.has(m.adm0) || a1.has(m.adm1))) world.provinces.addClaim(m.id, cl.nation);
  }
}

/** Deterministic, reasonably saturated colour for a spawned nation. */
function rebelColor(world: World, id: number): number {
  const h = hash32(world.seed, id, 0xc010);
  const r = 70 + (h & 0x7f);
  const g = 70 + ((h >>> 8) & 0x7f);
  const b = 70 + ((h >>> 16) & 0x7f);
  return (r << 16) | (g << 8) | b;
}

function atWar(world: World, n: number): boolean {
  return world.wars.list.some((w) => w.sides[0].includes(n) || w.sides[1].includes(n));
}

export function revoltSystem(world: World): void {
  const pv = world.provinces;
  if (pv.count === 0 || !isMonthStart(world.startDay, world.tick)) return;
  const g = navOf(world).graph;
  const nc = world.nations.cols;
  const { owner, controller } = world.cells;
  // Suppression costs.
  world.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.suppression[n]! > 0) nc.gold[n] = nc.gold[n]! - SUPPRESSION_COST * nc.suppression[n]! * Math.max(0, nc.income[n]!);
  });
  pv.version++; // unrest is updated below
  const revolted = new Uint8Array(pv.count);
  for (let p = 1; p < pv.count; p++) {
    const c = g.centre[p] ?? -1;
    if (c < 0) continue;
    const o = owner[c]!;
    if (o === 0 || nc.living[o] !== 1) continue;
    const supp = nc.suppression[o]!;
    const occupied = controller[c] !== o;
    // Core land stays loyal through war and bankruptcy; only non-core land feels them (PLAN 1.24
    // review: a bankrupt empire at war otherwise revolted everywhere at once).
    const nonCore = o !== pv.core[p];
    const delta = (nonCore ? NON_CORE : 0) + (occupied ? OCCUPIED : 0) + (nonCore && atWar(world, o) ? AT_WAR : 0) + (nonCore && nc.bankrupt[o] === 1 ? BANKRUPT : 0) - DECAY - SUPPRESS * supp + 10 * (world.buffs.sum('unrest', 'nation', o) + world.buffs.sum('unrest', 'province', p));
    pv.unrest[p] = Math.max(0, Math.min(100, pv.unrest[p]! + delta));
    if (revolted[p] || occupied || pv.unrest[p]! < REVOLT_FROM) continue;
    const chance = (MAX_P * (pv.unrest[p]! - REVOLT_FROM)) / (100 - REVOLT_FROM) * (1 - SUPPRESS_P * supp);
    if (hashToUnit(hash32(world.seed, world.tick, p, SALT_REVOLT)) >= chance) continue;
    const area = revoltArea(world, p, o);
    for (const q of area) revolted[q] = 1;
    // A dead nation with a core here returns instead of new rebels (PLAN 1.20), if it may.
    const claimant = deadClaimant(world, p);
    if (claimant === 0 || !reviveNation(world, claimant, area)) spawnRebels(world, area, o);
  }
}

/** The revolting provinces: p alone, or its restless region (setting `revoltMode`). */
function revoltArea(world: World, p: number, holder: number): number[] {
  if (world.settings.revoltMode !== 'region') return [p];
  const g = navOf(world).graph;
  const pv = world.provinces;
  const { owner } = world.cells;
  const area = [p];
  const seen = new Set([p]);
  for (let i = 0; i < area.length && area.length < REGION_MAX; i++) {
    for (const q of g.adj[area[i]!] ?? []) {
      if (seen.has(q) || q >= pv.count || area.length >= REGION_MAX) continue;
      seen.add(q);
      const c = g.centre[q] ?? -1;
      if (c >= 0 && owner[c] === holder && pv.core[q] === pv.core[p] && pv.unrest[q]! >= REGION_JOIN) area.push(q);
    }
  }
  return area;
}

/**
 * Creates the rebel nation on `area` (province ids) and returns its id; with `revive`, that dead
 * nation returns instead (PLAN 1.20, called by `reviveNation`).
 */
export function spawnRebels(world: World, area: number[], holder: number, revive = 0): number {
  const nt = world.nations;
  const nc = nt.cols;
  let id = revive;
  if (id === 0) {
    id = nt.create();
    nc.color[id] = rebelColor(world, id);
    nc.incomeMult[id] = 1;
    nc.manpowerMult[id] = 1;
    nc.origin[id] = area[0]!;
    nc.aggression[id] = REBEL_AGGRESSION;
  }
  nc.living[id] = 1;
  nc.bankrupt[id] = 0;
  nc.gold[id] = Math.max(nc.gold[id]!, START_GOLD);
  const inArea = new Set(area);
  const { owner, province, w } = world.cells;
  let cells = 0;
  let sx = 0;
  let sy = 0;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] !== holder || !inArea.has(province[c]!)) continue;
    world.setOwner(c, id);
    world.setController(c, id);
    cells++;
    sx += (c % w) + 0.5;
    sy += Math.floor(c / w) + 0.5;
  }
  nc.cells[id] = cells;
  for (const q of area) {
    world.provinces.core[q] = id;
    world.provinces.unrest[q] = AFTER_REVOLT;
  }
  // Capital: the largest city of the area (lowest id on ties), else the area's centroid. If the
  // holder's own capital lies in the area, the rebels take it and the holder relocates.
  const cc = world.cities.cols;
  let best = 0;
  let holderLostCapital = false;
  world.cities.forEach((ci) => {
    if (owner[cc.cell[ci]!] !== id) return;
    if (cc.capitalOf[ci] === holder) {
      cc.capitalOf[ci] = 0;
      holderLostCapital = true;
    }
    if (cc.capitalOf[ci] !== 0) return; // another nation's capital flag is never taken
    if (best === 0 || cc.size[ci]! > cc.size[best]!) best = ci;
  });
  if (holderLostCapital) relocateCapital(world, holder);
  if (best !== 0) {
    cc.capitalOf[best] = id;
    nc.capitalX[id] = cc.x[best]!;
    nc.capitalY[id] = cc.y[best]!;
  } else {
    nc.capitalX[id] = cells > 0 ? sx / cells : 0;
    nc.capitalY[id] = cells > 0 ? sy / cells : 0;
  }
  // Militia.
  if (world.rules) {
    const militia = Math.max(1, Math.min(MILITIA_MAX, Math.round(cells / MILITIA_PER_CELLS)));
    for (let k = 0; k < militia; k++) {
      const f = world.formations.create();
      const fc = world.formations.cols;
      fc.nation[f] = id;
      fc.x[f] = nc.capitalX[id]!;
      fc.y[f] = nc.capitalY[id]!;
      fc.supply[f] = 1;
      equipFormation(world, f, 0); // template 0 = infantry_div (militia)
    }
  }
  world.out.emit(world.tick, EventKind.RevoltSpawned, id, holder, nc.capitalX[id]!, nc.capitalY[id]!);
  if (hashToUnit(hash32(world.seed, world.tick, id, SALT_WAR)) < 0.5) declareWar(world, holder, id);
  return id;
}
