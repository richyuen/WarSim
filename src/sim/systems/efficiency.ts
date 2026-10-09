/**
 * Combat-efficiency modes (SPEC §5.3, PLAN 1.22). Efficiency (CE) multiplies the damage a
 * nation's elements deal. It is re-evaluated at the economic tick (monthly, after the economy):
 *   dynamic      CE = target (default)
 *   progressive  CE moves toward target by PROGRESSIVE_STEP
 *   static       CE = the nation's scenario value (`ceStatic`)
 *   locked       CE = 1 for every nation
 *   random       CE = RANDOM_MIN + (RANDOM_MAX − RANDOM_MIN) × hash(seed, tick, nation)
 * target = (at war ? WAR_CE : PEACE_CE) + WIN_SWING × mean war score (own view)/100
 *          − SUPPLY_PENALTY × (1 − mean formation supply), clamped to [MIN_CE, MAX_CE].
 * A nation locked by God Mode (`ceLocked`) keeps its value in every mode. Cost (every mode, the
 * dynamic formula as in AoC): COST_SHARE × max(0, CE − PEACE_CE)/(WAR_CE − PEACE_CE) × gross
 * income per month, added to the nation's expenses.
 */
import { isMonthStart } from '../../shared/calendar';
import { hash32, hashToUnit } from '../core/hash';
import type { World } from '../world';

export const CE_MODES = ['dynamic', 'progressive', 'static', 'locked', 'random'] as const;
export type CeMode = (typeof CE_MODES)[number];

export const PEACE_CE = 0.7;
export const WAR_CE = 1;
export const WIN_SWING = 0.15;
export const SUPPLY_PENALTY = 0.1;
export const MIN_CE = 0.5;
export const MAX_CE = 1.5;
export const PROGRESSIVE_STEP = 0.05;
export const RANDOM_MIN = 0.6;
export const RANDOM_MAX = 1.4;
export const COST_SHARE = 0.2;
const SALT_CE = 0xce01;

/** Scenario (static-mode) CE from a nation's aggression: 0.8 … 1.2. */
export function staticCe(aggression: number): number {
  return 0.8 + aggression / 250;
}

/** The dynamic target CE of nation n (see the module comment). */
export function ceTarget(world: World, n: number): number {
  let wars = 0;
  let score = 0;
  for (const w of world.wars.list) {
    const side = w.sides[0].includes(n) ? 1 : w.sides[1].includes(n) ? -1 : 0;
    if (side === 0) continue;
    wars++;
    score += side * w.score;
  }
  const f = world.formations.cols;
  let men = 0;
  let sup = 0;
  world.formations.forEach((id) => {
    if (f.nation[id] !== n || world.afloat(id)) return; // the army's supply: a fleet's is not the land's (PLAN 4.2b)
    men++;
    sup += f.supply[id]!;
  });
  const meanSupply = men > 0 ? sup / men : 1;
  const t = (wars > 0 ? WAR_CE : PEACE_CE) + (wars > 0 ? (WIN_SWING * score) / wars / 100 : 0) - SUPPLY_PENALTY * (1 - meanSupply);
  return Math.max(MIN_CE, Math.min(MAX_CE, t));
}

export function efficiencySystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  const mode = world.settings.ceMode;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    if (nc.ceLocked[n] !== 1) {
      const e = nc.efficiency[n]!;
      if (mode === 'dynamic') nc.efficiency[n] = ceTarget(world, n);
      else if (mode === 'progressive') {
        const t = ceTarget(world, n);
        nc.efficiency[n] = e < t ? Math.min(t, e + PROGRESSIVE_STEP) : Math.max(t, e - PROGRESSIVE_STEP);
      } else if (mode === 'static') nc.efficiency[n] = nc.ceStatic[n]!;
      else if (mode === 'locked') nc.efficiency[n] = 1;
      else nc.efficiency[n] = RANDOM_MIN + (RANDOM_MAX - RANDOM_MIN) * hashToUnit(hash32(world.seed, world.tick, n, SALT_CE));
    }
    const cost = (COST_SHARE * Math.max(0, nc.efficiency[n]! - PEACE_CE)) / (WAR_CE - PEACE_CE) * Math.max(0, nc.income[n]!);
    nc.gold[n] = nc.gold[n]! - cost;
    nc.expenses[n] = nc.expenses[n]! + cost;
  });
}
