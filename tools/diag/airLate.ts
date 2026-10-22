/**
 * PLAN 7.51b's AT: the late air war, from 1938. Per year: air battles (`EventKind.AirBattle`
 * events), the mean sorties aloft an hour (`world.sorties.size`, the critic's
 * `meanSortiesAloft`), the mean wars running, wings of living nations, and land formations engaged
 * (on land, of living nations, `engaged` set: `landEngaged.ts`'s count, PLAN 7.49) and engaged per
 * war (daily, after each day's 24 hours). The AT's figure: the mean air battles a year in years 2–N
 * against year 1's (bar: at least a tenth), on PLAN 7.49's unseen seeds 7401–7410.
 *
 * Usage: npx tsx tools/diag/airLate.ts <seed> [years = 20] [out = .cache/airLate_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/airLate_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const rows: { year: number; airBattles: number; aloft: number; wars: number; wings: number; engaged: number; perWar: number }[] = [];
for (let y = 1; y <= years; y++) {
  let airBattles = 0;
  let aloft = 0;
  let hours = 0;
  let wars = 0;
  let wings = 0;
  let engaged = 0;
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirBattle) airBattles++;
      ev.length = 0;
      ww.out.fires.length = 0;
      aloft += ww.sorties.size;
      hours++;
    });
    wars += w.wars.list.length;
    // The columns are read afresh each day: the table replaces them as it grows.
    const c = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.nations.cols.living[c.nation[id]!] !== 1) return;
      if (w.isWing(id)) wings++;
      else if (!w.isFleet(id) && !w.offLand(id) && c.engaged[id] === 1) engaged++;
    });
  }
  const r = { year: y, airBattles, aloft: +(aloft / hours).toFixed(2), wars: +(wars / 365).toFixed(2), wings: +(wings / 365).toFixed(1), engaged: +(engaged / 365).toFixed(2), perWar: wars > 0 ? +(engaged / wars).toFixed(3) : 0 };
  rows.push(r);
  process.stderr.write(`${seed} year ${y}: air battles ${r.airBattles}, aloft ${r.aloft}, wars ${r.wars}, wings ${r.wings}, engaged ${r.engaged}, per war ${r.perWar}\n`);
}
const late = rows.filter((r) => r.year >= 2);
const lateMean = late.reduce((a, r) => a + r.airBattles, 0) / Math.max(1, late.length);
const summary = { seed, years, year1: rows[0]!.airBattles, lateMean: +lateMean.toFixed(1), share: +(lateMean / Math.max(1, rows[0]!.airBattles)).toFixed(3), hash: s.hash().toString(16) };
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(`done: ${seed} air battles year 1 ${summary.year1}, years 2-${years} a mean of ${summary.lateMean} a year (${summary.share} of year 1)`);
