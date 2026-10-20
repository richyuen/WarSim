/**
 * PLAN 7.35d3c: sums `navyLoss`'s `noShipyard` months by why (years 2–30) over the seeds' JSON in a
 * directory, and per nation (tag, over the seeds): its months by why and who held its ports.
 *
 * Usage: npx tsx tools/diag/navyLossYard.ts <dir>
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2]!;
const files = readdirSync(dir).filter((f) => /^loss_\d+\.json$/.test(f));
const why: Record<string, number> = {};
const reasons: Record<string, number> = {};
const byTag = new Map<string, { months: number; yard: Record<string, number>; holders: Record<string, number>; seeds: Set<number> }>();
for (const f of files) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const y of j.rows) {
    if (y.year < 2) continue;
    for (const [k, v] of Object.entries(y.yard as Record<string, number>)) why[k] = (why[k] ?? 0) + v;
    for (const [k, v] of Object.entries(y.months as Record<string, number>)) reasons[k] = (reasons[k] ?? 0) + v;
  }
  // Per nation over all 30 years (the nation's record has no year split).
  for (const x of Object.values(j.nations) as any[]) {
    const n = Object.values(x.yard as Record<string, number>).reduce((a, b) => a + b, 0);
    if (n === 0) continue;
    const t = byTag.get(x.tag) ?? { months: 0, yard: {}, holders: {}, seeds: new Set<number>() };
    t.months += n;
    t.seeds.add(j.seed);
    for (const [k, v] of Object.entries(x.yard as Record<string, number>)) if (v) t.yard[k] = (t.yard[k] ?? 0) + v;
    for (const [k, v] of Object.entries(x.yardHolders as Record<string, number>)) t.holders[k] = (t.holders[k] ?? 0) + v;
    byTag.set(x.tag, t);
  }
}
const all = Object.values(reasons).reduce((a, b) => a + b, 0);
const yard = Object.values(why).reduce((a, b) => a + b, 0);
console.log('files', files.length, '; lost navies months y2-30', all, '; noShipyard', yard, `(${((100 * yard) / all).toFixed(1)} %)`);
console.log('by why y2-30', JSON.stringify(why));
for (const [tag, t] of [...byTag].sort((a, b) => b[1].months - a[1].months).slice(0, 20)) {
  const holders = Object.entries(t.holders).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(tag.padEnd(5), String(t.months).padStart(5), 'seeds', t.seeds.size, JSON.stringify(t.yard), '|', holders);
}
