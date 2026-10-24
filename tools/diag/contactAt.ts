/**
 * PLAN 7.104's AT, from 1938: engaged land formations per war, sampled as `landEngaged.ts` (PLAN
 * 7.49's, the critic's figure): daily after each day's 24 hours, the land formations of living
 * nations (not fleets or wings, not off land) with `engaged` set, and the wars running; per war =
 * mean engaged over mean wars; years 2–N against year 1 (bar: at least 0.15). And the land
 * formations of living nations under 500 men at the end (bar: not above HEAD's on the same seed).
 * Saves the state at year 10 and at the end beside the output (`<out>_y10.bin`, `<out>_yN.bin`)
 * for the A/B of a rule from one saved state.
 *
 * Usage: npx tsx tools/diag/contactAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const HOLLOW = 500;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/contactAt_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
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
    const c = w.formations.cols;
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
  if (y === 10 || y === years) writeFileSync(out.replace(/\.json$/, `_y${y}.bin`), s.save());
}
const c = w.formations.cols;
let hollow = 0;
w.formations.forEach((id) => {
  if (w.isFleet(id) || w.isWing(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
  if (c.strength[id]! < HOLLOW) hollow++;
});
const late = rows.filter((r) => r.year >= 2);
const e = late.reduce((a, r) => a + r.engaged, 0);
const wr = late.reduce((a, r) => a + r.wars, 0);
const lateE = wr > 0 ? e / wr : 0;
const summary = { seed, years, year1: rows[0]!.perWar, late: lateE, ratio: lateE / Math.max(1e-9, rows[0]!.perWar), lateEngaged: e, lateWars: wr, y1Engaged: rows[0]!.engaged * 365, y1Wars: rows[0]!.wars * 365, hollow };
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(`done: ${seed} per war year 1 ${summary.year1.toFixed(3)}, years 2-${years} ${lateE.toFixed(3)} (${summary.ratio.toFixed(3)} of year 1); under ${HOLLOW} men at the end ${hollow}`);
