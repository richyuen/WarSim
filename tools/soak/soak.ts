/**
 * The soak (PLAN 7.2a, SPEC §10): two twins of one game run side by side at full speed in Node.
 * Twin A is never touched. Twin B is saved every `intervalMs` of the wall as the game's autosave
 * saves (the state's bytes, gzipped), and the file is loaded into a fresh Sim made with another
 * seed, as a page that resumes an autosave builds its game and then loads; save → load → save must
 * give the same bytes (I5). The twins' hashes are compared every `compareDays` days, after every
 * load and at the end: one apart, or any exception, fails the soak. Not every day by default: a
 * hash of the 1938 state takes 80 ms, more than the day's ticks (50 to 150 ms in 1938).
 */
import type { ScenarioAssets, ScenarioId } from '../../src/shared/protocol';
import { packSave, unpackSave } from '../../src/shared/saveCodec';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

export const TICKS_PER_DAY = 24;
/** The hashes are compared every this many days by default. */
export const COMPARE_DAYS = 30;

export interface SoakOptions {
  scenario: ScenarioId;
  seed: number;
  /** How long the soak runs, ms of the wall. */
  durationMs: number;
  /** Twin B is saved and loaded each time this much of the wall has passed, ms. */
  intervalMs: number;
  /** The hashes are compared every this many days (default `COMPARE_DAYS`). */
  compareDays?: number;
  /** The random world: how many nations (absent: its default). */
  nations?: number;
  /** The map's size, an id of the earth map's sizes (absent: the scenario's own). */
  size?: string;
  /** Wall-clock source (injectable for tests). */
  now?: () => number;
  /** Called after each save and load. */
  onSave?: (s: SoakSave) => void;
  /** Called after each day with both twins (the hashes are compared after these). */
  onDay?: (a: Sim, b: Sim) => void;
  /** Called with the fresh twin B after each load (a test parts the twins here). */
  afterLoad?: (b: Sim) => void;
}

export interface SoakSave {
  /** 1-based count of the saves. */
  n: number;
  tick: number;
  hash: number;
  /** The state's bytes and its gzip file. */
  rawBytes: number;
  gzipBytes: number;
  /** ms of the wall the save, the gzip both ways and the load took. */
  ms: number;
}

export interface SoakResult {
  scenario: ScenarioId;
  seed: number;
  ok: boolean;
  /** Why it failed: the exception's message, or the hashes apart. */
  failure?: string;
  /** The tick at which the twins' hashes were first seen to differ. */
  apartAt?: number;
  /** Ticks run by each twin (since the scenario's first). */
  ticks: number;
  years: number;
  saves: SoakSave[];
  finalHash: number;
  wallMs: number;
}

const assetsBySize = new Map<number, ScenarioAssets>();

/** The map's assets, read once a size (7 s of a fresh 1938 Sim's 7.5 s is reading them). */
function assets(w: number): ScenarioAssets {
  let a = assetsBySize.get(w);
  if (!a) assetsBySize.set(w, (a = loadAssets1938(w)));
  return a;
}

function makeSim(opts: SoakOptions, seed: number): Sim {
  const options = { ...(opts.nations !== undefined ? { nations: opts.nations } : {}), ...(opts.size !== undefined ? { size: opts.size } : {}) };
  const sim = new Sim(opts.scenario !== 'toy' ? { scenario: opts.scenario, seed, assets: assets(size1938(opts.size).w), ...(Object.keys(options).length > 0 ? { options } : {}) } : { scenario: opts.scenario, seed });
  lanes(sim);
  return sim;
}

/** The lane graph before the clock, as the game's worker builds it before the first tick and after a load. */
function lanes(sim: Sim): void {
  if (sim.world.ports.length > 0 && sim.world.seaSeeds.length > 0) laneOf(sim.world);
}

/** One day of a twin, its events and fires dropped each tick as the headless runner does. */
function day(sim: Sim): void {
  sim.step(TICKS_PER_DAY, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
}

function sameBytes(x: Uint8Array, y: Uint8Array): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

const hex = (h: number): string => h.toString(16).padStart(8, '0');

export async function runSoak(opts: SoakOptions): Promise<SoakResult> {
  const now = opts.now ?? (() => performance.now());
  const start = now();
  const saves: SoakSave[] = [];
  const a = makeSim(opts, opts.seed);
  let b = makeSim(opts, opts.seed);
  const first = a.tick;
  const result = (ok: boolean, extra: Partial<SoakResult> = {}): SoakResult => ({
    scenario: opts.scenario,
    seed: opts.seed,
    ok,
    ticks: a.tick - first,
    years: (a.tick - first) / (TICKS_PER_DAY * 365),
    saves,
    finalHash: a.hash(),
    wallMs: now() - start,
    ...extra,
  });
  const apart = (when: string): SoakResult | undefined => {
    const [ha, hb] = [a.hash(), b.hash()];
    if (ha === hb) return undefined;
    return result(false, { failure: `${when}: twin A ${hex(ha)}, twin B ${hex(hb)}`, apartAt: a.tick });
  };
  try {
    const every = opts.compareDays ?? COMPARE_DAYS;
    let lastSave = start;
    for (let days = 1; now() - start < opts.durationMs; days++) {
      day(a);
      day(b);
      opts.onDay?.(a, b);
      const ending = now() - start >= opts.durationMs;
      if (days % every === 0 || ending) {
        const seen = apart(`tick ${a.tick}`);
        if (seen) return seen;
      }
      if (now() - lastSave < opts.intervalMs) continue;
      const t0 = now();
      const bytes = b.save();
      const file = await packSave(bytes);
      const fresh = makeSim(opts, opts.seed + 1);
      fresh.load(await unpackSave(file));
      if (!sameBytes(fresh.save(), bytes)) return result(false, { failure: `save ${saves.length + 1} at tick ${b.tick}: save → load → save gave other bytes` });
      b = fresh;
      lanes(b);
      opts.afterLoad?.(b);
      const s: SoakSave = { n: saves.length + 1, tick: b.tick, hash: b.hash(), rawBytes: bytes.length, gzipBytes: file.length, ms: now() - t0 };
      saves.push(s);
      opts.onSave?.(s);
      const loaded = apart(`after the load of save ${s.n} at tick ${b.tick}`);
      if (loaded) return loaded;
      lastSave = now();
    }
  } catch (err) {
    return result(false, { failure: `tick ${a.tick}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}` });
  }
  return result(true);
}
