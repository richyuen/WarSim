// `npm run sim -- [--scenario toy|1938|random] [--nations 60] [--seed 7] [--years 10] [--out run.json] [--save state.bin] [--load state.bin] [--affinity 0xFFFF] [--profile]`
// Runs a scenario headless in Node and writes per-year metrics JSON (SPEC §10, PLAN 0.20).
// Checkpoints: `--save` writes the final state; `--load` continues from one (saves are
// bit-identical, so years 11–20 from a year-10 checkpoint equal years 11–20 of a 20-year run:
// that was not so until PLAN 2.12, and `tests/helpers/aiSweep.ts` now holds a year of it).
// Timings: `--affinity <mask>` pins the run to those CPUs (see `affinity.ts`); a tick time
// measured for a budget is measured that way. `--profile` prints each year's tick by system
// (mean ms a tick, its share, the longest call, the calls of 1 ms or more and their ms a tick).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ScenarioId } from '../../src/shared/protocol';
import { parseAffinity, pinProcess } from './affinity';
import { runHeadless } from './runner';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const scenario = arg('scenario', 'toy') as ScenarioId;
const seed = Number(arg('seed', '7'));
const years = Number(arg('years', '10'));
const nations = arg('nations', '');
const out = arg('out', `.cache/runs/${scenario}-seed${seed}-${years}y.json`);
const save = arg('save', '');
const load = arg('load', '');
const affinity = arg('affinity', '');
const profile = process.argv.includes('--profile');
if (load && !existsSync(load)) throw new Error(`--load: no file '${load}'`);
if (scenario !== 'toy' && scenario !== '1938' && scenario !== 'random') throw new Error(`unknown scenario '${scenario}' (available: toy, 1938, random)`);
if (!Number.isInteger(seed) || !Number.isInteger(years) || years < 1) throw new Error('--seed and --years must be integers, years ≥ 1');
if (affinity) {
  const mask = parseAffinity(affinity);
  pinProcess(mask);
  console.log(`pinned to CPUs 0x${mask.toString(16)}`);
}

const result = runHeadless({
  scenario,
  seed,
  years,
  profile,
  ...(nations ? { nations: Number(nations) } : {}),
  ...(load ? { load: new Uint8Array(readFileSync(load)) } : {}),
  ...(save
    ? {
        onSave: (bytes: Uint8Array) => {
          mkdirSync(path.dirname(path.resolve(save)), { recursive: true });
          writeFileSync(save, bytes);
        },
      }
    : {}),
  onYear: (m) => {
    console.log(
      `year ${String(m.year).padStart(3)}  tick ${m.tick}  hash ${m.hash.toString(16).padStart(8, '0')}  nations ${m.living}  ` +
        `formations ${m.formations}  flipped ${m.cellsFlipped}  tick ms mean ${m.tickMs.mean.toFixed(4)} p95 ${m.tickMs.p95.toFixed(4)}  (${(m.wallMs / 1000).toFixed(2)} s)`,
    );
    if (!m.systems) return;
    const total = m.systems.reduce((a, s) => a + s.ms, 0);
    for (const s of [...m.systems].sort((a, b) => b.ms - a.ms))
      console.log(
        `  ${s.name.padEnd(14)} ${s.ms.toFixed(4)} ms  ${((100 * s.ms) / total).toFixed(1).padStart(5)} %  max ${s.max.toFixed(1).padStart(7)}  ` +
          `slow ${String(s.slow).padStart(5)} calls ${s.slowMs.toFixed(4)} ms`,
      );
  },
});
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `done: ${years} years, ${(result.totalWallMs / 1000).toFixed(1)} s wall, mean tick ${result.meanTickMs.toFixed(4)} ms, ` +
    `final hash ${result.finalHash.toString(16).padStart(8, '0')} → ${out}`,
);
