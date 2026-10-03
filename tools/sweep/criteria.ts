/**
 * SPEC §10 sweep criteria (PLAN 1.40), per seed:
 *   moving   — land cells changing controller in the last 5 years ≥ MOVING_MIN of the land
 *              (SPEC leaves the threshold open; 1% ≈ 1,200 cells ≈ a mid-sized country);
 *   land     — the largest nation holds < 35% of owned land at the end;
 *   income   — the largest income is < 40% of world income at the end;
 *   alive    — living nations stay within [20, 250] every year;
 *   war      — at least one war is active in ≥ 80% of the years.
 */
import type { SeedResult } from './seed';

export const MOVING_MIN = 0.01;
export const MAX_LAND = 0.35;
export const MAX_INCOME = 0.4;
export const ALIVE_MIN = 20;
export const ALIVE_MAX = 250;
export const WAR_YEARS = 0.8;

export interface Verdict {
  seed: number;
  moving: number;
  topLand: number;
  topIncome: number;
  aliveMin: number;
  aliveMax: number;
  warYears: number;
  pass: { moving: boolean; land: boolean; income: boolean; alive: boolean; war: boolean };
  ok: boolean;
}

export function judge(r: SeedResult): Verdict {
  const s = r.samples;
  const last = s.at(-1)!;
  const moving = s.slice(-5).reduce((a, y) => a + y.changed, 0) / r.landCells;
  const aliveMin = Math.min(...s.map((y) => y.alive));
  const aliveMax = Math.max(...s.map((y) => y.alive));
  const warYears = s.filter((y) => y.warDays > 0).length / s.length;
  const pass = {
    moving: moving >= MOVING_MIN,
    land: last.topLand < MAX_LAND,
    income: last.topIncome < MAX_INCOME,
    alive: aliveMin >= ALIVE_MIN && aliveMax <= ALIVE_MAX,
    war: warYears >= WAR_YEARS,
  };
  return { seed: r.seed, moving, topLand: last.topLand, topIncome: last.topIncome, aliveMin, aliveMax, warYears, pass, ok: Object.values(pass).every(Boolean) };
}
