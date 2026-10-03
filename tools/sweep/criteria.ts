/**
 * SPEC §10 sweep criteria (PLAN 1.40; rewritten 2026-10-03, ADR-54). Land is km² of true area
 * (ADR-52).
 *
 * Limits, per seed; every seed must keep all five:
 *   moving   — land changing controller in the last 5 years ≥ MOVING_MIN of the land
 *              (SPEC leaves the threshold open; 1% ≈ 1.35 M km² ≈ a mid-sized country);
 *   land     — the largest nation holds < 35% of owned land at the end;
 *   income   — the largest income is < 40% of world income at the end;
 *   alive    — living nations stay within [20, 250] every year;
 *   war      — at least one war is active in ≥ 80% of the years.
 *
 * Dynamism, per seed, judged over the sweep (critic B1: the limits passed on a world whose large
 * nations never changed). Both are measured on realms: a nation with no overlord, with the land
 * of its puppets, so an overlord that integrates its colonies has not grown (France alone goes
 * from 3 to 12 M km² that way in every run, and French West Africa from 4.8 to 0):
 *   riser    — some realm that ends with ≥ RISER_MIN_SHARE of the owned land holds
 *              ≥ RISER_GROWTH × the land it held after year 1. A realm that did not exist then
 *              (a revolt, a released puppet) is not a riser: its land shows as someone's loss;
 *   faller   — some realm among the ten largest after year 1 ends with ≤ FALLER_KEPT of the
 *              land it held then (one that is dead, or a puppet by then, counts).
 * A sweep passes them when each holds in ≥ DYNAMISM_QUORUM of its seeds, and only runs of
 * ≥ DYNAMISM_YEARS are judged by them: a 20-year tuning run reports the numbers without a verdict.
 * The quorum replaces "every seed": with a pass rate of 80–90% per seed, ten of ten is an 11–35%
 * event, and three sweeps of 25 minutes ended at 9, 7 and 8 of 10 for one unchanged world.
 *
 * Reported, not judged (the two criteria of 2026-10-03 that riser and faller replace; kept so the
 * reports before ADR-54 stay comparable):
 *   churn    — how many of the ten largest land holders at the end were not among the ten largest
 *              after year 1 (a swap at tenth place counts; a top-ten empire cut in half does not);
 *   swing    — the range of the largest nation's land share over the run (all of Europe west of
 *              the Soviet Union is 4% of the land: redrawing it leaves the leader's share alone).
 */
import type { SeedResult } from './seed';

export const MOVING_MIN = 0.01;
export const MAX_LAND = 0.35;
export const MAX_INCOME = 0.4;
export const ALIVE_MIN = 20;
export const ALIVE_MAX = 250;
export const WAR_YEARS = 0.8;
export const RISER_GROWTH = 1.5;
export const RISER_MIN_SHARE = 0.01;
export const FALLER_KEPT = 2 / 3;
export const DYNAMISM_QUORUM = 0.8;
export const DYNAMISM_YEARS = 50;

/** One realm's land after year 1 (`from`) and at the end (`to`), km²; `nation` is its head. */
export interface LandChange {
  nation: number;
  from: number;
  to: number;
}

export interface Verdict {
  seed: number;
  moving: number;
  topLand: number;
  topIncome: number;
  aliveMin: number;
  aliveMax: number;
  warYears: number;
  /** The material realm that grew most, and the year-1 top-ten realm that kept least (null: none). */
  riser: LandChange | null;
  faller: LandChange | null;
  /** Reported only. */
  churn: number;
  swing: number;
  pass: { moving: boolean; land: boolean; income: boolean; alive: boolean; war: boolean; riser: boolean; faller: boolean };
  /** The five limits. */
  limits: boolean;
  /** Limits, riser and faller. */
  ok: boolean;
}

/** to / from (1 for a realm that held nothing after year 1: callers leave those out). */
export const ratio = (c: LandChange): number => (c.from > 0 ? c.to / c.from : 1);

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
  const start = new Map(r.realmStart);
  const end = new Map(r.realmEnd);
  const owned = r.realmEnd.reduce((a, [, km2]) => a + km2, 0);
  let riser: LandChange | null = null;
  for (const [nation, to] of r.realmEnd) {
    const from = start.get(nation) ?? 0;
    if (from <= 0 || to < RISER_MIN_SHARE * owned) continue;
    const c = { nation, from, to };
    if (!riser || ratio(c) > ratio(riser) || (ratio(c) === ratio(riser) && (c.to > riser.to || (c.to === riser.to && nation < riser.nation)))) riser = c;
  }
  let faller: LandChange | null = null;
  const firstTen = [...r.realmStart].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
  for (const [nation, from] of firstTen) {
    const c = { nation, from, to: end.get(nation) ?? 0 };
    if (c.from <= 0) continue;
    if (!faller || ratio(c) < ratio(faller) || (ratio(c) === ratio(faller) && (c.from > faller.from || (c.from === faller.from && nation < faller.nation)))) faller = c;
  }
  const pass = {
    moving: moving >= MOVING_MIN,
    land: last.topLand < MAX_LAND,
    income: last.topIncome < MAX_INCOME,
    alive: aliveMin >= ALIVE_MIN && aliveMax <= ALIVE_MAX,
    war: warYears >= WAR_YEARS,
    riser: riser !== null && ratio(riser) >= RISER_GROWTH,
    faller: faller !== null && ratio(faller) <= FALLER_KEPT,
  };
  const limits = pass.moving && pass.land && pass.income && pass.alive && pass.war;
  return { seed: r.seed, moving, topLand: last.topLand, topIncome: last.topIncome, aliveMin, aliveMax, warYears, riser, faller, churn, swing, pass, limits, ok: limits && pass.riser && pass.faller };
}

export interface SweepVerdict {
  /** Every seed keeps the five limits. */
  limits: boolean;
  /** Whether the runs are long enough for riser and faller to be judged. */
  judged: boolean;
  /** Seeds with a riser, with a faller, and how many of each the quorum needs. */
  risers: number;
  fallers: number;
  needed: number;
  ok: boolean;
}

/** The sweep's verdict over its seeds' verdicts (runs of `years` years). */
export function judgeSweep(verdicts: readonly Verdict[], years: number): SweepVerdict {
  const limits = verdicts.every((v) => v.limits);
  const judged = years >= DYNAMISM_YEARS;
  const needed = Math.ceil(DYNAMISM_QUORUM * verdicts.length - 1e-9);
  const risers = verdicts.filter((v) => v.pass.riser).length;
  const fallers = verdicts.filter((v) => v.pass.faller).length;
  return { limits, judged, risers, fallers, needed, ok: limits && (!judged || (risers >= needed && fallers >= needed)) };
}
