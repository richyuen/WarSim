/**
 * `npm run sweep` (PLAN 1.40, SPEC §10): N seeds × Y years of the 1938 world in parallel child
 * processes, judged by tools/sweep/criteria.ts. Writes docs/sweeps/<date>-sweep.json and .md and
 * exits non-zero when any seed fails.
 *
 *   npm run sweep -- [--seeds 10] [--years 50] [--parallel 10] [--first 1] [--tag name] [--scratch]
 *
 * `--tag` names the report docs/sweeps/<date>-sweep-<tag>, so a second run on one day keeps the
 * first report. `--scratch` writes the report to .cache/sweep/reports instead (tuning runs:
 * `npm run sweep:quick` is 3 seeds × 20 years there; only the final sweep belongs in docs/).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALIVE_MAX, ALIVE_MIN, CHURN_MIN, judge, LEADER_SWING, MAX_INCOME, MAX_LAND, MOVING_MIN, WAR_YEARS, type Verdict } from './criteria';
import type { SeedResult } from './seed';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const seeds = arg('seeds', 10);
const years = arg('years', 50);
const first = arg('first', 1);
const tagAt = process.argv.indexOf('--tag');
const tag = tagAt >= 0 ? `-${(process.argv[tagAt + 1] ?? '').replace(/[^a-z0-9-]/gi, '')}` : '';
const parallel = Math.max(1, Math.min(arg('parallel', 10), os.cpus().length));
const outDir = path.join(ROOT, process.argv.includes('--scratch') ? '.cache/sweep/reports' : 'docs/sweeps');
const tmp = path.join(ROOT, '.cache/sweep');
mkdirSync(outDir, { recursive: true });
mkdirSync(tmp, { recursive: true });

function runSeed(seed: number): Promise<SeedResult> {
  const out = path.join(tmp, `seed-${seed}.json`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(ROOT, 'tools/sweep/seed.ts'), String(seed), String(years), out], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', (d: Buffer) => {
      const lines = d.toString().trim().split('\n');
      const last = lines.at(-1);
      if (last && /year (\d+)\//.test(last) && Number(/year (\d+)\//.exec(last)![1]) % 10 === 0) console.log(last);
    });
    child.on('exit', (code) => (code === 0 ? resolve(JSON.parse(readFileSync(out, 'utf8')) as SeedResult) : reject(new Error(`seed ${seed} exited ${code}`))));
  });
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const queue = Array.from({ length: seeds }, (_, i) => first + i);
  const results: SeedResult[] = [];
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let s = queue.shift(); s !== undefined; s = queue.shift()) results.push(await runSeed(s));
    }),
  );
  results.sort((a, b) => a.seed - b.seed);
  const verdicts = results.map(judge);
  const date = new Date().toISOString().slice(0, 10);
  const base = path.join(outDir, `${date}-sweep${tag}`);
  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
  const mark = (b: boolean): string => (b ? 'pass' : '**FAIL**');
  const rows = verdicts.map((v: Verdict) => `| ${v.seed} | ${pct(v.moving)} ${mark(v.pass.moving)} | ${pct(v.topLand)} ${mark(v.pass.land)} | ${pct(v.topIncome)} ${mark(v.pass.income)} | ${v.aliveMin}–${v.aliveMax} ${mark(v.pass.alive)} | ${pct(v.warYears)} ${mark(v.pass.war)} | ${v.churn} ${mark(v.pass.churn)} | ${pct(v.swing)} ${mark(v.pass.swing)} |`);
  const allOk = verdicts.every((v) => v.ok);
  const md = [
    `# Sweep ${date}: seeds ${first}–${first + seeds - 1} × ${years} years — ${allOk ? 'ALL GREEN' : 'FAILING'}`,
    '',
    `Criteria (SPEC §10, tools/sweep/criteria.ts): land changing controller in the last 5 years ≥ ${pct(MOVING_MIN)}; largest nation < ${pct(MAX_LAND)} of land and < ${pct(MAX_INCOME)} of income at the end; ${ALIVE_MIN}–${ALIVE_MAX} nations alive every year; a war active in ≥ ${pct(WAR_YEARS)} of the years; ≥ ${CHURN_MIN} of the ten largest land holders at the end were not among the ten largest after year 1; the largest nation's land share ranges over ≥ ${pct(LEADER_SWING)}.`,
    '',
    '| Seed | Land moving (last 5 y) | Largest land | Largest income | Alive (min–max) | Years with war | New in top 10 | Leader share range |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `Wall time ${((Date.now() - t0) / 60000).toFixed(1)} min with ${parallel} processes (per seed: ${results.map((r) => `${r.seed}: ${(r.wallS / 60).toFixed(1)} min`).join(', ')}).`,
    '',
  ].join('\n');
  writeFileSync(`${base}.md`, md);
  writeFileSync(`${base}.json`, JSON.stringify({ date, seeds, years, verdicts, results: results.map((r) => ({ seed: r.seed, wallS: r.wallS, landCells: r.landCells, samples: r.samples })) }, null, 1));
  console.log(md);
  if (!allOk) process.exitCode = 1;
}

void main();
