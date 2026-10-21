/**
 * PLAN 7.49's AT: engaged land formations per war running, from 1938. Daily (after each day's 24
 * hours): the land formations (not fleets or wings, on land) of living nations with `engaged` set,
 * and the wars running. Per year: the means of the daily samples, and engaged per war (the mean of
 * engaged over the mean of wars). The AT's figure: years 2–20's per war against year 1's (bar: at
 * least a quarter).
 *
 * Usage: npx tsx tools/diag/landEngaged.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/landEngaged_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const c = w.formations.cols;
const rows: { year: number; engaged: number; wars: number; perWar: number; land: number }[] = [];
for (let y = 1; y <= years; y++) {
  let engaged = 0;
  let wars = 0;
  let land = 0;
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    wars += w.wars.list.length;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
      land++;
      if (c.engaged[id] === 1) engaged++;
    });
  }
  const r = { year: y, engaged: engaged / 365, wars: wars / 365, perWar: wars > 0 ? engaged / wars : 0, land: land / 365 };
  rows.push(r);
  process.stderr.write(`${seed} year ${y}: engaged ${r.engaged.toFixed(2)}, wars ${r.wars.toFixed(2)}, per war ${r.perWar.toFixed(3)}, land ${r.land.toFixed(0)}\n`);
}
const late = rows.filter((r) => r.year >= 2);
const e = late.reduce((a, r) => a + r.engaged, 0);
const wr = late.reduce((a, r) => a + r.wars, 0);
const summary = { seed, years, year1: rows[0]!.perWar, late: wr > 0 ? e / wr : 0 };
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(`done: ${seed} per war year 1 ${summary.year1.toFixed(3)}, years 2-${years} ${summary.late.toFixed(3)} (${(summary.late / Math.max(1e-9, summary.year1)).toFixed(3)} of year 1)`);
