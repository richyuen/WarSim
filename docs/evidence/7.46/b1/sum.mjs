// PLAN 7.46b1: `navyRebuild` on 4 seeds x 10 years with the chase and the rule (b1/after_*), against
// HEAD (a/before_*) and the chase alone (a/after_*). Usage: node docs/evidence/7.46/b1/sum.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = dirname(fileURLToPath(import.meta.url)); const S = [1307, 3613, 8693, 7019];
const R = ['aiOff','noShipyard','poor','warshipInTraining','transportInTraining','transportWanted','navyShare','gold','men','balance','spentArmy','spentOther','ordered'];
const load = (f) => S.map((s) => JSON.parse(readFileSync(`${D}/${f(s)}`, 'utf8')));
const sets = { head: load((s) => `../a/before_${s}.json`), chase: load((s) => `../a/after_${s}.json`), b1: load((s) => `after_${s}.json`) };
const mean = (J, y, k) => J.reduce((a, j) => a + j.rows[y][k], 0) / J.length;
console.log('year | HEAD k | chase k (ratio) | chase+b1 k (ratio) | built chase+b1 k');
for (let y = 0; y < 10; y++) {
  const h = mean(sets.head, y, 'power'), c = mean(sets.chase, y, 'power'), b = mean(sets.b1, y, 'power');
  console.log(`${y + 1} | ${(h / 1e3).toFixed(0)} | ${(c / 1e3).toFixed(0)} (${(100 * c / h).toFixed(0)} %) | ${(b / 1e3).toFixed(0)} (${(100 * b / h).toFixed(0)} %) | ${(mean(sets.b1, y, 'built') / 1e3).toFixed(1)}`);
}
for (const [name, J] of Object.entries(sets)) {
  const months = {}; const w = {};
  for (const j of J) for (const r of j.rows.slice(2, 10)) for (const k of R) { months[k] = (months[k] ?? 0) + r.months[k]; w[k] = (w[k] ?? 0) + r.weighted[k]; }
  const tw = R.reduce((x, k) => x + w[k], 0);
  console.log(`\n${name}, years 3-10, first stop:`, R.filter((k) => months[k]).map((k) => `${k} ${months[k]} (${(100 * w[k] / tw).toFixed(0)} %)`).join(', '));
  const by = (tag) => J.map((j) => Object.values(j.nations).find((x) => x.tag === tag));
  for (const tag of ['FRA', 'ENG', 'JAP']) console.log(` ${tag}:`, by(tag).map((x, i) => `${S[i]} ${x ? R.filter((k) => x.months[k]).map((k) => `${k} ${x.months[k]}`).join(' ') : '-'}`).join(' | '));
}
