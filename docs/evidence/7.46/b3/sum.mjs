// PLAN 7.46b3: Japan's `gold` months on 4 seeds x 10 years with the chase, b1 and b2
// (`navyRebuild` with its gold trace, b3/run_*), by kind; against the AT's baseline (the chase
// alone, a/after_*) and b2's run (b2/after_*). Usage: node docs/evidence/7.46/b3/sum.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = dirname(fileURLToPath(import.meta.url));
const S = [1307, 3613, 8693, 7019];
const jap = (f) => Object.values(JSON.parse(readFileSync(`${D}/${f}`, 'utf8')).nations).find((x) => x.tag === 'JAP');
console.log('seed | chase alone (AT baseline) | bar (half) | b2 | this run | depleted spells');
for (const s of S) {
  const a = jap(`../a/after_${s}.json`).months.gold;
  const b = jap(`../b2/after_${s}.json`).months.gold;
  const x = jap(`run_${s}.json`);
  console.log(`${s} | ${a} | ${Math.floor(a / 2)} | ${b} | ${x.months.gold} | spells ${x.spells.length}`);
}
const kinds = {};
console.log('\nJapan gold months by kind (<lost|armed>/<peace|navalFoe|landFoe>/<army vs its peacetime share>):');
for (const s of S) {
  const x = jap(`run_${s}.json`);
  for (const [k, v] of Object.entries(x.goldKind)) kinds[k] = (kinds[k] ?? 0) + v;
  console.log(` ${s}`, JSON.stringify(x.goldKind));
}
const tot = Object.values(kinds).reduce((a, b) => a + b, 0);
console.log(' all', tot, Object.entries(kinds).map(([k, v]) => `${k} ${v} (${Math.round((100 * v) / tot)} %)`).join(', '));
console.log('\nper seed: treasury/line, the month\'s refills and other (non-land) orders, army upkeep/peacetime line:');
for (const s of S) {
  const g = jap(`run_${s}.json`).gold;
  const m = (f) => g.reduce((a, r) => a + f(r), 0) / g.length;
  const other = g.filter((r) => r[8] > 0).length;
  const armyOrd = g.filter((r) => r[6] > 0).length;
  console.log(` ${s} treasury/line ${m((r) => r[2] / r[3]).toFixed(2)} | refills/month ${Math.round(m((r) => Math.max(0, r[7])))} | months with a land order ${armyOrd}, a wing order ${other} | army/peace line ${m((r) => r[10] / r[11]).toFixed(2)} (max ${Math.max(...g.map((r) => r[10] / r[11])).toFixed(2)})`);
}
// What a rule within ADR-557 could reach at best: every navalFoe month gone (they would turn partly into warship-in-training months).
console.log('\nupper bound of a rule within ADR-557 (every navalFoe gold month removed):');
for (const s of S) {
  const x = jap(`run_${s}.json`);
  const naval = Object.entries(x.goldKind).filter(([k]) => k.includes('navalFoe')).reduce((a, [, v]) => a + v, 0);
  const a = jap(`../a/after_${s}.json`).months.gold;
  console.log(` ${s}: ${x.months.gold} - ${naval} = ${x.months.gold - naval} (bar ${Math.floor(a / 2)}) ${x.months.gold - naval <= a / 2 ? 'met' : 'missed'}`);
}
