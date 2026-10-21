// PLAN 7.46c: HEAD `ac0f20e` without the chase (`head/`, seaYears only) against the chase at `ac0f20e` (`.`), the critic's 14 seeds × 30 years.
// Usage: node docs/evidence/7.46/c/head.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const seeds = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437];
const f1 = (x) => x.toFixed(1);
const read = (sub) => {
  let y1 = 0, late = 0, zero = 0, n = 0, l210 = 0, l1130 = 0;
  const power = {}, fleets = {}, navies = {}, perSeed = [];
  for (const s of seeds) {
    const y = JSON.parse(readFileSync(join(dir, sub, `years_${s}.json`), 'utf8')).rows;
    y1 += y[0].battles;
    let ls = 0;
    for (const r of y.slice(1)) { late += r.battles; zero += r.battles - r.sinking; n++; ls += r.battles; }
    perSeed.push(ls / (y.length - 1));
    l210 += y.slice(1, 10).reduce((a, r) => a + r.battles, 0) / 9 / seeds.length;
    l1130 += y.slice(10).reduce((a, r) => a + r.battles, 0) / 20 / seeds.length;
    for (const yr of [1, 2, 3, 5, 10, 20, 30]) {
      power[yr] = (power[yr] ?? 0) + y[yr - 1].power / seeds.length;
      fleets[yr] = (fleets[yr] ?? 0) + y[yr - 1].fleets / seeds.length;
      navies[yr] = (navies[yr] ?? 0) + y[yr - 1].navies / seeds.length;
    }
  }
  return {
    'sea battles, year 1 (a world)': f1(y1 / seeds.length),
    'sea battles, years 2–30 (a world-year)': f1(late / n),
    'years 2–10 / 11–30': `${f1(l210)} / ${f1(l1130)}`,
    'per seed, years 2–30, lowest–highest': `${f1(Math.min(...perSeed))}–${f1(Math.max(...perSeed))}`,
    'late battles sinking nothing': `${f1((100 * zero) / late)} %`,
    ...Object.fromEntries([1, 2, 3, 5, 10, 20, 30].map((yr) => [`armed power (k) / fleets / navies, year ${yr}`, `${f1(power[yr] / 1000)} / ${f1(fleets[yr])} / ${f1(navies[yr])}`])),
  };
};
const a = read('head'), b = read('.');
console.log('| | HEAD `ac0f20e`, no chase | the chase at `ac0f20e` |');
console.log('| --- | --- | --- |');
for (const k of Object.keys(a)) console.log(`| ${k} | ${a[k]} | ${b[k]} |`);
