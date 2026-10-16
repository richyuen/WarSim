// `npm run soak -- [--scenario 1938|toy|random] [--nations 60] [--size S|M|L|XL] [--seed 99] [--minutes 30] [--interval 5] [--compare 30] [--out soak.json] [--affinity 0xFFFF]`
// The soak (PLAN 7.2a, SPEC §10): two twins of one game for `--minutes` of the wall, twin B saved,
// gzipped and loaded into a fresh Sim every `--interval` minutes, the hashes compared every
// `--compare` days, after each load and at the end.
// Exits 1 on an exception or a desync; the report is JSON (`--out`).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ScenarioId } from '../../src/shared/protocol';
import { parseAffinity, pinProcess } from '../headless/affinity';
import { COMPARE_DAYS, runSoak } from './soak';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const scenario = arg('scenario', '1938') as ScenarioId;
const seed = Number(arg('seed', '99'));
const minutes = Number(arg('minutes', '30'));
const interval = Number(arg('interval', '5'));
const compare = Number(arg('compare', String(COMPARE_DAYS)));
const nations = arg('nations', '');
const size = arg('size', '');
const out = arg('out', `.cache/soak/${scenario}-seed${seed}-${minutes}min.json`);
const affinity = arg('affinity', '');
if (scenario !== 'toy' && scenario !== '1938' && scenario !== 'random') throw new Error(`unknown scenario '${scenario}' (available: toy, 1938, random)`);
if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
if (!(minutes > 0) || !(interval > 0)) throw new Error('--minutes and --interval must be above 0');
if (!Number.isInteger(compare) || compare < 1) throw new Error('--compare must be an integer ≥ 1');
if (affinity) {
  const mask = parseAffinity(affinity);
  pinProcess(mask);
  console.log(`pinned to CPUs 0x${mask.toString(16)}`);
}

const hex = (h: number): string => h.toString(16).padStart(8, '0');
console.log(`soak: ${scenario} seed ${seed}, ${minutes} min, a save and load every ${interval} min, the twins compared every ${compare} days`);
const result = await runSoak({
  scenario,
  seed,
  durationMs: minutes * 60_000,
  intervalMs: interval * 60_000,
  compareDays: compare,
  ...(nations ? { nations: Number(nations) } : {}),
  ...(size ? { size } : {}),
  onSave: (s) =>
    console.log(
      `save ${String(s.n).padStart(2)}  tick ${s.tick}  year ${(s.tick / (24 * 365)).toFixed(2)}  hash ${hex(s.hash)}  ` +
        `${(s.rawBytes / 1e6).toFixed(1)} MB → ${(s.gzipBytes / 1e6).toFixed(1)} MB gzip  ${(s.ms / 1000).toFixed(1)} s`,
    ),
});
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) console.error(`soak FAILED: ${result.failure}`);
console.log(
  `done: ${result.ok ? 'green' : 'RED'}, ${result.years.toFixed(2)} years (${result.ticks} ticks) in ${(result.wallMs / 60_000).toFixed(1)} min, ` +
    `${result.saves.length} saves and loads, final hash ${hex(result.finalHash)} → ${out}`,
);
process.exitCode = result.ok ? 0 : 1;
