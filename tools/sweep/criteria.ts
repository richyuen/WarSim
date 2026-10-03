/**
 * SPEC §10 sweep criteria (PLAN 1.40), per seed:
 *   moving   — land changing controller in the last 5 years ≥ MOVING_MIN of the land
 *              (SPEC leaves the threshold open; 1% ≈ 1.35 M km² ≈ a mid-sized country);
 *   land     — the largest nation holds < 35% of owned land at the end;
 *   income   — the largest income is < 40% of world income at the end;
 *   alive    — living nations stay within [20, 250] every year;
 *   war      — at least one war is active in ≥ 80% of the years;
 *   churn    — at least CHURN_MIN of the ten largest land holders at the end were not among the
 *              ten largest after year 1;
 *   swing    — the largest nation's land share ranges over ≥ LEADER_SWING during the run.
 * Churn and swing answer critic B1 (2026-10-03): the first five criteria passed on a world whose
 * ten largest nations never changed. Both thresholds were fixed before the first run with them.
 * Land is measured in km², not in cells, in all four land criteria (ADR-52, 2026-10-03): the map
 * is a Miller projection and a count of cells weighs Siberia and Greenland at twice their land
 * or more. The thresholds kept their numbers.
 */
import type { SeedResult } from './seed';

export const MOVING_MIN = 0.01;
export const MAX_LAND = 0.35;
export const MAX_INCOME = 0.4;
export const ALIVE_MIN = 20;
export const ALIVE_MAX = 250;
export const WAR_YEARS = 0.8;
export const CHURN_MIN = 2;
export const LEADER_SWING = 0.03;

export interface Verdict {
  seed: number;
  moving: number;
  topLand: number;
  topIncome: number;
  aliveMin: number;
  aliveMax: number;
  warYears: number;
  churn: number;
  swing: number;
  pass: { moving: boolean; land: boolean; income: boolean; alive: boolean; war: boolean; churn: boolean; swing: boolean };
  ok: boolean;
}

export function judge(r: SeedResult): Verdict {
  const s = r.samples;
  const last = s.at(-1)!;
  const moving = s.slice(-5).reduce((a, y) => a + y.changedKm2, 0) / r.landKm2;
  const aliveMin = Math.min(...s.map((y) => y.alive));
  const aliveMax = Math.max(...s.map((y) => y.alive));
  const warYears = s.filter((y) => y.warDays > 0).length / s.length;
  const first = new Set(s[0]!.top10);
  const churn = last.top10.filter((n) => !first.has(n)).length;
  const swing = Math.max(...s.map((y) => y.topLand)) - Math.min(...s.map((y) => y.topLand));
  const pass = {
    moving: moving >= MOVING_MIN,
    land: last.topLand < MAX_LAND,
    income: last.topIncome < MAX_INCOME,
    alive: aliveMin >= ALIVE_MIN && aliveMax <= ALIVE_MAX,
    war: warYears >= WAR_YEARS,
    churn: churn >= CHURN_MIN,
    swing: swing >= LEADER_SWING,
  };
  return { seed: r.seed, moving, topLand: last.topLand, topIncome: last.topIncome, aliveMin, aliveMax, warYears, churn, swing, pass, ok: Object.values(pass).every(Boolean) };
}
