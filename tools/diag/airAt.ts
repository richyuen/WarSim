/**
 * PLAN 7.26j: the 7.26 AT of ADR-519 judged from per-year rows. Reads `airWar.ts`'s files
 * (`aloft`, `airBattles`, `warDays`, the share's columns) or the critic's headless files
 * (`meanSortiesAloft`, `ev.AirBattle`, `wars` at the year's end), so the code before and after is
 * judged alike.
 *
 * The AT (ADR-519), each on 8 of 10 seeds:
 * - (a) the share: in every war-year, of the wings of nations at war with an enemy land formation
 *   in range, half or more hold a mission. A day's mean over the year: `enemyNearTasked ÷
 *   enemyNear` of `airWar.ts`'s rows from 7.26i; on older files (7.26g's) the old
 *   `mission ÷ (mission + inRange)`, which ADR-519 read. A war-year with no wing in range on any
 *   day has no share and is not judged by (a). Patrols over home (`homePatrol`) are never in it.
 * - (b) the floor: in every war-year, mean sorties aloft 3 or more.
 * A war-year: one that had a day ending with a war running (`warDays` > 0); in a critic file, a war
 * running at the year's end (the only count it has). Year 1 is one.
 *
 * The old share is printed beside it on every file, the before and after on one ruler.
 *
 * Reported, not judged (ADR-519): each war-year's aloft against year 1 (the old AT's half: the
 * war-years under it are counted), and the air battles of years 21–30 against years 1–10.
 *
 * Usage: npx tsx tools/diag/airAt.ts <file.json>...
 */
import { readFileSync } from 'node:fs';

interface Year {
  year: number;
  aloft: number;
  battles: number;
  war: boolean;
  /** ADR-519's share: from 7.26i's columns, else the old one; null with no wing in range. */
  share: number | null;
  /** True when `share` is the old `mission ÷ (mission + inRange)` (files before 7.26i). */
  oldShare: boolean;
  /** The old share on every `airWar.ts` file, for the before and after on one ruler. */
  old: number | null;
}

const SHARE = 0.5;
const FLOOR = 3;
const SEEDS_NEEDED = 0.8;

const ratio = (a: unknown, b: unknown): number | null => (typeof a === 'number' && typeof b === 'number' && b > 0 ? a / b : null);

const read = (file: string): { seed: number; years: Year[] } => {
  const j = JSON.parse(readFileSync(file, 'utf8')) as { seed: number; rows: Record<string, unknown>[] };
  const years = j.rows.map((r): Year => {
    const critic = 'meanSortiesAloft' in r;
    const ev = (r.ev ?? {}) as Record<string, number>;
    const fresh = 'enemyNear' in r;
    return {
      year: r.year as number,
      aloft: (critic ? r.meanSortiesAloft : r.aloft) as number,
      battles: critic ? (ev.AirBattle ?? 0) : (r.airBattles as number),
      war: critic ? (r.wars as number) > 0 : ((r.warDays as number | undefined) ?? (r.wars as number)) > 0,
      share: critic ? null : fresh ? ratio(r.enemyNearTasked, r.enemyNear) : ratio(r.mission, (r.mission as number) + (r.inRange as number)),
      oldShare: !critic && !fresh,
      old: critic ? null : ratio(r.mission, (r.mission as number) + (r.inRange as number)),
    };
  });
  return { seed: j.seed, years };
};

const sum = (ys: Year[], from: number, to: number): number => ys.filter((y) => y.year >= from && y.year <= to).reduce((a, y) => a + y.battles, 0);
const files = process.argv.slice(2);
let passShare = 0;
let passOld = 0;
let passFloor = 0;
let critic = false;
let old = false;
for (const f of files) {
  const { seed, years } = read(f);
  const first = years.find((y) => y.year === 1)!;
  const war = years.filter((y) => y.war);
  const judged = war.filter((y) => y.share !== null);
  critic ||= war.length > 0 && judged.length === 0;
  old ||= years.some((y) => y.oldShare);
  const shareShort = judged.filter((y) => y.share! < SHARE);
  const floorShort = war.filter((y) => y.aloft < FLOOR);
  if (judged.length > 0 && shareShort.length === 0) passShare++;
  if (floorShort.length === 0) passFloor++;
  const olds = war.map((y) => y.old).filter((x): x is number => x !== null);
  if (olds.length > 0 && olds.every((x) => x >= SHARE)) passOld++;
  const lowShare = judged.reduce((m, y) => Math.min(m, y.share!), Infinity);
  const late = war.filter((y) => y.year > 1);
  const lowRatio = late.reduce((m, y) => Math.min(m, y.aloft / first.aloft), Infinity);
  const underHalf = late.filter((y) => y.aloft < first.aloft / 2).length;
  const early = sum(years, 1, 10);
  const lateBattles = sum(years, 21, 30);
  const list = (ys: Year[], v: (y: Year) => number): string => ys.map((y) => `${y.year}:${v(y).toFixed(2)}`).join(' ') || 'none';
  console.log(
    `seed ${seed}: war-years ${war.length}; ` +
      `(a) share ${judged.length ? `lowest ${lowShare.toFixed(2)}, ${judged.length - shareShort.length} of ${judged.length} at half or more` : '-'}` +
      `${war.length > judged.length ? ` (${war.length - judged.length} with no wing in range)` : ''}, short ${list(shareShort, (y) => y.share!)}; ` +
      `old share ${olds.length ? `lowest ${Math.min(...olds).toFixed(2)}, ${olds.filter((x) => x >= SHARE).length} of ${olds.length}` : '-'}; ` +
      `(b) aloft lowest ${Math.min(...war.map((y) => y.aloft)).toFixed(2)}, short ${list(floorShort, (y) => y.aloft)}; ` +
      `year 1 ${first.aloft}, lowest ${(lowRatio === Infinity ? 0 : lowRatio).toFixed(2)} of it, ${underHalf} of ${late.length} under half; ` +
      `air battles 1-10 ${early}, 21-30 ${lateBattles} (${early ? (lateBattles / early).toFixed(2) : '-'})`,
  );
}
const need = Math.ceil(files.length * SEEDS_NEEDED);
console.log(
  `(a) share at half or more in every war-year: ${passShare} of ${files.length}${old ? ' (old share on files before 7.26i)' : ''}${critic ? ' (critic files have no share)' : ''}, ${passOld} of ${files.length} on the old share; ` +
    `(b) aloft ${FLOOR} or more in every war-year: ${passFloor} of ${files.length}; ` +
    `the AT (each on ${need} of ${files.length}): ${passShare >= need && passFloor >= need ? 'pass' : 'short'}`,
);
