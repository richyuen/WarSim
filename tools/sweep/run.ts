/**
 * `npm run sweep` (PLAN 1.40, SPEC §10): N seeds × Y years of the 1938 world in parallel child
 * processes, judged by tools/sweep/criteria.ts (ADR-54). Writes docs/sweeps/<date>-sweep.json
 * and .md and exits non-zero when the sweep fails.
 *
 *   npm run sweep -- [--seeds 10] [--years 50] [--parallel 10] [--first 1] [--tag name] [--scratch] [--size S|M|L]
 *   npm run sweep -- --from docs/sweeps/<report>.json [--tag name] [--scratch]
 *
 * `--tag` names the report docs/sweeps/<date>-sweep-<tag>, so a second run on one day keeps the
 * first report. `--scratch` writes the report to .cache/sweep/reports instead (tuning runs:
 * `npm run sweep:quick` is 10 seeds × 20 years there; only the final sweep belongs in docs/).
 * Runs shorter than 50 years are judged by the five limits alone; riser, faller, stasis and
 * break-up are reported. `--from` judges the runs of a written report again by today's criteria
 * (PLAN 7.3a) instead of running any: seeds, years and wall times are the report's.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TAGS_1938 } from '../../src/sim/scenario1938';
import { ALIVE_MAX, ALIVE_MIN, BREAKUP_RISE, BREAKUP_YEARS, DYNAMISM_QUORUM, STASIS_YEARS, FALLOUT_MAX_LAND, NUKES_USED_SEEDS, DYNAMISM_YEARS, FALLER_KEPT, judge, judgeSweep, MAX_INCOME, MAX_LAND, MOVING_MIN, ratio, RISER_GROWTH, RISER_MIN_SHARE, WAR_YEARS, type LandChange, type Verdict } from './criteria';
import type { SeedResult } from './seed';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const fromAt = process.argv.indexOf('--from');
const fromPath = path.resolve(fromAt >= 0 ? (process.argv[fromAt + 1] ?? '') : '');
const from = fromAt >= 0 ? (JSON.parse(readFileSync(fromPath, 'utf8')) as { years: number; results: SeedResult[] }) : null;
const years = from ? from.years : arg('years', 50);
const seeds = from ? from.results.length : arg('seeds', 10);
const first = from ? Math.min(...from.results.map((r) => r.seed)) : arg('first', 1);
/** The map's size (PLAN 7.1b9): the scenario's own when not given. */
const sizeAt = process.argv.indexOf('--size');
const size = sizeAt >= 0 ? (process.argv[sizeAt + 1] ?? '') : '';
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
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(ROOT, 'tools/sweep/seed.ts'), String(seed), String(years), out, ...(size ? [size] : [])], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
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
  const results: SeedResult[] = from ? from.results.map((r) => ({ ...r, years })) : [];
  if (!from) {
    await Promise.all(
      Array.from({ length: parallel }, async () => {
        for (let s = queue.shift(); s !== undefined; s = queue.shift()) results.push(await runSeed(s));
      }),
    );
  }
  results.sort((a, b) => a.seed - b.seed);
  const verdicts = results.map(judge);
  const sweep = judgeSweep(verdicts, years);
  const date = new Date().toISOString().slice(0, 10);
  const base = path.join(outDir, `${date}-sweep${tag}`);
  const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
  const mark = (b: boolean): string => (b ? 'pass' : '**FAIL**');
  // Riser and faller are marked per seed only when the runs are long enough to be judged by them.
  const dyn = (b: boolean): string => (sweep.judged ? ` ${b ? 'yes' : '**no**'}` : '');
  const mkm = (km2: number): string => (km2 / 1e6).toFixed(2);
  const change = (c: LandChange | null): string => (c ? `${TAGS_1938[c.nation - 1] ?? `#${c.nation}`} × ${ratio(c).toFixed(2)} (${mkm(c.from)} → ${mkm(c.to)})` : 'none');
  const rows = verdicts.map((v: Verdict) => `| ${v.seed} | ${pct(v.moving)} ${mark(v.pass.moving)} | ${pct(v.topLand)} ${mark(v.pass.land)} | ${pct(v.topIncome)} ${mark(v.pass.income)} | ${v.aliveMin}–${v.aliveMax} ${mark(v.pass.alive)} | ${pct(v.warYears)} ${mark(v.pass.war)} | ${change(v.riser)}${dyn(v.pass.riser)} | ${change(v.faller)}${dyn(v.pass.faller)} | ${v.stasis} y${dyn(v.pass.stasis)} | × ${v.breakup.toFixed(2)}${dyn(v.pass.breakup)} | ${v.churn} | ${pct(v.swing)} |`);
  const n = verdicts.length;
  // The nuclear years (PLAN 6.8).
  const startYear = 1938;
  const nukeRows = results.map((r) => {
    const s = r.samples;
    const firstBomb = s.find((y) => (y.warheads ?? 0) > 0);
    const sum = (k: 'decisions' | 'bursts' | 'madDays'): number => s.reduce((t, y) => t + (y[k] ?? 0), 0);
    const fallout = s.reduce((m, y) => Math.max(m, y.falloutMax ?? 0), 0);
    const last = s.at(-1);
    return { seed: r.seed, firstBomb: firstBomb ? startYear + firstBomb.year - 1 : null, warheads: last?.warheads ?? 0, nuclear: last?.nuclear ?? 0, decisions: sum('decisions'), bursts: sum('bursts'), madDays: sum('madDays'), fallout };
  });
  const used = nukeRows.filter((r) => r.bursts > 0).length;
  const worstFallout = nukeRows.reduce((m, r) => Math.max(m, r.fallout), 0);
  const nukesOk = used >= NUKES_USED_SEEDS && worstFallout <= FALLOUT_MAX_LAND;
  const nukeTable = [
    '## Nuclear weapons (PLAN 6.8)',
    '',
    '| Seed | First warhead | Warheads at the end (nations) | AI decisions | Bursts | Most land under fallout | Days of war under MAD |',
    '|---|---|---|---|---|---|---|',
    ...nukeRows.map((r) => `| ${r.seed} | ${r.firstBomb ?? 'none'} | ${r.warheads} (${r.nuclear}) | ${r.decisions} | ${r.bursts} | ${(r.fallout * 100).toFixed(2)}% | ${r.madDays} |`),
    '',
    `Nukes used in ${used} of ${n} seeds (at least ${NUKES_USED_SEEDS}: ${mark(used >= NUKES_USED_SEEDS)}); the most land under fallout on a day ${(worstFallout * 100).toFixed(2)}% (at most ${pct(FALLOUT_MAX_LAND)}: ${mark(worstFallout <= FALLOUT_MAX_LAND)}).`,
    '',
  ];
  const status = !sweep.limits ? 'FAILING (limits)' : !sweep.judged ? `LIMITS GREEN (dynamism not judged: runs shorter than ${DYNAMISM_YEARS} years)` : sweep.ok ? 'ALL GREEN' : 'FAILING (dynamism)';
  const md = [
    `# Sweep ${date}: seeds ${first}–${first + seeds - 1} × ${years} years${size ? `, map size ${size}` : ''} — ${status}`,
    ...(from ? ['', `Judged again from \`${path.relative(ROOT, fromPath).split(path.sep).join('/')}\` (no run).`] : []),
    '',
    `Criteria (SPEC §10, tools/sweep/criteria.ts, ADR-54; land by area in km², ADR-52). Limits, every seed: land changing controller in the last 5 years ≥ ${pct(MOVING_MIN)}; largest nation < ${pct(MAX_LAND)} of land and < ${pct(MAX_INCOME)} of income at the end; ${ALIVE_MIN}–${ALIVE_MAX} nations alive every year; a war active in ≥ ${pct(WAR_YEARS)} of the years. Dynamism, by realm (a nation with no overlord, with its puppets' land), each in ≥ ${pct(DYNAMISM_QUORUM)} of the seeds of runs of ≥ ${DYNAMISM_YEARS} years: a riser (a realm ending with ≥ ${pct(RISER_MIN_SHARE)} of the land and ≥ ${RISER_GROWTH} × its land after year 1) and a faller (one of the ten largest realms after year 1 ending with ≤ ${pct(FALLER_KEPT)} of its land then); no break-up (the living nations never more than ${BREAKUP_RISE} × the most they were ${BREAKUP_YEARS} years or more before; ADR-428). Reported, not judged: stasis (the longest run of the same five largest by land, as a set; ✓ under ${STASIS_YEARS} years; ADR-750) and the last two columns.`,
    '',
    '| Seed | Land moving (last 5 y) | Largest land | Largest income | Alive (min–max) | Years with war | Largest riser (realm, M km²) | Largest faller (realm, M km²) | One top five (longest) | Alive over the most 20 y before | New in top 10 | Leader share range |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `Limits: ${verdicts.filter((v) => v.limits).length} of ${n} seeds. Riser: ${sweep.risers} of ${n}. Faller: ${sweep.fallers} of ${n}. No stasis (reported): ${sweep.changing} of ${n}. No break-up: ${sweep.together} of ${n}.${sweep.judged ? ` Needed: ${sweep.needed} of ${n} each.` : ` Not judged at ${years} years.`}`,
    '',
    ...nukeTable,
    `Wall time ${((from ? Math.max(...results.map((r) => r.wallS)) * 1000 : Date.now() - t0) / 60000).toFixed(1)} min${from ? ' (the report’s longest seed)' : ''} with ${parallel} processes (per seed: ${results.map((r) => `${r.seed}: ${(r.wallS / 60).toFixed(1)} min`).join(', ')}).`,
    '',
  ].join('\n');
  writeFileSync(`${base}.md`, md);
  writeFileSync(`${base}.json`, JSON.stringify({ date, seeds, years, sweep, verdicts, results: results.map((r) => ({ seed: r.seed, wallS: r.wallS, landKm2: r.landKm2, realmStart: r.realmStart, realmEnd: r.realmEnd, samples: r.samples })) }, null, 1));
  console.log(md);
  if (!sweep.ok || !nukesOk) process.exitCode = 1;
}

void main();
