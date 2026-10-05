/**
 * Collapse and revival from cores (SPEC §4, PLAN 1.20).
 *
 * Revival: a dead nation can return at most `revivalsLeft` times (REVIVALS at the start), and
 * never before `revivalAt` (set to death + REVIVAL_COOLDOWN; 0 for nations dead at the start).
 * It returns on provinces where it holds a core (core or claim) through a revolt (the revolt
 * area goes to the eligible dead claimant with the lowest id instead of a new rebel nation),
 * through a collapse of the holder, or by God Mode (`reviveNation`: all its core provinces).
 *
 * Collapse: a nation bankrupt for COLLAPSE_MONTHS consecutive months (counted monthly), or by
 * God Mode (`collapseNation`), fragments: its puppets go free; each province it holds with an
 * eligible dead claimant goes to that nation (one revival per claimant); held provinces with
 * unrest ≥ REVOLT_FROM revolt (one rebel nation per connected group). `NationCollapsed` event.
 *
 * Capital loss without cores (AoC's death rule, deferred in ADR-28): a nation that loses its
 * capital while holding no province it has a core on dies; the capturer annexes what it held.
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { navOf, type World } from '../world';
import { releasePuppet } from './puppets';
import { REGION_MAX, REVOLT_FROM, spawnRebels } from './revolts';
import { eliminateNation } from './capitals';

export const REVIVALS = 2;
export const REVIVAL_COOLDOWN = 24 * 730;
export const COLLAPSE_MONTHS = 6;

/** Whether dead nation n may revive now. */
export function canRevive(world: World, n: number): boolean {
  const nc = world.nations.cols;
  return world.nations.has(n) && nc.living[n] === 0 && nc.revivalsLeft[n]! > 0 && world.tick >= nc.revivalAt[n]!;
}

/** The eligible dead claimant of province p (lowest id), or 0. */
export function deadClaimant(world: World, p: number): number {
  let best = 0;
  for (const n of world.provinces.coresOf(p)) if (canRevive(world, n) && (best === 0 || n < best)) best = n;
  return best;
}

/** Brings dead nation n back on `area` (province ids, taken from their holders). */
export function reviveNation(world: World, n: number, area: number[]): boolean {
  if (!canRevive(world, n) || area.length === 0) return false;
  const g = navOf(world).graph;
  // Group by holder (each holder loses its share); the revived nation is created once.
  const byHolder = new Map<number, number[]>();
  for (const p of area) {
    const c = g.centre[p] ?? -1;
    const h = c >= 0 ? world.cells.owner[c]! : 0;
    if (h === 0 || h === n) continue;
    const l = byHolder.get(h) ?? [];
    l.push(p);
    byHolder.set(h, l);
  }
  if (byHolder.size === 0) return false;
  world.nations.cols.revivalsLeft[n] = world.nations.cols.revivalsLeft[n]! - 1;
  for (const [h, ps] of [...byHolder].sort((a, b) => a[0] - b[0])) spawnRebels(world, ps, h, n);
  const nc = world.nations.cols; // after the rebels: see `Table.create` (PLAN 2.12)
  world.out.emit(world.tick, EventKind.NationRevived, n, nc.revivalsLeft[n]!, nc.capitalX[n]!, nc.capitalY[n]!);
  return true;
}

/** God Mode revival: all provinces where n has a core and someone else holds the land. */
export function reviveOnCores(world: World, n: number): boolean {
  return reviveNation(world, n, world.provinces.provincesOf(n));
}

/**
 * Fragments nation c (see the module comment). `forced` (God Mode Kill, PLAN 1.32): every
 * province it holds goes, calm or not: claimants revive, the rest splits into rebel nations of at
 * most REGION_MAX connected provinces, and c dies.
 */
