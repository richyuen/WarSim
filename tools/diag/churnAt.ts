/**
 * PLAN 7.82a, from 1938: the longest stasis and the land's changes by cause. Stasis as the critic
 * reads it (`critic/scripts/c12_headless.ts`, `c12_summ.py`): at each year's end the five nations
 * holding the most cells by controller (any cell with a controller), as a set; the longest run of
 * years with the same set. Changes: `World.flipsBy` (`FlipCause`) by year; the front battle's
 * share of all changes in years FROM–N; and the net cells changed a year (the critic's
 * `flipped`). Per nation and year, for the span's anatomy: cells held at the year's end, days at
 * war, mean land formations engaged (daily, after each day's 24 hours).
 *
 * Usage: npx tsx tools/diag/churnAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { FlipCause } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const FROM = 10;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/churnAt_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const causes = Object.keys(FlipCause) as (keyof typeof FlipCause)[];

type Year = { year: number; top5: number[]; flips: Record<string, number>; net: number; wars: number; nations: Record<number, [number, number, number]> };
const rows: Year[] = [];
let prev = w.cells.controller.slice();
let last = Float64Array.from(w.flipsBy);
for (let y = 1; y <= years; y++) {
  const warDays = new Map<number, number>();
  const engaged = new Map<number, number>();
  let wars = 0;
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    wars += w.wars.list.length;
    for (const n of w.wars.nations()) warDays.set(n, (warDays.get(n) ?? 0) + 1);
    const c = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || c.engaged[id] !== 1) return;
      engaged.set(c.nation[id]!, (engaged.get(c.nation[id]!) ?? 0) + 1);
    });
  }
  const ctl = w.cells.controller;
  const held = new Map<number, number>();
  let net = 0;
  for (let i = 0; i < ctl.length; i++) {
    if (ctl[i] !== prev[i]) net++;
    if (ctl[i] !== 0) held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + 1);
  }
  prev = ctl.slice();
  const flips: Record<string, number> = {};
  causes.forEach((k, i) => (flips[k] = w.flipsBy[i]! - last[i]!));
  last = Float64Array.from(w.flipsBy);
  const ranked = [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const nations: Record<number, [number, number, number]> = {};
  for (const [n, cells] of ranked) nations[n] = [cells, warDays.get(n) ?? 0, +((engaged.get(n) ?? 0) / 365).toFixed(2)];
  rows.push({ year: y, top5: ranked.slice(0, 5).map(([n]) => n), flips, net, wars: +(wars / 365).toFixed(2), nations });
  const all = Object.values(flips).reduce((a, b) => a + b, 0);
  process.stderr.write(`${seed} year ${y}: top5 ${ranked.slice(0, 5).map(([n]) => tag(n)).join(' ')}; changes ${all} (battle ${flips.battle}, walk-in ${flips.walkIn}), net ${net}, wars ${(wars / 365).toFixed(2)}\n`);
}
// The longest run of the same five (the first on a tie), as `c12_summ.py` counts it.
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((n) => b.includes(n));
let best = { end: 0, run: 1 };
for (let i = 1, run = 1; i < rows.length; i++) {
  run = same(rows[i]!.top5, rows[i - 1]!.top5) ? run + 1 : 1;
  if (run > best.run) best = { end: i, run };
}
const span = rows.slice(best.end - best.run + 1, best.end + 1);
const five = [...span[0]!.top5].sort((a, b) => a - b);
const anatomy = five.map((n) => {
  const r: [number, number, number][] = span.map((y) => y.nations[n] ?? [0, 0, 0]);
  return { nation: tag(n), cells: [Math.min(...r.map((x) => x[0])), Math.max(...r.map((x) => x[0]))], warDaysMean: +(r.reduce((a, x) => a + x[1], 0) / r.length).toFixed(1), engagedMean: +(r.reduce((a, x) => a + x[2], 0) / r.length).toFixed(2) };
});
const lateRows = rows.filter((r) => r.year >= FROM);
const sum = (k: string): number => lateRows.reduce((a, r) => a + r.flips[k]!, 0);
const lateAll = causes.reduce((a, k) => a + sum(k), 0);
const late: Record<string, number> = {};
for (const k of causes) late[k] = sum(k);
const summary = {
  seed,
  years,
  stasis: { years: best.run, from: span[0]!.year, to: span[span.length - 1]!.year, five: five.map(tag), anatomy },
  late: { from: FROM, changes: lateAll, byCause: late, battleShare: lateAll > 0 ? late.battle! / lateAll : 0, netMean: lateRows.reduce((a, r) => a + r.net, 0) / lateRows.length },
};
writeFileSync(out, JSON.stringify({ summary, rows: rows.map((r) => ({ ...r, top5: r.top5.map(tag) })) }, null, 1));
console.log(
  `done: ${seed} stasis ${best.run} years (${summary.stasis.from}-${summary.stasis.to}: ${summary.stasis.five.join(' ')}); ` +
    `years ${FROM}-${years} changes ${lateAll}, battle share ${(summary.late.battleShare * 100).toFixed(1)} %, walk-in ${lateAll > 0 ? ((late.walkIn! / lateAll) * 100).toFixed(1) : 0} %`,
);
