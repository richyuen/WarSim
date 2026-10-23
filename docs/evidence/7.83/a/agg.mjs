// Tabulate --profile logs: node agg.mjs <logA1> <logA2> -- <logB1> <logB2>
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2);
const cut = args.indexOf('--');
const groups = [args.slice(0, cut), args.slice(cut + 1)];
function parse(file) {
  const years = [];
  let cur;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const y = line.match(/^year\s+(\d+).*formations (\d+)\s+flipped (\d+)\s+tick ms mean ([\d.]+) p95 ([\d.]+)/);
    if (y) { cur = { year: +y[1], formations: +y[2], flipped: +y[3], mean: +y[4], p95: +y[5], sys: {} }; years.push(cur); continue; }
    const s = line.match(/^\s+(\S+)\s+([\d.]+) ms\s+[\d.]+ %\s+max\s+([\d.]+)\s+slow\s+(\d+) calls ([\d.]+) ms/);
    if (s && cur) cur.sys[s[1]] = { ms: +s[2], max: +s[3], slow: +s[4], slowMs: +s[5] };
  }
  return years;
}
const runs = groups.map((g) => g.map(parse));
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const names = new Set();
for (const g of runs) for (const r of g) for (const y of r) for (const n of Object.keys(y.sys)) names.add(n);
const nYears = runs[0][0].length;
console.log('per year (mean of rounds): A | B');
for (let i = 0; i < nYears; i++) {
  const f = (g, k) => avg(g.map((r) => r[i][k]));
  console.log(`year ${i + 1}: tick ${f(runs[0], 'mean').toFixed(3)} | ${f(runs[1], 'mean').toFixed(3)}  p95 ${f(runs[0], 'p95').toFixed(2)} | ${f(runs[1], 'p95').toFixed(2)}  formations ${f(runs[0], 'formations').toFixed(0)} | ${f(runs[1], 'formations').toFixed(0)}  flipped ${f(runs[0], 'flipped').toFixed(0)} | ${f(runs[1], 'flipped').toFixed(0)}`);
}
console.log('\nsystem: mean ms over 5 years A | B (delta), max A | B, slow calls/yr A | B, slow ms A | B');
const rows = [];
for (const n of names) {
  const g = (grp, k) => avg(grp.flatMap((r) => r.map((y) => y.sys[n]?.[k] ?? 0)));
  const mx = (grp) => Math.max(...grp.flatMap((r) => r.map((y) => y.sys[n]?.max ?? 0)));
  rows.push({ n, a: g(runs[0], 'ms'), b: g(runs[1], 'ms'), ma: mx(runs[0]), mb: mx(runs[1]), sa: g(runs[0], 'slow'), sb: g(runs[1], 'slow'), xa: g(runs[0], 'slowMs'), xb: g(runs[1], 'slowMs') });
}
rows.sort((p, q) => (q.b - q.a) - (p.b - p.a));
for (const r of rows) console.log(`${r.n.padEnd(15)} ${r.a.toFixed(4)} | ${r.b.toFixed(4)} (${(r.b - r.a >= 0 ? '+' : '') + (r.b - r.a).toFixed(4)})  max ${r.ma.toFixed(1)} | ${r.mb.toFixed(1)}  slow ${r.sa.toFixed(0)} | ${r.sb.toFixed(0)}  ${r.xa.toFixed(4)} | ${r.xb.toFixed(4)}`);
const ta = avg(runs[0].flatMap((r) => r.map((y) => y.mean))), tb = avg(runs[1].flatMap((r) => r.map((y) => y.mean)));
console.log(`\ntick mean A ${ta.toFixed(4)}  B ${tb.toFixed(4)}`);
// Per year per system, for the top movers
console.log('\nper year, top 6 movers: A | B');
for (const r of rows.slice(0, 6)) {
  const line = [];
  for (let i = 0; i < nYears; i++) line.push(`${avg(runs[0].map((x) => x[i].sys[r.n]?.ms ?? 0)).toFixed(3)}|${avg(runs[1].map((x) => x[i].sys[r.n]?.ms ?? 0)).toFixed(3)}`);
  console.log(`${r.n.padEnd(15)} ${line.join('  ')}`);
}