export function collapseNation(world: World, c: number, forced = false): void {
  // Taken anew after every revival and every founding below: a new nation's row may move the
  // table to new arrays (PLAN 2.12).
  let nc = world.nations.cols;
  if (!world.nations.has(c) || nc.living[c] !== 1) return;
  // A collapse is a default: debts are void afterwards (PLAN 1.24 review: without it a broke
  // nation re-collapsed every COLLAPSE_MONTHS forever).
  nc.gold[c] = Math.max(0, nc.gold[c]!);
  nc.bankrupt[c] = 0;
  nc.brokeMonths[c] = 0;
  const pv = world.provinces;
  const g = navOf(world).graph;
  const held: number[] = [];
  for (let p = 1; p < pv.count; p++) {
    const cell = g.centre[p] ?? -1;
    if (cell >= 0 && world.cells.owner[cell] === c) held.push(p);
  }
  // Nothing to fragment (no puppets, dead claimants or restless provinces): the default alone.
  let puppets = false;
  world.nations.forEach((p) => {
    if (nc.overlord[p] === c && nc.living[p] === 1) puppets = true;
  });
  if (!forced && !puppets && !held.some((p) => deadClaimant(world, p) !== 0 || pv.unrest[p]! >= REVOLT_FROM)) return;
  world.out.emit(world.tick, EventKind.NationCollapsed, c, 0, NaN, NaN);
  world.nations.forEach((p) => {
    if (nc.overlord[p] === c && nc.living[p] === 1) releasePuppet(world, p);
  });
  // 1. Dead claimants revive on their provinces.
  const byClaimant = new Map<number, number[]>();
  for (const p of held) {
    const d = deadClaimant(world, p);
    if (d === 0) continue;
    const l = byClaimant.get(d) ?? [];
    l.push(p);
    byClaimant.set(d, l);
  }
  const taken = new Set<number>();
  for (const [d, ps] of [...byClaimant].sort((a, b) => a[0] - b[0])) {
    if (!forced && nc.living[c] !== 1) break;
    if (reviveNation(world, d, ps)) for (const p of ps) taken.add(p);
    nc = world.nations.cols;
  }
  // 2. Restless provinces revolt, one rebel nation per connected group.
  // Forced: every remaining province, in groups of at most REGION_MAX.
  const restless = new Set(held.filter((p) => !taken.has(p) && (forced || pv.unrest[p]! >= REVOLT_FROM)));
  const groupMax = forced ? REGION_MAX : Infinity;
  let largest = 0;
  let largestCells = 0;
  for (const start of [...restless].sort((a, b) => a - b)) {
    if (!restless.has(start) || (!forced && nc.living[c] !== 1)) continue;
    const group = [start];
    restless.delete(start);
    for (let i = 0; i < group.length && group.length < groupMax; i++) {
      for (const q of g.adj[group[i]!] ?? []) {
        if (!restless.has(q) || group.length >= groupMax) continue;
        restless.delete(q);
        group.push(q);
      }
    }
    const r = spawnRebels(world, group, c);
    nc = world.nations.cols;
    if (nc.cells[r]! > largestCells) {
      largest = r;
      largestCells = nc.cells[r]!;
    }
  }
  if (!forced) return;
  // Cells outside any province (slivers) go to the largest fragment; then c is gone.
  const { owner, controller } = world.cells;
  for (let cell = 0; cell < owner.length; cell++) {
    if (largest !== 0 && owner[cell] === c) {
      world.setOwner(cell, largest);
      if (controller[cell] === c) world.setController(cell, largest);
    }
  }
  eliminateNation(world, c);
}

/** Monthly: bankruptcy streaks and collapse. */
export function collapseSystem(world: World): void {
  if (world.provinces.count === 0 || !isMonthStart(world.startDay, world.tick)) return;
  world.nations.forEach((n) => {
    const nc = world.nations.cols; // anew for each nation: a collapse founds nations (PLAN 2.12)
    if (nc.living[n] !== 1) return;
    nc.brokeMonths[n] = nc.bankrupt[n] === 1 ? nc.brokeMonths[n]! + 1 : 0;
    if (nc.brokeMonths[n]! >= COLLAPSE_MONTHS) {
      nc.brokeMonths[n] = 0;
      collapseNation(world, n);
    }
  });
}

/** Whether nation n holds (owns and controls the centre of) a province it has a core on. */
export function holdsCore(world: World, n: number): boolean {
  const g = navOf(world).graph;
  const pv = world.provinces;
  if (pv.count === 0) return true; // no core model (toy): never applies the death rule
  for (const p of pv.provincesOf(n)) {
    const c = g.centre[p] ?? -1;
    if (c >= 0 && world.cells.owner[c] === n && world.cells.controller[c] === n) return true;
  }
  return false;
}
