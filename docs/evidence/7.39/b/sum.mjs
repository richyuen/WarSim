// PLAN 7.39b: tables from `start_<seed>.json` (tools/diag/seaStart.ts). Usage: node docs/evidence/7.39/b/sum.mjs > docs/evidence/7.39/b/summary.md
/* global console */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => /^start_\d+\.json$/.test(f)).sort();
const runs = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const seeds = runs.length;
const lateYears = runs.reduce((s, r) => s + (r.years - 1), 0);
const SORTIE_KM = 2500;
const per = (n, early) => (early ? n / seeds : n / lateYears).toFixed(1);
const pct = (a, b) => (b === 0 ? '–' : `${Math.round((100 * a) / b)} %`);
const wars = runs.flatMap((r) => r.wars.map((w) => ({ ...w, seed: r.seed })));
const battles = runs.flatMap((r) => r.battles.map((b) => ({ ...b, seed: r.seed })));
const early = (x) => x.year === 1;
const out = [];
const p = (s = '') => out.push(s);

p(`# PLAN 7.39b: how a war of two navies begins (${seeds} seeds, ${runs[0]?.years} years)`);
p();
p(`Seeds: ${runs.map((r) => r.seed).join(', ')}. Year 1 is a mean a world; years 2–${runs[0]?.years} a mean a world-year (${lateYears} world-years).`);
p();
const kmBucket = (w) => (w.kmSame < 0 ? 'other waters' : w.kmSame <= SORTIE_KM ? `≤ ${SORTIE_KM} km` : `> ${SORTIE_KM} km`);
const kinds = [
  ['all', () => true],
  ['initial (1938)', (w) => w.initial],
  ['fresh (both navies on day 1)', (w) => !w.initial && w.late === 0],
  ['a navy later (`late` > 0)', (w) => !w.initial && w.late > 0],
];
p('## 1. Wars of two navies begun, and their sea battles between their sides');
p();
p('| | year 1: wars | battles in 30 d / war | in 90 d / war | no battle in 90 d | years 2–30: wars a world-year | in 30 d / war | in 90 d / war | no battle in 90 d |');
p('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const row = (label, f) => {
  const a = wars.filter((w) => early(w) && f(w));
  const b = wars.filter((w) => !early(w) && f(w));
  const m = (l, k) => (l.length ? (l.reduce((s, w) => s + w[k], 0) / l.length).toFixed(2) : '–');
  p(`| ${label} | ${per(a.length, true)} | ${m(a, 'b30')} | ${m(a, 'b90')} | ${pct(a.filter((w) => w.b90 === 0).length, a.length)} | ${per(b.length, false)} | ${m(b, 'b30')} | ${m(b, 'b90')} | ${pct(b.filter((w) => w.b90 === 0).length, b.length)} |`);
};
for (const [l, f] of kinds) row(l, f);
for (const k of [`≤ ${SORTIE_KM} km`, `> ${SORTIE_KM} km`, 'other waters']) row(`nearest fleets of the same waters ${k}`, (w) => kmBucket(w) === k);
p();
p('## 2. Each side\'s armed fleets on the day the war is first one of two navies (fleets, summed over both sides)');
p();
const states = ['home', 'stThis', 'stOther', 'stPeace', 'sea', 'moving', 'engaged'];
p(`| | ${states.join(' | ')} |`);
p(`| --- | ${states.map(() => '---').join(' | ')} |`);
for (const [label, f] of [['year 1', early], ['years 2–30', (w) => !early(w)]]) {
  for (const [kl, kf] of [[`≤ ${SORTIE_KM} km`, (w) => kmBucket(w) === `≤ ${SORTIE_KM} km`], [`> ${SORTIE_KM} km or other waters`, (w) => kmBucket(w) !== `≤ ${SORTIE_KM} km`]]) {
    const l = wars.filter((w) => f(w) && kf(w));
    const sum = Object.fromEntries(states.map((s) => [s, 0]));
    for (const w of l) for (const sd of w.sides) for (const s of states) sum[s] += sd.state[s] ?? 0;
    const tot = states.reduce((s, k) => s + sum[k], 0);
    p(`| ${label}, ${kl} (${l.length} wars) | ${states.map((s) => `${sum[s]} (${pct(sum[s], tot)})`).join(' | ')} |`);
  }
}
p();
p('What the naval AI does with the standing ones that day (`sortieWhy`), fleets:');
p();
const whys = [...new Set(wars.flatMap((w) => w.sides.flatMap((s) => Object.keys(s.why))))].sort();
p(`| | ${whys.join(' | ')} |`);
p(`| --- | ${whys.map(() => '---').join(' | ')} |`);
for (const [label, f] of [['year 1', early], ['years 2–30', (w) => !early(w)]]) {
  const l = wars.filter(f);
  const sum = Object.fromEntries(whys.map((s) => [s, 0]));
  for (const w of l) for (const sd of w.sides) for (const s of whys) sum[s] += sd.why[s] ?? 0;
  p(`| ${label} | ${whys.map((s) => sum[s]).join(' | ')} |`);
}
p();
p('## 3. The km between the two sides\' nearest armed fleets of the same waters, on that day');
p();
const q = (l, f) => {
  const v = l.map((w) => w.kmSame).filter((x) => x >= 0).sort((a, b) => a - b);
  return v.length ? Math.round(v[Math.floor(f * (v.length - 1))]) : '–';
};
p('| | wars | other waters | quartile 1 | median | quartile 3 |');
p('| --- | --- | --- | --- | --- | --- |');
for (const [label, f] of [['year 1', early], ['years 2–30', (w) => !early(w)]]) {
  const l = wars.filter(f);
  p(`| ${label} | ${l.length} | ${l.filter((w) => w.kmSame < 0).length} | ${q(l, 0.25)} | ${q(l, 0.5)} | ${q(l, 0.75)} |`);
}
p();
p('## 4. Sea battles: where they begin and who sailed to them');
p();
p('A fleet "moved" was under way the hour before the battle began (the hunter); one that "stood" was not (the prey). Side a and b are the battle\'s two nations; a port is one whose water is within `AT_PORT_CELLS`.');
p();
p('| | battles | by a port of a side | by another\'s port | at sea | war age ≤ 30 d | one side all stood | both moved |');
p('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [label, f, e] of [['year 1 (a world)', early, true], ['years 2–30 (a world-year)', (b) => !early(b), false]]) {
  const l = battles.filter(f);
  const port = l.filter((b) => b.place === 'portA' || b.place === 'portB').length;
  const other = l.filter((b) => b.place === 'portOther').length;
  const sea = l.filter((b) => b.place === 'sea').length;
  const young = l.filter((b) => b.warAge >= 0 && b.warAge <= 30).length;
  const stood = l.filter((b) => (b.movedA === 0 && b.stoodA > 0) || (b.movedB === 0 && b.stoodB > 0)).length;
  const both = l.filter((b) => b.movedA > 0 && b.movedB > 0).length;
  p(`| ${label} | ${per(l.length, e)} | ${pct(port, l.length)} | ${pct(other, l.length)} | ${pct(sea, l.length)} | ${pct(young, l.length)} | ${pct(stood, l.length)} | ${pct(both, l.length)} |`);
}
p();
p('## 5. Per seed, years 2–30: wars of two navies begun, with no battle in 90 days, and the late battles');
p();
p('| seed | wars | none in 90 d | far (> SORTIE_KM or other waters) | late battles |');
p('| --- | --- | --- | --- | --- |');
for (const r of runs) {
  const l = r.wars.filter((w) => w.year > 1);
  p(`| ${r.seed} | ${l.length} | ${l.filter((w) => w.b90 === 0).length} | ${l.filter((w) => kmBucket(w) !== `≤ ${SORTIE_KM} km`).length} | ${r.battles.filter((b) => b.year > 1).length} |`);
}
console.log(out.join('\n'));
