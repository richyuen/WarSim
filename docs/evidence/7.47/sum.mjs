// PLAN 7.47: `navyRebuild` on 4 seeds x 10 years with the chase, ADR-574, ADR-575 and 7.47's rule
// (7.47/run_*), against the same without 7.47 (7.46/b3/run_*, the b2 code with the gold trace), the
// chase alone (7.46/a/after_*) and HEAD (7.46/a/before_*). Usage: node docs/evidence/7.47/sum.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = dirname(fileURLToPath(import.meta.url));
const S = [1307, 3613, 8693, 7019];
const R = ['aiOff', 'noShipyard', 'poor', 'warshipInTraining', 'transportInTraining', 'transportWanted', 'navyShare', 'gold', 'men', 'balance', 'spentArmy', 'spentOther', 'ordered'];
const load = (f) => S.map((s) => JSON.parse(readFileSync(`${D}/${f(s)}`, 'utf8')));
const sets = { head: load((s) => `../7.46/a/before_${s}.json`), chase: load((s) => `../7.46/a/after_${s}.json`), b2: load((s) => `../7.46/b3/run_${s}.json`), r47: load((s) => `run_${s}.json`) };
const nat = (j, tag) => Object.values(j.nations).find((x) => x.tag === tag);
const sumKinds = (o, f) => Object.entries(o ?? {}).filter(([k]) => f(k)).reduce((a, [, v]) => a + v, 0);

console.log("AT: Britain's spentArmy months armed/navalFoe, years 1-10 (bar: under 3 on 7019 and 3613)");
for (let i = 0; i < S.length; i++) {
  const b = nat(sets.b2[i], 'ENG'), r = nat(sets.r47[i], 'ENG');
  const bar = S[i] === 7019 || S[i] === 3613 ? (r.spent?.['armed/navalFoe'] ?? 0) < 3 ? ' met' : ' MISSED' : '';
  console.log(` ${S[i]}: ${b.spent?.['armed/navalFoe'] ?? 0} -> ${r.spent?.['armed/navalFoe'] ?? 0}${bar} | all spentArmy ${b.months.spentArmy} -> ${r.months.spentArmy} | by kind ${JSON.stringify(r.spent)}`);
}
console.log("\nRead: Japan's gold months of an armed navy at war with a naval enemy (armed/navalFoe/*), and all gold months");
for (let i = 0; i < S.length; i++) {
  const b = nat(sets.b2[i], 'JAP'), r = nat(sets.r47[i], 'JAP');
  const f = (k) => k.startsWith('armed/navalFoe');
  console.log(` ${S[i]}: ${sumKinds(b.goldKind, f)} -> ${sumKinds(r.goldKind, f)} | all gold ${b.months.gold} -> ${r.months.gold} | by kind ${JSON.stringify(r.goldKind)}`);
}
console.log("\nBritain's and Japan's months, years 1-10, by first stop (b2 -> 7.47):");
for (const tag of ['ENG', 'JAP']) {
  for (let i = 0; i < S.length; i++) {
    const b = nat(sets.b2[i], tag), r = nat(sets.r47[i], tag);
    console.log(` ${tag} ${S[i]}: ${R.filter((k) => b.months[k] || r.months[k]).map((k) => `${k} ${b.months[k]}->${r.months[k]}`).join(', ')}`);
  }
}
const mean = (J, y, k) => J.reduce((a, j) => a + j.rows[y][k], 0) / J.length;
console.log("\nThe world's armed power (a read, ADR-576): year | HEAD k | chase alone | chase+b1+b2 | +7.47 | built b2 -> 7.47 k | lost in battle b2 -> 7.47 k");
for (let y = 0; y < 10; y++) {
  const h = mean(sets.head, y, 'power'), c = mean(sets.chase, y, 'power'), b = mean(sets.b2, y, 'power'), r = mean(sets.r47, y, 'power');
  const pc = (v) => `${(v / 1e3).toFixed(0)} (${((100 * v) / h).toFixed(0)} %)`;
  console.log(`${y + 1} | ${(h / 1e3).toFixed(0)} | ${pc(c)} | ${pc(b)} | ${pc(r)} | ${(mean(sets.b2, y, 'built') / 1e3).toFixed(1)} -> ${(mean(sets.r47, y, 'built') / 1e3).toFixed(1)} | ${(mean(sets.b2, y, 'lostInBattle') / 1e3).toFixed(1)} -> ${(mean(sets.r47, y, 'lostInBattle') / 1e3).toFixed(1)}`);
}
for (const [name, J] of Object.entries({ b2: sets.b2, r47: sets.r47 })) {
  const months = {};
  const w = {};
  for (const j of J) for (const r of j.rows.slice(2, 10)) for (const k of R) { months[k] = (months[k] ?? 0) + r.months[k]; w[k] = (w[k] ?? 0) + r.weighted[k]; }
  const tw = R.reduce((x, k) => x + w[k], 0);
  console.log(`\n${name}, years 3-10, first stop (share of the power-months short):`, R.filter((k) => months[k]).map((k) => `${k} ${months[k]} (${((100 * w[k]) / tw).toFixed(0)} %)`).join(', '));
}
