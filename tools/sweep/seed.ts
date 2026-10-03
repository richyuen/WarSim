/**
 * One sweep run (PLAN 1.40): the 1938 world on `seed` for `years`, sampled daily for war activity
 * and yearly for the SPEC §10 dynamism metrics. Writes one JSON result.
 *
 *   tsx tools/sweep/seed.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { isLand } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

export interface YearSample {
  year: number;
  alive: number;
  /** Largest living nation's share of owned land cells and of gross income. */
  topLand: number;
  topIncome: number;
  topNation: number;
  wars: number;
  /** Days of the year with at least one war. */
  warDays: number;
  /** Land cells whose controller changed during the year (net, start vs end of the year). */
  changed: number;
}

export interface SeedResult {
  seed: number;
  years: number;
  wallS: number;
  landCells: number;
  samples: YearSample[];
}

function main(): void {
  const [seedArg, yearsArg, out] = process.argv.slice(2);
  const seed = Number(seedArg);
  const years = Number(yearsArg);
  if (!Number.isFinite(seed) || !Number.isFinite(years) || !out) throw new Error('usage: seed.ts <seed> <years> <out.json>');
  const t0 = performance.now();
  const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = sim.world;
  const land: number[] = [];
  for (let c = 0; c < w.cells.terrain.length; c++) if (isLand(w.cells.terrain[c]!)) land.push(c);
  const samples: YearSample[] = [];
  for (let y = 0; y < years; y++) {
    const before = Uint16Array.from(land, (c) => w.cells.controller[c]!);
    let warDays = 0;
    for (let d = 0; d < 365; d++) {
      sim.step(24);
      if (w.wars.list.length > 0) warDays++;
    }
    const nc = w.nations.cols;
    let alive = 0;
    let owned = 0;
    let income = 0;
    let top = 0;
    w.nations.forEach((n) => {
      if (nc.living[n] !== 1) return;
      alive++;
      owned += nc.cells[n]!;
      income += Math.max(0, nc.income[n]!);
      if (top === 0 || nc.cells[n]! > nc.cells[top]!) top = n;
    });
    let topIncome = 0;
    w.nations.forEach((n) => {
      if (nc.living[n] === 1) topIncome = Math.max(topIncome, Math.max(0, nc.income[n]!));
    });
    let changed = 0;
    land.forEach((c, i) => {
      if (w.cells.controller[c] !== before[i]) changed++;
    });
    samples.push({ year: y + 1, alive, topLand: owned > 0 ? nc.cells[top]! / owned : 0, topIncome: income > 0 ? topIncome / income : 0, topNation: top, wars: w.wars.list.length, warDays, changed });
    process.stdout.write(`seed ${seed} year ${y + 1}/${years}: alive ${alive}, top land ${(samples.at(-1)!.topLand * 100).toFixed(1)}%, wars ${w.wars.list.length}, changed ${changed}\n`);
  }
  const result: SeedResult = { seed, years, wallS: (performance.now() - t0) / 1000, landCells: land.length, samples };
  writeFileSync(out, JSON.stringify(result));
}

main();
