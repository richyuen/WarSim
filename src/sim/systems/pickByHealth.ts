import { hash32, hashToUnit } from '../core/hash';

/** Targets with their running sum of health (strength × hit points), in a fixed order. */
export interface HealthTable {
  cand: number[];
  cum: number[];
  total: number;
}

/**
 * One target of `table`, picked by health with a seeded draw of (seed, tick, shooter, salt): a ship's
 * gun's pick (PLAN 4.3) and an air squadron's on ships (PLAN 7.60, 7.61). 0 for an empty table.
 */
export function pickByHealth(table: HealthTable, seed: number, tick: number, shooter: number, salt: number): number {
  if (table.total <= 0) return 0;
  const u = hashToUnit(hash32(seed, tick, shooter, salt)) * table.total;
  let lo = 0;
  let hi = table.cand.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table.cum[mid]! > u) hi = mid;
    else lo = mid + 1;
  }
  return table.cand[lo]!;
}
