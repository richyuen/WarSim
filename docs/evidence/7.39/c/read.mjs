// PLAN 7.39c: 7.39's two bars on 10 unseen seeds × 30 years at HEAD `f68f92d` (the chase landed, ADR-580).
// Usage: node docs/evidence/7.39/c/read.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const seeds = [20011, 20021, 20023, 20029, 20047, 20051, 20063, 20071, 20089, 20101];
const f1 = (x) => x.toFixed(1);
let y1 = 0, late = 0, zero = 0, n = 0, l210 = 0, l1130 = 0;
const power = {}, fleets = {}, navies = {}, perSeed = [];
const pairs = { 10: [], 20: [] };
for (const s of seeds) {
  const y = JSON.parse(readFileSync(join(dir, `years_${s}.json`), 'utf8')).rows;
  y1 += y[0].battles;
  let ls = 0;
  for (const r of y.slice(1)) { late += r.battles; zero += r.battles - r.sinking; n++; ls += r.battles; }
  perSeed.push(`${s} ${y[0].battles} / ${f1(ls / (y.length - 1))}`);
  l210 += y.slice(1, 10).reduce((a, r) => a + r.battles, 0) / 9 / seeds.length;
  l1130 += y.slice(10).reduce((a, r) => a + r.battles, 0) / 20 / seeds.length;
  for (const yr of [1, 2, 3, 5, 10, 20, 30]) {
    power[yr] = (power[yr] ?? 0) + y[yr - 1].power / seeds.length;
    fleets[yr] = (fleets[yr] ?? 0) + y[yr - 1].fleets / seeds.length;
    navies[yr] = (navies[yr] ?? 0) + y[yr - 1].navies / seeds.length;
  }
  for (const yr of [10, 20]) pairs[yr].push(y[yr - 1].seaPairs);
}
const year1 = y1 / seeds.length, lateMean = late / n;
console.log('| 10 unseen seeds × 30 years, HEAD `f68f92d` | |');
console.log('| --- | --- |');
console.log(`| sea battles, year 1 (a world) | ${f1(year1)} |`);
console.log(`| **sea battles, years 2–30 (a world-year)** | **${f1(lateMean)}** |`);
console.log(`| a quarter of year 1 (7.39's bar) | ${f1(year1 / 4)} |`);
console.log(`| **late battles sinking nothing (bar 5 %)** | **${f1((100 * zero) / late)} %** |`);
console.log(`| years 2–10 / 11–30 | ${f1(l210)} / ${f1(l1130)} |`);
for (const yr of [1, 2, 3, 5, 10, 20, 30]) console.log(`| armed power (k) / fleets / navies, year ${yr} | ${f1(power[yr] / 1000)} / ${f1(fleets[yr])} / ${f1(navies[yr])} |`);
for (const yr of [10, 20]) console.log(`| year ${yr}: seeds with no pair at war with a fleet each in one basin (day mean 0) | ${pairs[yr].filter((p) => p === 0).length} of ${seeds.length} (day means ${pairs[yr].map(f1).join(', ')}) |`);
console.log('');
console.log('Per seed (seed, year 1 / years 2–30 a year):', perSeed.join('; '));
