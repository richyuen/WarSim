// PLAN 7.49c: nations at war with 3 land formations or fewer stopped at the month start by the
// warship's saving at war with a naval enemy ("ship(navalFoe)") and ordering nothing, on the 48
// saves (armyGates.ts). Usage: node docs/evidence/7.49/c/sum.mjs <before|after>
/* global console, process */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] ?? 'before';
for (const y of [10, 20]) {
  const rows = JSON.parse(readFileSync(`${D}/gates_y${y}_${which}.json`, 'utf8'));
  // The old rule's gate (`was`, when the tool reports it) or the code's.
  const g = (r) => r.was ?? r.gate;
  const few = rows.filter((r) => r.formations <= 3);
  const stopped = few.filter((r) => g(r) === 'ship(navalFoe)');
  const none = stopped.filter((r) => r.ordered === 0);
  const nowGate = {};
  for (const r of stopped) nowGate[r.gate] = (nowGate[r.gate] ?? 0) + 1;
  const all = rows.filter((r) => r.gate === 'ship(navalFoe)').length;
  const fewOrdered = few.reduce((a, r) => a + r.ordered, 0);
  console.log(`year ${y} (${which}): at war ${rows.length}; with <=3 formations ${few.length}, ordered ${fewOrdered}; of them in the navalFoe case ${stopped.length}, no order ${none.length}; gates now ${JSON.stringify(nowGate)}; code's ship(navalFoe) gate, any army: ${all}`);
  for (const r of stopped) console.log(`  ${r.seed} ${r.n}: formations ${r.formations}, gold ${r.gold}, income ${r.income}, gate ${r.gate}, ordered ${r.ordered}`);
}
