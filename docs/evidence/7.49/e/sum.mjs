// PLAN 7.49e: sums purse.ts's shards. Usage: node sum.mjs <label>
/* global console, process */
import { readFileSync, existsSync } from 'node:fs';
const L = process.argv[2];
const d = 'docs/evidence/7.49/e';
for (const y of ['y10', 'y20']) {
  const S = { band: 0, before: 0, after: 0, anew: 0, anewF: 0, orders: 0, debt: 0, disb: 0, dead: 0, peace: 0, zero1: 0 };
  for (const k of [0, 1, 2, 3]) {
    const f = `${d}/${L}_${y}_${k}.json`;
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, 'utf8'));
    for (const s of j.sums) { S.band += s.band; S.before += s.before; S.after += s.after; S.anew += s.bandAnew; S.anewF += s.anewFormations; }
    for (const r of j.rows) { S.orders += r.orders; S.debt += r.debtMonths > 0 ? 1 : 0; S.disb += r.disbanded; S.dead += r.alive ? 0 : 1; S.peace += r.alive && !r.atWar ? 1 : 0; S.zero1 += r.formations1 === 0 ? 1 : 0; }
  }
  console.log(`${L} ${y}: band ${S.band}, formations ${S.before} -> ${S.after} (${(S.after / S.band).toFixed(2)} each); orders ${S.orders}; in debt ${S.debt}; disbanded ${S.disb}; dead ${S.dead}; at peace ${S.peace}; none left ${S.zero1}; band anew ${S.anew} / ${S.anewF}`);
}
for (const y of ['y10', 'y20']) {
  const G = {};
  for (const k of [0, 1, 2, 3]) {
    const f = `${d}/${L}_${y}_${k}.json`;
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, 'utf8'));
    for (const [g, c] of Object.entries(j.gates ?? {})) G[g] = (G[g] ?? 0) + c;
  }
  console.log(`${L} ${y} gates (band-months):`, JSON.stringify(G));
}
