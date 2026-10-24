/**
 * PLAN 7.104: engaged land formations a war over a window, for an A/B of a rule from one saved
 * state (each tree runs this on the same saves). Sampled as `contactAt.ts`: daily after the day's
 * 24 hours, the land formations of living nations (not fleets or wings, not off land) with
 * `engaged` set, and the wars running. Per case: their sums, per war, and the land formations of
 * living nations under 500 men at the end.
 *
 * Usage: npx tsx tools/diag/engagedWindow.ts <out.json> <days> <seed:state.bin | seed:1938> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const rows: unknown[] = [];
for (const a of process.argv.slice(4)) {
  const seedS = a.slice(0, a.indexOf(':'));
  const src = a.slice(a.indexOf(':') + 1);
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  if (src !== '1938') s.load(new Uint8Array(readFileSync(src)));
  const w = s.world;
  let engaged = 0;
  let wars = 0;
  const daily: number[] = [];
  for (let d = 0; d < days; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const c = w.formations.cols;
    wars += w.wars.list.length;
    let e = 0;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
      if (c.engaged[id] === 1) e++;
    });
    engaged += e;
    daily.push(e);
  }
  const c = w.formations.cols;
  let hollow = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
    if (c.strength[id]! < 500) hollow++;
  });
  const row = { seed: Number(seedS), src, days, engaged, wars, perWar: wars > 0 ? engaged / wars : 0, hollow, daily };
  rows.push(row);
  process.stderr.write(`${seedS} ${src}: engaged ${engaged} wars ${wars} per war ${row.perWar.toFixed(3)} hollow ${hollow}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
