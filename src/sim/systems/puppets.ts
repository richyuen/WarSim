/**
 * Puppets with autonomy (SPEC §3.5, PLAN 1.18). A puppet has an overlord (`nations.overlord`),
 * autonomy 0..100, loyalty 0..100 and integration progress 0..100. Tiers by autonomy:
 * satellite < SATELLITE_BELOW ≤ puppet < VASSAL_FROM ≤ vassal.
 *
 * Monthly (00:00 of day 1), for every living puppet, in nation-id order:
 *  1. Leaves freely when autonomy > FREE_ABOVE (`PuppetReleased`).
 *  2. Revolts when loyalty < REVOLT_LOYALTY and autonomy ≥ PROTEST_FROM: the bond is cut and
 *     it declares a war of independence on its overlord (`PuppetRevolt`).
 *  3. Pays tribute: TRIBUTE × (1 − autonomy/100) × last month's gross income, in gold.
 *  4. Integrates when autonomy < INTEGRATE_BELOW: progress += INTEGRATION_RATE ×
 *     (INTEGRATE_BELOW − autonomy)/INTEGRATE_BELOW; at 100 the overlord annexes all its land,
 *     takes its formations and cores, and the puppet ends (`PuppetIntegrated`).
 *  5. Autonomy drifts up by AUTONOMY_DRIFT (puppets drift toward independence), and loyalty
 *     relaxes by LOYALTY_PULL toward loyaltyTarget: LOYALTY_BASE + LOYALTY_PER_AUTONOMY ×
 *     autonomy (freer subjects are content), minus LOSING_PENALTY while the overlord is losing a
 *     war (its side's score ≤ −LOSING_SCORE). Revolts therefore need a push: a losing overlord,
 *     or God Mode.
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import type { World } from '../world';
import { eliminateNation } from './capitals';
import { declareWar, leaveBondedWars } from './war';

export const SATELLITE_BELOW = 30;
export const VASSAL_FROM = 70;
export const FREE_ABOVE = 90;
export const PROTEST_FROM = 10;
export const REVOLT_LOYALTY = 20;
export const TRIBUTE = 0.25;
export const INTEGRATE_BELOW = 50;
export const INTEGRATION_RATE = 4;
export const AUTONOMY_DRIFT = 0.25;
export const LOYALTY_PULL = 0.2;
export const LOYALTY_BASE = 40;
export const LOYALTY_PER_AUTONOMY = 0.6;
export const LOSING_PENALTY = 25;
export const LOSING_SCORE = 30;

/** Loyalty a puppet relaxes toward (see the module comment). */
export function loyaltyTarget(world: World, puppet: number): number {
  const nc = world.nations.cols;
  const o = nc.overlord[puppet]!;
  let losing = false;
  for (const war of world.wars.list) {
    const side = war.sides[0].includes(o) ? 1 : war.sides[1].includes(o) ? -1 : 0;
    if (side !== 0 && side * war.score <= -LOSING_SCORE) losing = true;
  }
  return LOYALTY_BASE + LOYALTY_PER_AUTONOMY * nc.autonomy[puppet]! - (losing ? LOSING_PENALTY : 0);
}

export type PuppetTier = 'satellite' | 'puppet' | 'vassal';
export function puppetTier(autonomy: number): PuppetTier {
  return autonomy < SATELLITE_BELOW ? 'satellite' : autonomy < VASSAL_FROM ? 'puppet' : 'vassal';
}

/** Makes `subject` a puppet of `overlord` (peace terms, God Mode). Returns false if invalid. */
export function makePuppet(world: World, overlord: number, subject: number, autonomy: number): boolean {
  const nc = world.nations.cols;
  if (overlord === subject || !world.nations.has(overlord) || !world.nations.has(subject)) return false;
  if (nc.living[overlord] !== 1 || nc.living[subject] !== 1 || nc.overlord[overlord] === subject) return false;
  nc.overlord[subject] = overlord;
  nc.autonomy[subject] = Math.max(0, Math.min(100, autonomy));
  nc.loyalty[subject] = LOYALTY_BASE + LOYALTY_PER_AUTONOMY * nc.autonomy[subject]!;
  nc.integration[subject] = 0;
  world.supplyDirty = true;
  world.out.emit(world.tick, EventKind.PuppetCreated, subject, overlord, NaN, NaN);
  // It does not go on fighting its overlord's realm or allies in another war (PLAN 3.8d).
  leaveBondedWars(world, subject);
  return true;
}

