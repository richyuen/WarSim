/**
 * PLAN 7.138's AT (R16-B1), from 1938, one run for both figures:
 * - engaged land formations a day, counted as the critic's run 15/16 counts it (`contactYears.ts`):
 *   not a fleet, not a wing, not embarked, engaged at hour 12 of each day; the year's mean;
 * - the top five as the critic reads it (`churnAt.ts`): at each year's end the five nations holding
 *   the most cells by controller, as a set; the longest run of years with the same set.
 * Also wars running (daily mean) and land formations at war (daily mean at hour 12).
 *
 * Usage: npx tsx tools/diag/stillAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/stillAt_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
const w = sim.world;

const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};

const rows: { year: number; engaged: number; atWar: number; wars: number; top5: number[] }[] = [];
const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  let eng = 0;
  let atWar = 0;
  let wars = 0;
  for (let d = 0; d < 365; d++) {
    sim.step(12, clear);
    const fighting = new Set(w.wars.nations());
    const c = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
      if (c.engaged[id]) eng++;
      if (fighting.has(c.nation[id]!)) atWar++;
    });
    wars += w.wars.list.length;
    sim.step(12, clear);
  }
  const held = new Map<number, number>();
  const ctl = w.cells.controller;
  for (let i = 0; i < ctl.length; i++) if (ctl[i] !== 0) held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + 1);
  const top5 = [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map((e) => e[0]).sort((a, b) => a - b);
  rows.push({ year: y, engaged: eng / 365, atWar: atWar / 365, wars: wars / 365, top5 });
  process.stderr.write(`seed ${seed} year ${y} engaged ${(eng / 365).toFixed(2)} ${Math.round((Date.now() - t0) / 1000)} s\n`);
}
let longest = 0;
let run = 0;
for (let i = 0; i < rows.length; i++) {
  run = i > 0 && rows[i]!.top5.join() === rows[i - 1]!.top5.join() ? run + 1 : 1;
  longest = Math.max(longest, run);
}
const late = rows.filter((r) => r.year >= 2);
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const summary = {
  seed,
  years,
  y1: rows[0]?.engaged ?? 0,
  late: mean(late.map((r) => r.engaged)),
  lateAtWar: mean(late.map((r) => r.atWar)),
  lateWars: mean(late.map((r) => r.wars)),
  longestTop5: longest,
  rows,
};
writeFileSync(out, JSON.stringify(summary, null, 1));
process.stdout.write(`done: seed ${seed} y1 ${summary.y1.toFixed(2)} late ${summary.late.toFixed(3)} longest ${longest}\n`);
