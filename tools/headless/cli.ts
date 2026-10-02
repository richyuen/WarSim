// `npm run sim -- [--scenario toy|1938] [--seed 7] [--years 10] [--out run.json]`
// Runs a scenario headless in Node and writes per-year metrics JSON (SPEC §10, PLAN 0.20).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ScenarioId } from '../../src/shared/protocol';
import { runHeadless } from './runner';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const scenario = arg('scenario', 'toy') as ScenarioId;
const seed = Number(arg('seed', '7'));
const years = Number(arg('years', '10'));
const out = arg('out', `.cache/runs/${scenario}-seed${seed}-${years}y.json`);
if (scenario !== 'toy' && scenario !== '1938') throw new Error(`unknown scenario '${scenario}' (available: toy, 1938)`);
if (!Number.isInteger(seed) || !Number.isInteger(years) || years < 1) throw new Error('--seed and --years must be integers, years ≥ 1');

const result = runHeadless({
  scenario,
  seed,
  years,
  onYear: (m) =>
    console.log(
      `year ${String(m.year).padStart(3)}  tick ${m.tick}  hash ${m.hash.toString(16).padStart(8, '0')}  ` +
        `formations ${m.formations}  flipped ${m.cellsFlipped}  tick ms mean ${m.tickMs.mean.toFixed(4)} p95 ${m.tickMs.p95.toFixed(4)}  (${(m.wallMs / 1000).toFixed(2)} s)`,
    ),
});
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `done: ${years} years, ${(result.totalWallMs / 1000).toFixed(1)} s wall, mean tick ${result.meanTickMs.toFixed(4)} ms, ` +
    `final hash ${result.finalHash.toString(16).padStart(8, '0')} → ${out}`,
);
