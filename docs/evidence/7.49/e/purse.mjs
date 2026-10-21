// PLAN 7.49e: the band's half-year gross income and gold against the bar's gap. Usage: node purse.mjs <label>
/* global console, process */
import { readFileSync, existsSync } from 'node:fs';
const L = process.argv[2];
const d = 'docs/evidence/7.49/e';
for (const y of ['y10', 'y20']) {
  let inc = 0, gold = 0, band = 0;
  for (const k of [0, 1, 2, 3]) {
    const f = `${d}/${L}_${y}_${k}.json`;
    if (!existsSync(f)) continue;
    for (const r of JSON.parse(readFileSync(f, 'utf8')).rows) { inc += r.income0; gold += Math.max(0, r.gold0); band++; }
  }
  console.log(`${L} ${y}: band ${band}; gross a month ${inc}, six months ${6 * inc}; gold at the save ${gold}; both ${6 * inc + gold}; divisions at 1,001 ${((6 * inc + gold) / 1001).toFixed(0)}`);
}
