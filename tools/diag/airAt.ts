/**
 * PLAN 7.26d: the 7.26 AT judged from per-year rows. Reads `airWar.ts`'s files
 * (`aloft`, `airBattles`, `warDays`) or the critic's headless files (`meanSortiesAloft`,
 * `ev.AirBattle`, `wars` at the year's end), so the code before and after is judged alike.
 *
 * The AT: "in each year with a war, mean sorties aloft at least half of that seed's year 1 on 8
 * of 10 seeds; the air battles of years 21 to 30 counted against years 1 to 10". A year with a
 * war: one that had a day ending with a war running (`warDays` > 0); in a critic file, a war
 * running at the year's end (the only count it has).
 *
 * PLAN 7.26i: ADR-519's share, printed (7.26j judges it): of the wings at war with an enemy land
 * formation in range, those with a mission, a day's mean over the year (`enemyNearTasked ÷
 * enemyNear` of `airWar.ts`'s rows from 7.26i; on older files, and beside it on new ones, the old
 * `mission ÷ (mission + inRange)`). A war-year's share; the seed's lowest and its war-years at a
 * half or more. Patrols over home (`homePatrol`) are never in it.
 *
 * Usage: npx tsx tools/diag/airAt.ts <file.json>...
 */
import { readFileSync } from 'node:fs';

interface Year {
  year: number;
  aloft: number;
  battles: number;
  war: boolean;
  /** ADR-519's share (from 7.26i's columns), null on older files. */
  share: number | null;
  /** The old share, `mission ÷ (mission + inRange)`; null on critic files. */
  oldShare: number | null;
}

const ratio = (a: unknown, b: unknown): number | null => (typeof a === 'number' && typeof b === 'number' && b > 0 ? a / b : null);

const read = (file: string): { seed: number; years: Year[] } => {
  const j = JSON.parse(readFileSync(file, 'utf8')) as { seed: number; rows: Record<string, unknown>[] };
  const years = j.rows.map((r): Year => {
    const critic = 'meanSortiesAloft' in r;
    const ev = (r.ev ?? {}) as Record<string, number>;
    return {
      year: r.year as number,
      aloft: (critic ? r.meanSortiesAloft : r.aloft) as number,
      battles: critic ? (ev.AirBattle ?? 0) : (r.airBattles as number),
      war: critic ? (r.wars as number) > 0 : ((r.warDays as number | undefined) ?? (r.wars as number)) > 0,
      share: ratio(r.enemyNearTasked, r.enemyNear),
      oldShare: critic ? null : ratio(r.mission, (r.mission as number) + (r.inRange as number)),
    };
  });
  return { seed: j.seed, years };
};

const sum = (ys: Year[], from: number, to: number): number => ys.filter((y) => y.year >= from && y.year <= to).reduce((a, y) => a + y.battles, 0);
let passed = 0;
const files = process.argv.slice(2);
for (const f of files) {
  const { seed, years } = read(f);
  const first = years.find((y) => y.year === 1)!;
  const bar = first.aloft / 2;
  const war = years.filter((y) => y.year > 1 && y.war);
  const short = war.filter((y) => y.aloft < bar);
  const min = war.reduce((m, y) => Math.min(m, y.aloft / first.aloft), Infinity);
  const early = sum(years, 1, 10);
  const late = sum(years, 21, 30);
  if (short.length === 0) passed++;
  const shares = (k: 'share' | 'oldShare'): string => {
    const v = war.map((y) => y[k]).filter((x): x is number => x !== null);
    if (v.length === 0) return '-';
    return `lowest ${Math.min(...v).toFixed(2)}, at half or more ${v.filter((x) => x >= 0.5).length} of ${v.length}`;
  };
  console.log(
    `seed ${seed}: year 1 ${first.aloft}; war years 2+ ${war.length}, at half or more ${war.length - short.length}; ` +
      `lowest ${(min === Infinity ? 0 : min).toFixed(2)} of year 1; short: ${short.map((y) => `${y.year}:${y.aloft}`).join(' ') || 'none'}; ` +
      `air battles 1-10 ${early}, 21-30 ${late} (${early ? (late / early).toFixed(2) : '-'}); ` +
      `share (ADR-519) ${shares('share')}; old share ${shares('oldShare')}; under 3 aloft ${war.filter((y) => y.aloft < 3).length}`,
  );
}
console.log(`seeds passing: ${passed} of ${files.length} (the AT: 8 of 10)`);
