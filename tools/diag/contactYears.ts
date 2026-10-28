/**
 * PLAN 7.128's AT (R15-B1): land contact from 1938, counted as the critic's run 15 counts it
 * (`critic/scripts/c15_headless.ts`, `c15_engaged.ts`, `c15_hollow.ts`): a land formation is one
 * that is not a fleet, not a wing and not embarked, of any nation.
 * - Per year: engaged land formations at hour 12 of each day, the mean over the year's days.
 * - At the end of years 10 and 20 (checkpoints): the world saved, then a copy loaded and stepped 7
 *   days, engaged read at hour 0 and after each day (8 reads); "nobody in contact" when their mean
 *   is 0. Under 500 men: land formations with strength under 500 at the checkpoint.
 * - Each year's end: the five largest by land cells controlled, in order (PLAN 7.153; ADR-732's
 *   ordered five, as the critic's `c17_cmp.py` reads it), and by km²; `orderedRun`, `orderedRunKm2` the
 *   longest run of one order.
 *
 * Usage: [SAVE_DIR=<dir>] npx tsx tools/diag/contactYears.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { isLand as isLandTerrain } from '../../src/shared/terrain';
import { cellAreaByRow } from '../../src/sim/nav/grid';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/contactYears_${seed}.json`;
const assets = loadAssets1938(size1938(undefined).w);
const sim = new Sim({ scenario: '1938', seed, assets });
const w = sim.world;

const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const isLand = (ww: World, id: number): boolean => !ww.isFleet(id) && !ww.isWing(id) && !ww.embarked.has(id);
const engagedNow = (ww: World): number => {
  let e = 0;
  const c = ww.formations.cols;
  ww.formations.forEach((id) => {
    if (isLand(ww, id) && c.engaged[id]) e++;
  });
  return e;
};

const rows: { year: number; engaged: number; wars: number; top5: number[]; top5km2: number[] }[] = [];
const rowArea = cellAreaByRow(w.cells.w, w.cells.h);
// The five largest by land cells controlled (the critic's count) and by km² (ADR-732, `criteria.ts`).
const top5Now = (ww: World, byKm2: boolean): number[] => {
  const held = new Map<number, number>();
  const ctl = ww.cells.controller;
  const ter = ww.cells.terrain;
  for (let i = 0; i < ctl.length; i++) {
    if (ctl[i] === 0 || !isLandTerrain(ter[i]!)) continue;
    held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + (byKm2 ? rowArea[Math.floor(i / ww.cells.w)]! : 1));
  }
  return [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map(([n]) => n);
};
const checkpoints: { year: number; daily: number[]; mean: number; empty: boolean; land: number; under500: number }[] = [];
for (let y = 1; y <= years; y++) {
  let eng = 0;
  let wars = 0;
  for (let d = 0; d < 365; d++) {
    sim.step(12, clear);
    eng += engagedNow(w);
    wars += w.wars.list.length;
    sim.step(12, clear);
  }
  rows.push({ year: y, engaged: eng / 365, wars: wars / 365, top5: top5Now(w, false), top5km2: top5Now(w, true) });
  process.stderr.write(`${seed} year ${y}: engaged ${(eng / 365).toFixed(2)}, wars ${(wars / 365).toFixed(2)}\n`);
  if (y === 10 || y === 20) {
    const copy = new Sim({ scenario: '1938', seed, assets });
    const bytes = sim.save();
    // `SAVE_DIR`: the checkpoint written there as `<seed>_y<year>.bin` (PLAN 7.150's AT reads them again).
    if (process.env.SAVE_DIR) writeFileSync(`${process.env.SAVE_DIR}/${seed}_y${y}.bin`, bytes);
    copy.load(bytes);
    const cw = copy.world;
    let land = 0;
    let under500 = 0;
    cw.formations.forEach((id) => {
      if (!isLand(cw, id)) return;
      land++;
      if (cw.formations.cols.strength[id]! < 500) under500++;
    });
    const daily = [engagedNow(cw)];
    for (let d = 0; d < 7; d++) {
      copy.step(24, clear);
      daily.push(engagedNow(cw));
    }
    const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
    checkpoints.push({ year: y, daily, mean, empty: mean === 0, land, under500 });
    process.stderr.write(`${seed} checkpoint ${y}: engaged ${daily.join(',')}, under 500 ${under500} of ${land}\n`);
  }
}
const late = rows.slice(1);
const longestRun = (key: (r: (typeof rows)[number]) => string): number => {
  let best = rows.length > 0 ? 1 : 0;
  for (let i = 1, run = 1; i < rows.length; i++) {
    run = key(rows[i]!) === key(rows[i - 1]!) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};
const orderedRun = longestRun((r) => r.top5.join());
const orderedRunKm2 = longestRun((r) => r.top5km2.join());
const summary = {
  seed,
  years,
  year1: rows[0]?.engaged ?? 0,
  late: late.length > 0 ? late.reduce((a, r) => a + r.engaged, 0) / late.length : 0,
  emptyCheckpoints: checkpoints.filter((c) => c.empty).length,
  under500y20: checkpoints.find((c) => c.year === 20)?.under500 ?? null,
  orderedRun,
  orderedRunKm2,
};
writeFileSync(out, JSON.stringify({ summary, rows, checkpoints }, null, 1));
process.stderr.write(`done: ${JSON.stringify(summary)}\n`);
