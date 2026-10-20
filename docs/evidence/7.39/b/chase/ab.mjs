// PLAN 7.39b: the chase's A/B (4 seeds × 10 years), before (HEAD) and after (`../../b-chase.diff`). Usage: node docs/evidence/7.39/b/chase/ab.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const S = [1307, 3613, 8693, 7019];

console.log('seaWars, per seed, years 2–10 summed:');
for (const s of S) {
  for (const t of ['before', 'after']) {
    const j = read(`wars_${t}_${s}.json`);
    const L = j.rows.slice(1);
    const sum = (k) => L.reduce((a, r) => a + (k(r) || 0), 0);
    console.log(s, t, `y1 ${j.rows[0].battles} late ${sum((r) => r.battles)} zero ${sum((r) => r.zero)} farStation ${sum((r) => r.prey.far)} station ${sum((r) => r.vsNavy.awayStation)} chase ${sum((r) => r.vsNavy.awayChase)} moving ${sum((r) => r.vsNavy.moving)}`);
  }
}
console.log('\nseaYears, mean of 4 seeds: fleets / navies / power (k) / battles, before -> after');
for (let y = 0; y < 10; y++) {
  const m = (t, k) => S.reduce((a, s) => a + read(`years_${t}_${s}.json`).rows[y][k], 0) / 4;
  console.log(y + 1, ['fleets', 'navies', 'power', 'battles'].map((k) => `${k} ${(m('before', k) / (k === 'power' ? 1000 : 1)).toFixed(1)}->${(m('after', k) / (k === 'power' ? 1000 : 1)).toFixed(1)}`).join('  '));
}
console.log('\nseaStart: battles with one side all under way the hour before (the mover) and the other all standing');
for (const t of ['before', 'after']) {
  const B = S.flatMap((s) => read(`start_${t}_${s}.json`).battles);
  for (const [lab, f] of [['y1', (b) => b.year === 1], ['y2-10', (b) => b.year > 1]]) {
    const l = B.filter(f).filter((b) => b.lostA >= 0);
    let less = 0, more = 0, eq = 0, mix = 0, lostM = 0, lostS = 0;
    for (const b of l) {
      const am = b.movedA > 0 && b.stoodA === 0, as = b.stoodA > 0 && b.movedA === 0, bm = b.movedB > 0 && b.stoodB === 0, bs = b.stoodB > 0 && b.movedB === 0;
      let mover, stander;
      if (am && bs) [mover, stander] = [b.lostA, b.lostB];
      else if (bm && as) [mover, stander] = [b.lostB, b.lostA];
      else {
        mix++;
        continue;
      }
      lostM += mover;
      lostS += stander;
      if (mover < stander) less++;
      else if (mover > stander) more++;
      else eq++;
    }
    console.log(t, lab, 'battles', l.length, 'mover lost fewer', less, 'more', more, 'equal', eq, 'mixed', mix, 'ships lost: mover', lostM, 'stander', lostS);
  }
}
