/**
 * Headless runner (PLAN 0.20, SPEC §10): runs a scenario in Node through the same `Sim`
 * facade as the worker and records per-year metrics. Used by `npm run sim`, soak and sweep.
 */
import type { ScenarioId } from '../../src/shared/protocol';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from './assets';
import type { World } from '../../src/sim/world';

export const TICKS_PER_YEAR = 24 * 365;

export interface HeadlessOptions {
  scenario: ScenarioId;
  seed: number;
  years: number;
  /** Called after each simulated year (progress output). */
  onYear?: (m: YearMetrics) => void;
  /** Wall-clock source (injectable for tests). */
  now?: () => number;
}

export interface NationYear {
  id: number;
  /** Cells controlled at year end. */
  controlled: number;
  /** Cells owned (rightful) at year end. */
  owned: number;
  formations: number;
  strength: number;
}

export interface YearMetrics {
  year: number;
  tick: number;
  hash: number;
  nations: NationYear[];
  formations: number;
  /** Cells whose controller changed during the year. */
  cellsFlipped: number;
  events: Record<string, number>;
  tickMs: { mean: number; p95: number; max: number };
  wallMs: number;
}

export interface HeadlessResult {
  scenario: ScenarioId;
  seed: number;
  years: number;
  ticksPerYear: number;
  map: [number, number];
  finalHash: number;
  totalWallMs: number;
  meanTickMs: number;
  yearly: YearMetrics[];
}

/** Event names for the metrics (EventKind keys, e.g. WarDeclared). */
const EVENT_NAMES: Record<number, string> = Object.fromEntries(Object.entries(EventKind).map(([k, v]) => [v, k]));

function nationStats(world: World): NationYear[] {
  const { owner, controller } = world.cells;
  const out: NationYear[] = [];
  const index = new Map<number, NationYear>();
  world.nations.forEach((id) => {
    const n: NationYear = { id, controlled: 0, owned: 0, formations: 0, strength: 0 };
    out.push(n);
    index.set(id, n);
  });
  for (let i = 0; i < controller.length; i++) {
    const c = index.get(controller[i]!);
    if (c) c.controlled++;
    const o = index.get(owner[i]!);
    if (o) o.owned++;
  }
  const f = world.formations;
  f.forEach((id) => {
    const n = index.get(f.cols.nation[id]!);
    if (!n) return;
    n.formations++;
    n.strength += f.cols.strength[id]!;
  });
  return out;
}

export function runHeadless(opts: HeadlessOptions): HeadlessResult {
  const now = opts.now ?? (() => performance.now());
  const sim = new Sim(opts.scenario === '1938' ? { scenario: '1938', seed: opts.seed, assets: loadAssets1938(SIZE_1938.w) } : { scenario: opts.scenario, seed: opts.seed });
  const world = sim.world;
  const yearly: YearMetrics[] = [];
  const start = now();
  const times = new Float64Array(TICKS_PER_YEAR);
  for (let y = 1; y <= opts.years; y++) {
    const y0 = now();
    const before = world.cells.controller.slice();
    const events: Record<string, number> = {};
    for (let t = 0; t < TICKS_PER_YEAR; t++) {
      const t0 = now();
      sim.step(1, (w) => {
        const ev = w.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          const name = EVENT_NAMES[ev[i + 1]!] ?? `kind${ev[i + 1]}`;
          events[name] = (events[name] ?? 0) + 1;
        }
        ev.length = 0;
        w.out.fires.length = 0;
      });
      times[t] = now() - t0;
    }
    let flipped = 0;
    const after = world.cells.controller;
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) flipped++;
    const sorted = Float64Array.from(times).sort();
    let sum = 0;
    for (const v of times) sum += v;
    const m: YearMetrics = {
      year: y,
      tick: world.tick,
      hash: sim.hash(),
      nations: nationStats(world),
      formations: world.formations.count,
      cellsFlipped: flipped,
      events,
      tickMs: { mean: sum / TICKS_PER_YEAR, p95: sorted[Math.floor(0.95 * TICKS_PER_YEAR)]!, max: sorted[TICKS_PER_YEAR - 1]! },
      wallMs: now() - y0,
    };
    yearly.push(m);
    opts.onYear?.(m);
  }
  const totalWallMs = now() - start;
  return {
    scenario: opts.scenario,
    seed: opts.seed,
    years: opts.years,
    ticksPerYear: TICKS_PER_YEAR,
    map: [world.cells.w, world.cells.h],
    finalHash: sim.hash(),
    totalWallMs,
    meanTickMs: yearly.reduce((a, m) => a + m.tickMs.mean, 0) / Math.max(1, yearly.length),
    yearly,
  };
}
