/**
 * One sweep run (PLAN 1.40): the 1938 world on `seed` for `years`, sampled daily for war activity
 * and yearly for the SPEC §10 dynamism metrics. Writes one JSON result. Land is measured in km²,
 * not in cells (ADR-52): the map is a Miller projection.
 *
 *   tsx tools/sweep/seed.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { isLand } from '../../src/shared/terrain';
import { landStandings } from '../../src/sim/landArea';
import { cellAreaByRow } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

export interface YearSample {
  year: number;
  alive: number;
  /** Largest living nation's share of owned land (by area) and of gross income. */
  topLand: number;
  topIncome: number;
  topNation: number;
  /** The ten largest living nations by owned area, largest first. */
  top10: number[];
  wars: number;
  /** Days of the year with at least one war. */
  warDays: number;
  /** km² of land whose controller changed during the year (net, start vs end of the year). */
  changedKm2: number;
}

export interface SeedResult {
  seed: number;
  years: number;
  wallS: number;
  /** km² of all land cells. */
  landKm2: number;
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
  const rowArea = cellAreaByRow(w.cells.w, w.cells.h);
  const areaOf = (c: number): number => rowArea[Math.floor(c / w.cells.w)]!;
  const landKm2 = land.reduce((s, c) => s + areaOf(c), 0);
  const samples: YearSample[] = [];
  for (let y = 0; y < years; y++) {
    const before = Uint16Array.from(land, (c) => w.cells.controller[c]!);
    let warDays = 0;
    for (let d = 0; d < 365; d++) {
      sim.step(24);
      if (w.wars.list.length > 0) warDays++;
    }
    const nc = w.nations.cols;
    const { area, owned, ranked } = landStandings(w);
    const top = ranked[0] ?? 0;
    let income = 0;
    let topIncome = 0;
    for (const n of ranked) {
      income += Math.max(0, nc.income[n]!);
      topIncome = Math.max(topIncome, Math.max(0, nc.income[n]!));
    }
    let changedKm2 = 0;
    land.forEach((c, i) => {
      if (w.cells.controller[c] !== before[i]) changedKm2 += areaOf(c);
    });
    samples.push({ year: y + 1, alive: ranked.length, topLand: owned > 0 ? area[top]! / owned : 0, topIncome: income > 0 ? topIncome / income : 0, topNation: top, top10: ranked.slice(0, 10), wars: w.wars.list.length, warDays, changedKm2 });
    process.stdout.write(`seed ${seed} year ${y + 1}/${years}: alive ${ranked.length}, top land ${(samples.at(-1)!.topLand * 100).toFixed(1)}%, wars ${w.wars.list.length}, changed ${Math.round(changedKm2)} km²\n`);
  }
  const result: SeedResult = { seed, years, wallS: (performance.now() - t0) / 1000, landKm2, samples };
  writeFileSync(out, JSON.stringify(result));
}

main();
