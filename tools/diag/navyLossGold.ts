/**
 * PLAN 7.35d3b: sums `navyLoss`'s gold traces (the `gold` months of lost navies) over the seeds'
 * JSON in a directory, years 2–30, by income band and war; and prints the longest series.
 *
 * Usage: npx tsx tools/diag/navyLossGold.ts <dir>
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2]!;
const files = readdirSync(dir).filter((f) => /^loss_\d+\.json$/.test(f));
const tot: Record<string, any> = {};
const reasons: Record<string, number> = {};
let lost = 0;
let rebuilt = 0;
let natLost = 0;
let natRebuilt = 0;
const gaps: number[] = [];
const add = (a: any, b: any): void => {
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === 'number') a[k] = (a[k] ?? 0) + v;
    else add((a[k] ??= {}), v);
  }
};
const series: { seed: number; tag: string; n: number; g: number[][] }[] = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const y of j.rows) {
    if (y.year < 2) continue;
    add(reasons, y.months);
    for (const [k, v] of Object.entries(y.gold)) add((tot[k] ??= {}), v);
  }
  for (const x of Object.values(j.nations) as any[]) {
    lost += x.lost.length;
    if (x.lost.length > 0) natLost++;
    if (x.regained.length > 0) natRebuilt++;
    rebuilt += x.regained.length;
    for (let i = 0; i < x.regained.length; i++) gaps.push(x.regained[i] - x.lost[i]);
    if (x.gold.length) series.push({ seed: j.seed, tag: x.tag, n: x.gold.length, g: x.gold });
  }
}
gaps.sort((a, b) => a - b);
console.log('files', files.length, 'nations that lost a navy', natLost, 'built one again', natRebuilt, '; navies lost', lost, 'rebuilt', rebuilt, 'median gap', gaps[Math.floor(gaps.length / 2)]);
const all = Object.values(reasons).reduce((a, b) => a + b, 0);
console.log('reasons y2-30', all, JSON.stringify(reasons));
const sumAll: any = {};
for (const [k, t] of Object.entries(tot) as [string, any][]) {
  add(sumAll, t);
  const m = t.months;
  console.log(k.padEnd(16), 'months', m, 'shortfall/m', Math.round(t.shortfall / m), 'balance/m', Math.round(t.balance / m), 'army/m', Math.round(t.army / m), 'refill/m', Math.round(t.refill / m), 'other/m', Math.round(t.otherOrders / m), 'research/m', Math.round(t.research / m),
    'coverLast', (t.coverLast / m).toFixed(3), 'cover12', (t.cover12 / m).toFixed(3), 'coverLost', (t.coverLost / m).toFixed(3), 'toLine', JSON.stringify(t.toLine), 'leftOver', JSON.stringify(t.leftOver));
}
const t = sumAll;
const m = t.months;
console.log('ALL'.padEnd(16), 'months', m, 'shortfall/m', Math.round(t.shortfall / m), 'balance/m', Math.round(t.balance / m), 'army/m', Math.round(t.army / m), 'refill/m', Math.round(t.refill / m), 'research/m', Math.round(t.research / m), 'coverLast', (t.coverLast / m).toFixed(3), 'cover12', (t.cover12 / m).toFixed(3), 'coverLost', (t.coverLost / m).toFixed(3), 'toLine', JSON.stringify(t.toLine), 'leftOver', JSON.stringify(t.leftOver));
series.sort((a, b) => b.n - a.n);
for (const s of series.slice(0, 8)) {
  console.log(`\n${s.seed} ${s.tag} ${s.n} gold months; every 12th: [tick, before, shortfall, balance, army, refill, after, war]`);
  for (let i = 0; i < s.g.length; i += 12) console.log('  ', JSON.stringify(s.g[i]));
}
