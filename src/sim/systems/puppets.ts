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
 *     takes its formations and the puppet ends (`PuppetIntegrated`).
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
import { declareWar } from './war';

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
  const { owner, controller } = world.cells;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === subject) world.setOwner(c, overlord);
    if (controller[c] === subject) world.setController(c, overlord);
  }
  const f = world.formations.cols;
  world.formations.forEach((id) => {
    if (f.nation[id] === subject) f.nation[id] = overlord;
  });
  world.out.emit(world.tick, EventKind.PuppetIntegrated, subject, overlord, NaN, NaN);
  nc.overlord[subject] = 0;
  eliminateNation(world, subject);
}

export function puppetSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  world.nations.forEach((n) => {
    const o = nc.overlord[n]!;
    if (o === 0 || nc.living[n] !== 1) return;
    if (nc.living[o] !== 1) {
      releasePuppet(world, n); // the overlord is gone
      return;
    }
    if (nc.autonomy[n]! > FREE_ABOVE) {
      releasePuppet(world, n);
      return;
    }
    if (nc.loyalty[n]! < REVOLT_LOYALTY && nc.autonomy[n]! >= PROTEST_FROM) {
      releasePuppet(world, n, true);
      declareWar(world, n, o);
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
