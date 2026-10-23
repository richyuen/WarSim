/**
 * PLAN 7.79's AT, from 1938: engaged land formations per war (sampled as `landEngaged.ts`: daily after
 * each day's 24 hours, the land formations of living nations, not fleets or wings, not off land, with
 * `engaged` set, and the wars running; per war = mean engaged over mean wars; years 2–N against year 1;
 * bar at least a tenth), and the piles: daily, the land formations of a living nation at war standing on
 * one cell (not aboard, on land), grouped by nation and cell; a group of 30 or more is a pile. Per pile:
 * its longest run of consecutive days, the days seen, its most formations. Bar: no run of 30 days.
 *
 * Usage: npx tsx tools/diag/landAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const MIN = 30;
const RUN = 30;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/landAt_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: { year: number; engaged: number; wars: number; perWar: number; land: number }[] = [];
type Pile = { nation: string; cell: number; first: number; run: number; longest: number; longestEnd: number; days: number; most: number };
const piles = new Map<string, Pile>();
let day = 0;
for (let y = 1; y <= years; y++) {
  let engaged = 0;
  let wars = 0;
  let land = 0;
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    day++;
    const c = w.formations.cols;
    wars += w.wars.list.length;
    const fighting = w.wars.nations();
    const groups = new Map<string, number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
      land++;
      if (c.engaged[id] === 1) engaged++;
      const n = c.nation[id]!;
      if (!fighting.has(n)) return;
      const k = `${n}:${Math.floor(c.y[id]!) * w.cells.w + Math.floor(c.x[id]!)}`;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    });
    for (const [k, count] of groups) {
      if (count < MIN) continue;
      let p = piles.get(k);
      if (!p) {
        const [ns, cs] = k.split(':');
        piles.set(k, (p = { nation: tag(Number(ns)), cell: Number(cs), first: day, run: 0, longest: 0, longestEnd: 0, days: 0, most: 0 }));
      }
      p.run++;
      p.days++;
      p.most = Math.max(p.most, count);
      if (p.run > p.longest) {
        p.longest = p.run;
        p.longestEnd = day;
      }
    }
    for (const [k, p] of piles) if (p.run > 0 && (groups.get(k) ?? 0) < MIN) p.run = 0;
  }
  const r = { year: y, engaged: engaged / 365, wars: wars / 365, perWar: wars > 0 ? engaged / wars : 0, land: land / 365 };
  rows.push(r);
  process.stderr.write(`${seed} year ${y}: engaged ${r.engaged.toFixed(2)}, wars ${r.wars.toFixed(2)}, per war ${r.perWar.toFixed(3)}, land ${r.land.toFixed(0)}\n`);
}
const late = rows.filter((r) => r.year >= 2);
const e = late.reduce((a, r) => a + r.engaged, 0);
const wr = late.reduce((a, r) => a + r.wars, 0);
const list = [...piles.values()].sort((a, b) => b.longest - a.longest || b.most - a.most);
const longPiles = list.filter((p) => p.longest >= RUN);
const summary = {
  seed,
  years,
  year1: { engaged: rows[0]!.engaged, wars: rows[0]!.wars, perWar: rows[0]!.perWar },
  late: { engaged: e / late.length, wars: wr / late.length, perWar: wr > 0 ? e / wr : 0 },
  piles: list.length,
  longPiles: longPiles.length,
};
writeFileSync(out, JSON.stringify({ summary, longPiles, piles: list.slice(0, 40), rows }, null, 1));
console.log(
  `done: ${seed} per war year 1 ${summary.year1.perWar.toFixed(3)}, years 2-${years} ${summary.late.perWar.toFixed(3)} ` +
    `(${(summary.late.perWar / Math.max(1e-9, summary.year1.perWar)).toFixed(3)} of year 1); piles ${list.length}, ${longPiles.length} of ${RUN} days running`,
);
