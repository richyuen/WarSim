// PLAN 7.39a: sums docs/evidence/7.39/a/{years,wars}_<seed>.json into Markdown tables (summary.md).
/* global console */
import { readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const seeds = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437];
const bands = [[1, 1], [2, 30], [2, 5], [6, 10], [11, 30]];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const pick = (rows, [a, b]) => rows.filter((r) => r.year >= a && r.year <= b);

// Battles per seed (years files).
console.log('| seed | year 1 | years 2–30, mean | sank nothing 2–30 | of them % | late years with none |');
console.log('| --- | --- | --- | --- | --- | --- |');
const all = [];
for (const s of seeds) {
  const p = `${dir}/years_${s}.json`;
  if (!existsSync(p)) continue;
  const r = JSON.parse(readFileSync(p)).rows;
  all.push(r);
  const late = pick(r, [2, 30]);
  const b = late.reduce((t, y) => t + y.battles, 0);
  const z = late.reduce((t, y) => t + (y.battles - y.sinking), 0);
  console.log(`| ${s} | ${r[0].battles} | ${f1(b / late.length)} | ${z} | ${f1((100 * z) / Math.max(1, b))} | ${late.filter((y) => y.battles === 0).length} |`);
}
console.log('\n| all, mean a world-year | ' + bands.map(([a, b]) => (a === b ? `year ${a}` : `${a}–${b}`)).join(' | ') + ' |');
console.log('| --- |' + bands.map(() => ' --- |').join(''));
for (const k of ['battles', 'sinking', 'shipsSunk', 'fleets', 'navies', 'warPairs', 'seaPairs', 'seaPairFleets', 'underWay']) {
  console.log(`| ${k} | ` + bands.map((bd) => f1(mean(all.flatMap((r) => pick(r, bd).map((y) => y[k]))))).join(' | ') + ' |');
}

// Wars and fleets (wars files).
const W = [];
for (const s of seeds) {
  const p = `${dir}/wars_${s}.json`;
  if (existsSync(p)) W.push([s, JSON.parse(readFileSync(p)).rows]);
}
if (W.length) {
  console.log(`\nwars files: ${W.length}`);
  console.log('\n| war-weeks a world-year | ' + bands.map(([a, b]) => (a === b ? `year ${a}` : `${a}–${b}`)).join(' | ') + ' |');
  console.log('| --- |' + bands.map(() => ' --- |').join(''));
  for (const k of ['both', 'coast', 'land', 'neither']) console.log(`| ${k} | ` + bands.map((bd) => f1(mean(W.flatMap(([, r]) => pick(r, bd).map((y) => y.wars[k]))))).join(' | ') + ' |');
  const buckets = ['moving', 'engaged', 'take', 'awayBeside', 'awayHunt', 'awayStation', 'awayNewStation', 'awayHome', 'stage', 'stageThere', 'noBase', 'noTarget', 'tooStrong', 'emptyBombed'];
  for (const side of ['vsNavy', 'vsNone']) {
    console.log(`\n| fleet-weeks a world-year, ${side} | ` + bands.map(([a, b]) => (a === b ? `year ${a}` : `${a}–${b}`)).join(' | ') + ' |');
    console.log('| --- |' + bands.map(() => ' --- |').join(''));
    for (const k of buckets) console.log(`| ${k} | ` + bands.map((bd) => f1(mean(W.flatMap(([, r]) => pick(r, bd).map((y) => y[side][k] ?? 0))))).join(' | ') + ' |');
  }
  console.log('\n| on station vs a navy: nearest enemy fleet | ' + bands.map(([a, b]) => (a === b ? `year ${a}` : `${a}–${b}`)).join(' | ') + ' |');
  console.log('| --- |' + bands.map(() => ' --- |').join(''));
  for (const k of ['none', 'otherWater', 'far', 'underWay', 'strong', 'huntable']) console.log(`| ${k} | ` + bands.map((bd) => f1(mean(W.flatMap(([, r]) => pick(r, bd).map((y) => y.prey[k] ?? 0))))).join(' | ') + ' |');
  const rej = {};
  for (const [, r] of W) for (const y of pick(r, [2, 30])) for (const [k, v] of Object.entries(y.rejected)) rej[k] = (rej[k] ?? 0) + v;
  console.log('\nfleet orders refused, years 2–30, all seeds:', JSON.stringify(rej));
  // Years 2–30 with a both-navies war at some week, per seed.
  console.log('\n| seed | late years with a war of two navies (of 29) | both war-weeks 2–30 | battles 2–30 |');
  console.log('| --- | --- | --- | --- |');
  for (const [s, r] of W) {
    const late = pick(r, [2, 30]);
    console.log(`| ${s} | ${late.filter((y) => y.wars.both > 0).length} | ${late.reduce((t, y) => t + y.wars.both, 0)} | ${late.reduce((t, y) => t + y.battles, 0)} |`);
  }
  // Who: the nations most in each bucket, years 2–30.
  const who = {};
  for (const [, r] of W) for (const y of pick(r, [2, 30])) for (const [b, m] of Object.entries(y.who)) for (const [n, v] of Object.entries(m)) ((who[b] ??= {})[n] = (who[b]?.[n] ?? 0) + v);
  for (const [b, m] of Object.entries(who)) console.log(`who ${b}: ` + Object.entries(m).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([n, v]) => `${n} ${v}`).join(', '));
}