/** Frees a puppet (release is free, as in AoC). */
export function releasePuppet(world: World, subject: number, revolt = false): void {
  const nc = world.nations.cols;
  const overlord = nc.overlord[subject]!;
  if (overlord === 0) return;
  nc.overlord[subject] = 0;
  nc.integration[subject] = 0;
  world.supplyDirty = true;
  world.out.emit(world.tick, revolt ? EventKind.PuppetRevolt : EventKind.PuppetReleased, subject, overlord, NaN, NaN);
}

/** The overlord absorbs the puppet: land, formations; the puppet nation ends. */
export function integratePuppet(world: World, subject: number): void {
  const nc = world.nations.cols;
  const overlord = nc.overlord[subject]!;
  if (overlord === 0) return;
  annexInto(world, overlord, subject);
  world.out.emit(world.tick, EventKind.PuppetIntegrated, subject, overlord, NaN, NaN);
  nc.overlord[subject] = 0;
  eliminateNation(world, subject);
}

/**
 * Annexation (PLAN 1.36 editor and God): `annexer` takes `target`'s land, formations and cores;
 * its puppets become the annexer's; the target is eliminated (`NationAnnexed`). A puppet handed
 * over leaves the wars it fights against the annexer, its realm and its allies (PLAN 3.8d2).
 */
export function annexNation(world: World, annexer: number, target: number): boolean {
  const nc = world.nations.cols;
  if (annexer === target || !world.nations.has(annexer) || !world.nations.has(target) || nc.living[annexer] !== 1 || nc.living[target] !== 1) return false;
  annexInto(world, annexer, target);
  const handed: number[] = [];
  world.nations.forEach((p) => {
    if (nc.overlord[p] !== target) return;
    nc.overlord[p] = p === annexer ? 0 : annexer;
    if (p !== annexer) handed.push(p);
  });
  if (nc.overlord[target] !== 0) nc.overlord[target] = 0;
  // The blocs changed with no cell of the puppets changed (PLAN 3.12Rl): their land bore the mark
  // of the target's bloc on, and a loaded save, which refreshes in full, went on otherwise.
  if (handed.length > 0) world.supplyDirty = true;
  world.out.emit(world.tick, EventKind.NationAnnexed, target, annexer, NaN, NaN);
  eliminateNation(world, target);
  // After the target has left its wars: what is left of them is the puppets' own.
  for (const p of handed) if (nc.living[p] === 1) leaveBondedWars(world, p);
  return true;
}

/** Moves `from`'s cells, formations and cores to `to`. */
function annexInto(world: World, to: number, from: number): void {
  const overlord = to;
  const subject = from;
  const { owner, controller } = world.cells;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === subject) world.setOwner(c, overlord);
    if (controller[c] === subject) world.setController(c, overlord);
  }
  const f = world.formations.cols;
  world.formations.forEach((id) => {
    if (f.nation[id] === subject) f.nation[id] = overlord;
  });
  // Integration makes the land rightfully the overlord's: its cores pass on (PLAN 1.24 review:
  // otherwise whole integrated colonies turned non-core and revolted together).
  const pv = world.provinces;
  for (let p = 1; p < pv.count; p++) if (pv.core[p] === subject) pv.core[p] = overlord;
}

export function puppetSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  world.nations.forEach((n) => {
    const o = nc.overlord[n]!;
    if (o === 0 || nc.living[n] !== 1) return;
    if (nc.living[o] !== 1) {
      releasePuppet(world, n); // the overlord is gone: an old save's (a death frees them, ADR-174)
      return;
    }
    if (nc.autonomy[n]! > FREE_ABOVE) {
      releasePuppet(world, n);
      return;
    }
    if (nc.loyalty[n]! < REVOLT_LOYALTY && nc.autonomy[n]! >= PROTEST_FROM) {
      releasePuppet(world, n, true);
      declareWar(world, n, o, true);
      return;
    }
    const tribute = Math.max(0, TRIBUTE * (1 - nc.autonomy[n]! / 100) * nc.income[n]!);
    nc.gold[n] = nc.gold[n]! - tribute;
    nc.gold[o] = nc.gold[o]! + tribute;
    if (nc.autonomy[n]! < INTEGRATE_BELOW) {
      nc.integration[n] = Math.min(100, nc.integration[n]! + (INTEGRATION_RATE * (INTEGRATE_BELOW - nc.autonomy[n]!)) / INTEGRATE_BELOW);
      if (nc.integration[n]! >= 100) {
        integratePuppet(world, n);
        return;
      }
    }
    nc.autonomy[n] = Math.min(100, nc.autonomy[n]! + AUTONOMY_DRIFT);
    nc.loyalty[n] = nc.loyalty[n]! + LOYALTY_PULL * (loyaltyTarget(world, n) - nc.loyalty[n]!);
  });
}
