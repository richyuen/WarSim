/**
 * One sweep run (PLAN 1.40): the 1938 world on `seed` for `years`, sampled daily for war activity
 * and yearly for the SPEC §10 dynamism metrics. Writes one JSON result. Land is measured in km²,
 * not in cells (ADR-52): the map is a Miller projection.
 *
 *   tsx tools/sweep/seed.ts <seed> <years> <out.json> [size]
 */
import { writeFileSync } from 'node:fs';
import { isLand } from '../../src/shared/terrain';
import { landStandings } from '../../src/sim/landArea';
import { cellAreaByRow } from '../../src/sim/nav/grid';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { madWar } from '../../src/sim/systems/nuclear';
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
  /**
   * The nuclear year (PLAN 6.8): warheads held at its end and the nations holding them; the AI's
   * decisions to strike and the bursts (the history's); the most of the land under fallout on a
   * day, by area; the days of war between two sides each with an assured second strike (MAD).
   * Absent in the reports before it.
   */
  warheads?: number;
  nuclear?: number;
  decisions?: number;
  bursts?: number;
  falloutMax?: number;
  madDays?: number;
}

export interface SeedResult {
  seed: number;
  years: number;
  wallS: number;
  /** km² of all land cells. */
  landKm2: number;
  /**
   * km² per realm after year 1 and at the end, as [nation, km²], largest first (ADR-54: riser and
   * faller). A realm is a living nation with no overlord, with the land of its puppets.
   */
  realmStart: [number, number][];
  realmEnd: [number, number][];
  samples: YearSample[];
}

/**
 * Land per realm, largest first (ties by id). An overlord that integrates a puppet changes no
 * realm's land by that: the puppet's land was the realm's already.
 */
function realms(w: Sim['world'], area: Float64Array, living: readonly number[]): [number, number][] {
  const nc = w.nations.cols;
  const sum = new Map<number, number>();
  for (const n of living) {
    let root = n;
    // Up the chain of overlords (a dead overlord holds nobody).
    for (let hops = 0; hops < 8; hops++) {
      const o = nc.overlord[root]!;
      if (o === 0 || nc.living[o] !== 1) break;
      root = o;
    }
    sum.set(root, (sum.get(root) ?? 0) + area[n]!);
  }
  return [...sum]
    .filter(([, km2]) => km2 > 0)
    .map(([n, km2]): [number, number] => [n, Math.round(km2)])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

function main(): void {
  const [seedArg, yearsArg, out, size] = process.argv.slice(2);
  const seed = Number(seedArg);
  const years = Number(yearsArg);
  if (!Number.isFinite(seed) || !Number.isFinite(years) || !out) throw new Error('usage: seed.ts <seed> <years> <out.json>');
  const t0 = performance.now();
  // At the map size asked (PLAN 7.1b9): the scenario's own when none is.
  const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(size).w), ...(size ? { options: { size } } : {}) });
  const w = sim.world;
  const land: number[] = [];
  for (let c = 0; c < w.cells.terrain.length; c++) if (isLand(w.cells.terrain[c]!)) land.push(c);
  const rowArea = cellAreaByRow(w.cells.w, w.cells.h);
  const areaOf = (c: number): number => rowArea[Math.floor(c / w.cells.w)]!;
  const landKm2 = land.reduce((s, c) => s + areaOf(c), 0);
  const samples: YearSample[] = [];
  let realmStart: [number, number][] = [];
  let realmEnd: [number, number][] = [];
  for (let y = 0; y < years; y++) {
    const before = Uint16Array.from(land, (c) => w.cells.controller[c]!);
    const logFrom = w.history.rows.length;
    let warDays = 0;
    let falloutMax = 0;
    let madDays = 0;
    for (let d = 0; d < 365; d++) {
      sim.step(24);
      if (w.wars.list.length > 0) warDays++;
      if (w.wars.list.some((x) => madWar(w, x))) madDays++;
      if (w.fallout.size > 0) {
        let km2 = 0;
        for (const c of w.fallout.keys()) if (isLand(w.cells.terrain[c]!)) km2 += areaOf(c);
        falloutMax = Math.max(falloutMax, km2 / landKm2);
      }
    }
    let decisions = 0;
    let bursts = 0;
    for (let i = logFrom; i < w.history.rows.length; i += HISTORY_STRIDE) {
      if (w.history.rows[i + 1] === EventKind.NukeDecided) decisions++;
      if (w.history.rows[i + 1] === EventKind.NukeCasualties) bursts++;
    }
    let warheads = 0;
    let nuclear = 0;
    for (const h of w.warheads.values()) {
      warheads += h.stock;
      if (h.stock > 0) nuclear++;
    }
    const nc = w.nations.cols;
    const { area, owned, ranked } = landStandings(w);
    const top = ranked[0] ?? 0;
    realmEnd = realms(w, area, ranked);
    if (y === 0) realmStart = realmEnd;
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
    samples.push({ year: y + 1, alive: ranked.length, topLand: owned > 0 ? area[top]! / owned : 0, topIncome: income > 0 ? topIncome / income : 0, topNation: top, top10: ranked.slice(0, 10), wars: w.wars.list.length, warDays, changedKm2, warheads, nuclear, decisions, bursts, falloutMax, madDays });
    process.stdout.write(`seed ${seed} year ${y + 1}/${years}: alive ${ranked.length}, top land ${(samples.at(-1)!.topLand * 100).toFixed(1)}%, wars ${w.wars.list.length}, changed ${Math.round(changedKm2)} km², warheads ${warheads} (${nuclear} nations), strikes ${bursts}, MAD days ${madDays}, fallout ${(falloutMax * 100).toFixed(2)}%\n`);
  }
  const result: SeedResult = { seed, years, wallS: (performance.now() - t0) / 1000, landKm2, realmStart, realmEnd, samples };
  writeFileSync(out, JSON.stringify(result));
}

main();
