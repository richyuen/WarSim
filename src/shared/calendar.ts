/**
 * Sim calendar (PLAN 1.8, ADR-5): 1 tick = 1 hour of the proleptic Gregorian calendar, counted
 * from the scenario's start date (00:00). Integer arithmetic only, so the sim (monthly economy,
 * day boundaries) and the UI (date display) agree exactly. 1938 has 8760 ticks, 1940 has 8784.
 *
 * Day numbers are days since 1970-01-01 (H. Hinnant's civil-from-days algorithm).
 */

export interface SimDate {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  /** 0..23 */
  hour: number;
}

const div = (a: number, b: number): number => Math.floor(a / b);

/** Days since 1970-01-01 for a proleptic Gregorian date. */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = div(yy, 400);
  const yoe = yy - era * 400;
  const doy = div(153 * (m + (m > 2 ? -3 : 9)) + 2, 5) + d - 1;
  const doe = yoe * 365 + div(yoe, 4) - div(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of daysFromCivil. */
export function civilFromDays(z: number): { year: number; month: number; day: number } {
  const zz = z + 719468;
  const era = div(zz, 146097);
  const doe = zz - era * 146097;
  const yoe = div(doe - div(doe, 1460) + div(doe, 36524) - div(doe, 146096), 365);
  const doy = doe - (365 * yoe + div(yoe, 4) - div(yoe, 100));
  const mp = div(5 * doy + 2, 153);
  const day = doy - div(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Day number of an ISO `YYYY-MM-DD` date. */
export function dayOfIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`bad date ${iso}`);
  return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Ticks (hours) in calendar year `y`. */
export function ticksInYear(y: number): number {
  return (isLeapYear(y) ? 366 : 365) * 24;
}

/** The date and hour at `tick` for a scenario starting on day `startDay`. */
export function dateOfTick(startDay: number, tick: number): SimDate {
  const day = startDay + div(tick, 24);
  return { ...civilFromDays(day), hour: tick - div(tick, 24) * 24 };
}

/** The first tick at or after the start of the given date (negative if before the start). */
export function tickOfDate(startDay: number, y: number, m: number, d: number): number {
  return (daysFromCivil(y, m, d) - startDay) * 24;
}

/** True when `tick` is 00:00 of the first day of a month (monthly systems run here). */
export function isMonthStart(startDay: number, tick: number): boolean {
  if (tick - div(tick, 24) * 24 !== 0) return false;
  return civilFromDays(startDay + div(tick, 24)).day === 1;
}

/** True when `tick` is 00:00 of a day. */
export function isDayStart(tick: number): boolean {
  return tick - div(tick, 24) * 24 === 0;
}
