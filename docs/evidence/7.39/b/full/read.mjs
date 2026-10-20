// PLAN 7.39b: the AT's run of the chase (`../../b-chase.diff`), the critic's 14 seeds × 30 years, against HEAD's (7.39a's run, `../../a/`).
// Usage: node docs/evidence/7.39/b/full/read.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const seeds = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437];
const runs = {
  before: (kind, s) => JSON.parse(readFileSync(join(dir, '..', '..', 'a', `${kind}_${s}.json`), 'utf8')),
  after: (kind, s) => JSON.parse(readFileSync(join(dir, `${kind}_${s}.json`), 'utf8')),
};
const f1 = (x) => x.toFixed(1);
console.log('| | before (HEAD) | after (the chase) |');
console.log('| --- | --- | --- |');
const rows = {};
for (const [t, read] of Object.entries(runs)) {
  let y1 = 0, late = 0, zero = 0, far = 0, station = 0, chase = 0, lateYears = 0;
  const power = {}, navies = {}, fleets = {};
  for (const s of seeds) {
    const w = read('wars', s).rows;
    const y = read('years', s).rows;
    y1 += y[0].battles;
    for (const r of y.slice(1)) {
      late += r.battles;
      zero += r.battles - r.sinking;
      lateYears++;
    }
    for (const r of w.slice(1)) {
      far += r.prey.far ?? 0;
      station += r.vsNavy.awayStation ?? 0;
      chase += r.vsNavy.awayChase ?? 0;
    }
    for (const yr of [1, 2, 5, 10, 20, 30]) {
      power[yr] = (power[yr] ?? 0) + y[yr - 1].power / seeds.length;
      navies[yr] = (navies[yr] ?? 0) + y[yr - 1].navies / seeds.length;
      fleets[yr] = (fleets[yr] ?? 0) + y[yr - 1].fleets / seeds.length;
    }
  }
  rows[t] = {
    'sea battles, year 1 (a world)': f1(y1 / seeds.length),
    'sea battles, years 2–30 (a world-year)': f1(late / lateYears),
    'a quarter of year 1': f1(y1 / seeds.length / 4),
    'late battles sinking nothing': `${f1((100 * zero) / late)} %`,
    'on station, the enemy fleet beyond reach (fleet-weeks a world-year, 2–30)': f1(far / lateYears),
    'on station, all at war with a navy (2–30)': f1(station / lateYears),
    'chasing (2–30)': f1(chase / lateYears),
    ...Object.fromEntries([1, 2, 5, 10, 20, 30].map((yr) => [`armed power (k) / fleets / navies, year ${yr}`, `${f1(power[yr] / 1000)} / ${f1(fleets[yr])} / ${f1(navies[yr])}`])),
  };
}
for (const k of Object.keys(rows.before)) console.log(`| ${k} | ${rows.before[k]} | ${rows.after[k]} |`);
