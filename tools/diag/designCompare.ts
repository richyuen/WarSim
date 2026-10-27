/**
 * PLAN 7.146: two or more arms of `designBars.ts` runs on the same seeds, side by side. Per arm, the
 * mean over seeds of: engaged land formations a day per war with a front of 100 cells or more
 * (`fronts[3].per`) in year 1 and in years 2–N; the land changing hands each year (its least year, %
 * of the land cells) and the cells taken in front battles (least year); the longest runs of the five
 * largest in order and of the five strongest; the largest nation's share at the last year. Per seed,
 * the late figure's ratio to the first arm's.
 *
 * Usage: npx tsx tools/diag/designCompare.ts <dir> <arm,arm,...> <seed,seed,...>
 *   (files `<dir>/r<arm>_<seed>.json`)
 */
import { existsSync, readFileSync } from 'node:fs';

const [dir, armsS, seedsS] = process.argv.slice(2);
const arms = armsS!.split(',');
const seeds = seedsS!.split(',').map(Number);
const LAND = 627843;
type Row = { year: number; net: number; battle: number; fronts: { min: number; wars: number; per: number }[]; area5: string[]; strong5: string[] };
type Run = { rows: Row[]; summary: Record<string, unknown> };
const longest = (rows: Row[], f: (r: Row) => string): number => {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const r of rows) {
    const k = f(r);
    run = k === prev ? run + 1 : 1;
    prev = k;
    best = Math.max(best, run);
  }
  return best;
};
const base = new Map<number, number>();
for (const arm of arms) {
  const per: { seed: number; y1: number; late: number; minNet: number; minBattle: number; area: number; strong: number; top: number }[] = [];
  for (const seed of seeds) {
    const p = `${dir}/r${arm}_${seed}.json`;
    if (!existsSync(p)) continue;
    const j = JSON.parse(readFileSync(p, 'utf8')) as Run;
    const rows = j.rows;
    const late = rows.slice(1);
    const s = j.summary as { largestPctLast: number };
    per.push({
      seed,
      y1: rows[0]!.fronts[3]!.per,
      late: late.reduce((t, r) => t + r.fronts[3]!.per, 0) / Math.max(1, late.length),
      minNet: Math.min(...late.map((r) => r.net)) / LAND,
      minBattle: Math.min(...late.map((r) => r.battle)),
      area: longest(rows, (r) => r.area5.join(',')),
      strong: longest(rows, (r) => [...r.strong5].sort().join(',')),
      top: s.largestPctLast / 100,
    });
  }
  const mean = (f: (x: (typeof per)[number]) => number): number => per.reduce((t, x) => t + f(x), 0) / Math.max(1, per.length);
  if (arm === arms[0]) for (const x of per) base.set(x.seed, x.late);
  console.log(
    `arm ${arm} (${per.length} seeds): late ${mean((x) => x.late).toFixed(3)}  y1 ${mean((x) => x.y1).toFixed(2)}  least net ${(100 * Math.min(...per.map((x) => x.minNet))).toFixed(2)}%  least battle ${Math.min(...per.map((x) => x.minBattle))}  area run max ${Math.max(...per.map((x) => x.area))}  strong run >12 ${per.filter((x) => x.strong > 12).length}  top>1/3 ${per.filter((x) => x.top > 1 / 3).length}`,
  );
  console.log(`   per seed late (÷ arm ${arms[0]}): ${per.map((x) => `${x.seed} ${x.late.toFixed(2)} (${(x.late / (base.get(x.seed) ?? NaN)).toFixed(2)})`).join(', ')}`);
  console.log(`   per seed y1: ${per.map((x) => `${x.seed} ${x.y1.toFixed(1)}`).join(', ')}`);
}
