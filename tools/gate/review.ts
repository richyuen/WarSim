/**
 * `npm run check:review`: the phase review's full run (ADR-297, the user's decision), every stage
 * of `npm run check:full` on its own, recorded so that the commit that ticks the review need not
 * run it again.
 *
 * Each step runs whatever the one before it did: a red stage does not stop the run. The browser
 * suite runs in chunks of `E2E_CHUNK` spec files and the perf spec on its own project. A unit,
 * sweep or browser test that fails is run again alone (its file, one worker) once; red is what
 * fails both times. Each step's result is written to `.cache/gate/review.json` under the code key
 * as soon as it is done, so a run cut off goes on where it stopped (`npm run check:review` again).
 *
 * The code key (`codeTree`) is the tree a commit of the working tree would have without the
 * documents (Markdown, `docs/`), `critic/` and the list of known reds: a commit that changes only
 * those is proved by the record. The verdict (`judge`) is taken against the list of known reds
 * as it is when it is read (`tools/gate/knownRed.json`, the failures of BLOCKERS that are this
 * machine's and not the code's): green when every step is done and every red test is on it.
 * `npm run check` reads it for a commit that ticks a phase review (`reviewProven`).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, '.cache/gate');
export const RECORD = path.join(DIR, 'review.json');
export const KNOWN = 'tools/gate/knownRed.json';
/** Spec files of the chromium project a chunk of the browser suite runs (about 40 minutes here). */
export const E2E_CHUNK = 20;

export interface StepRecord {
  /** The tests red twice, or `stage:<step>` for a step that failed with no test to name. */
  red: string[];
  at: string;
}

export interface ReviewRecord {
  key: string;
  steps: string[];
  done: Record<string, StepRecord>;
}

export interface Verdict {
  green: boolean;
  missing: string[];
  /** Red tests not on the list of known reds. */
  unknown: string[];
  known: string[];
}

/** The steps of a run: the plain stages, the unit and sweep tests, a chunk of specs each, the perf spec. */
export function reviewSteps(specs: number): string[] {
  const e2e = Array.from({ length: Math.ceil(specs / E2E_CHUNK) }, (_, i) => `e2e:${i + 1}`);
  return ['typecheck', 'lint', 'build', 'parity', 'test', 'test:sweep', ...e2e, 'e2e:perf'];
}

/** The verdict of `record` against the known reds `known` (ids of tests). */
export function judge(record: ReviewRecord, known: readonly string[]): Verdict {
  const missing = record.steps.filter((s) => !(s in record.done));
  const red = record.steps.flatMap((s) => record.done[s]?.red ?? []);
  const list = new Set(known);
  const unknown = red.filter((t) => !list.has(t));
  return { green: missing.length === 0 && unknown.length === 0, missing, unknown, known: red.filter((t) => list.has(t)) };
}

/** Whether a file is left out of the code key: a document, the critic's output, the list of known reds. */
export function outOfKey(file: string): boolean {
  return file.endsWith('.md') || file.startsWith('docs/') || file.startsWith('critic/') || file === KNOWN;
}

/** A file red with no test of it red (it failed to load, or a hook threw): its id is `<file> › (the file)` (PLAN 5.8p). */
export const FILE_RED = '(the file)';

/** The ids of the tests red in a vitest JSON report: `<file> › <full name>`; a file failed with no failed test, `<file> › (the file)`. */
export function vitestRed(report: { testResults?: { name: string; status?: string; assertionResults?: { fullName: string; status: string }[] }[] }): string[] {
  const out: string[] = [];
  for (const f of report.testResults ?? []) {
    const file = path.relative(ROOT, f.name).split(path.sep).join('/');
    const before = out.length;
    for (const a of f.assertionResults ?? []) if (a.status === 'failed') out.push(`${file} › ${a.fullName}`);
    if (out.length === before && f.status === 'failed') out.push(`${file} › ${FILE_RED}`);
  }
  return out;
}

interface PwSuite {
  title: string;
  file?: string;
  suites?: PwSuite[];
  specs?: { title: string; ok: boolean; file: string }[];
}

/**
 * The ids of the tests red in a Playwright JSON report: `tests/e2e/<file> › <describe › … › title>`;
 * an error of the run outside every test (a spec that fails to load), `tests/e2e/<file> › (the
 * file)` where it names its file, else `stage:playwright` (PLAN 5.8p).
 */
export function playwrightRed(report: { suites?: PwSuite[]; errors?: { location?: { file?: string } }[] }): string[] {
  const out: string[] = [];
  const walk = (s: PwSuite, titles: string[]): void => {
    for (const spec of s.specs ?? []) if (!spec.ok) out.push(`tests/e2e/${spec.file} › ${[...titles, spec.title].join(' › ')}`);
    for (const c of s.suites ?? []) walk(c, [...titles, c.title]);
  };
  // A file's suite is titled by its path: not a title of the test.
  for (const f of report.suites ?? []) walk(f, []);
  for (const e of report.errors ?? []) {
    const at = e.location?.file;
    const id = at ? `${path.relative(ROOT, path.resolve(ROOT, 'tests/e2e', at)).split(path.sep).join('/')} › ${FILE_RED}` : 'stage:playwright';
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** A run's red ids, with one for the run itself where it failed and named no red (PLAN 5.8p: a non-zero exit is red). */
export function runRed(red: string[], ok: boolean, stage: string): string[] {
  return ok || red.length > 0 ? red : [`stage:${stage}`];
}

/** The file of a test id. */
const fileOf = (id: string): string => id.split(' › ')[0]!;

const git = (args: string[], env?: NodeJS.ProcessEnv, cwd = ROOT): string | null => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: env ?? process.env });
  return r.status === 0 && !r.error ? r.stdout.trim() : null;
};

/** The code key of the working tree of the repository at `root` (see the head of the file), or null when git cannot tell. */
export function codeTree(root = ROOT): string | null {
  const dir = path.join(root, '.cache/gate');
  mkdirSync(dir, { recursive: true });
  const index = path.join(dir, 'index-review');
  const real = git(['rev-parse', '--git-path', 'index'], undefined, root);
  try {
    // From the real index, so files that did not change are not hashed again.
    if (real === null) throw new Error();
    copyFileSync(path.resolve(root, real), index);
  } catch {
    rmSync(index, { force: true });
  }
  const env = { ...process.env, GIT_INDEX_FILE: index };
  if (git(['add', '-A', '--', '.', ':!critic'], env, root) === null) return null;
  // Out of the key: the documents, the critic's files (tracked ones are in the index copied: PLAN
  // 5.8q) and the list of known reds (`git rm` from the scratch index alone).
  if (git(['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', '*.md', 'docs', 'critic', KNOWN], env, root) === null) return null;
  return git(['write-tree'], env, root);
}

export function readRecord(): ReviewRecord | null {
  try {
    return JSON.parse(readFileSync(RECORD, 'utf8')) as ReviewRecord;
  } catch {
    return null;
  }
}

export function knownRed(): string[] {
  try {
    return (JSON.parse(readFileSync(path.join(ROOT, KNOWN), 'utf8')) as { tests: { id: string }[] }).tests.map((t) => t.id);
  } catch {
    return [];
  }
}

/** Whether a green run of `check:review` proves the code of the working tree (for `npm run check`). */
export function reviewProven(): { proven: boolean; why: string } {
  const record = readRecord();
  const key = codeTree();
  if (record === null || key === null || record.key !== key) return { proven: false, why: 'no run of npm run check:review on this code' };
  const v = judge(record, knownRed());
  if (!v.green) return { proven: false, why: v.missing.length > 0 ? `npm run check:review not finished (${v.missing.join(', ')})` : `red not on ${KNOWN}: ${v.unknown.join('; ')}` };
  return { proven: true, why: `npm run check:review green on this code (${v.known.length} known red)` };
}

const specFiles = (): string[] =>
  readdirSync(path.join(ROOT, 'tests/e2e'))
    .filter((f) => f.endsWith('.spec.ts') && !f.endsWith('.perf.spec.ts'))
    .sort()
    .map((f) => `tests/e2e/${f}`);

function run(command: string, env?: NodeJS.ProcessEnv): boolean {
  console.log(`review: ${command}`);
  return spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...env } }).status === 0;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** A vitest run (`config` '' for the unit tests) of `files` (all when empty): its red ids, or null when it wrote no report. */
function vitest(config: string, files: string[], stage: string): string[] | null {
  const out = path.join(DIR, 'vitest.json');
  rmSync(out, { force: true });
  const ok = run(`npx vitest run ${config} --reporter=default --reporter=json --outputFile=${out} ${files.join(' ')}`);
  const r = readJson<Parameters<typeof vitestRed>[0]>(out);
  return r === null ? null : runRed(vitestRed(r), ok, stage);
}

/** A Playwright run: its red ids, or null when it wrote no report. */
function playwright(args: string, stage: string): string[] | null {
  const out = path.join(DIR, 'playwright.json');
  rmSync(out, { force: true });
  const ok = run(`npx playwright test ${args} --reporter=line,json`, { PLAYWRIGHT_JSON_OUTPUT_NAME: out });
  const r = readJson<Parameters<typeof playwrightRed>[0]>(out);
  return r === null ? null : runRed(playwrightRed(r), ok, stage);
}

/** Red twice: the ids of `first` still red when each of their files is run again alone. */
function again(first: string[], rerun: (file: string) => string[] | null): string[] {
  // A run's own failure is no file's to run again: red as it stands.
  const red: string[] = first.filter((t) => t.startsWith('stage:'));
  for (const file of [...new Set(first.filter((t) => !t.startsWith('stage:')).map(fileOf))]) {
    const second = rerun(file);
    for (const id of first.filter((t) => fileOf(t) === file)) if (second === null || second.includes(id)) red.push(id);
  }
  return red;
}

function step(name: string, specs: string[]): string[] {
  if (['typecheck', 'lint', 'build', 'parity'].includes(name)) return run(`npm run ${name}`) ? [] : [`stage:${name}`];
  if (name === 'test' || name === 'test:sweep') {
    const config = name === 'test' ? '' : '--config vitest.sweep.config.ts';
    const first = vitest(config, [], name);
    if (first === null) return [`stage:${name}`];
    return again(first, (f) => vitest(config, [f], name));
  }
  if (name === 'e2e:perf') {
    const first = playwright('--project=perf --no-deps', name);
    return first === null ? ['stage:e2e:perf'] : first;
  }
  const i = Number(name.slice(4)) - 1;
  const chunk = specs.slice(i * E2E_CHUNK, (i + 1) * E2E_CHUNK);
  const first = playwright(`--project=chromium ${chunk.join(' ')}`, name);
  if (first === null) return [`stage:${name}`];
  return again(first, (f) => playwright(`--project=chromium --workers=1 ${f}`, name));
}

function main(): void {
  const key = codeTree();
  if (key === null) {
    console.error('review: git cannot tell the tree');
    process.exitCode = 1;
    return;
  }
  const specs = specFiles();
  let record = readRecord();
  if (record === null || record.key !== key) record = { key, steps: reviewSteps(specs.length), done: {} };
  for (const name of record.steps) {
    if (name in record.done) {
      console.log(`review: ${name} done (${record.done[name]!.at}), red ${record.done[name]!.red.length}`);
      continue;
    }
    const red = step(name, specs);
    if (codeTree() !== key) {
      console.error('review: the code changed during the run; nothing recorded for this step');
      process.exitCode = 1;
      return;
    }
    record.done[name] = { red, at: new Date().toISOString() };
    mkdirSync(DIR, { recursive: true });
    writeFileSync(RECORD, JSON.stringify(record, null, 1));
  }
  const v = judge(record, knownRed());
  for (const t of v.known) console.log(`review: known red: ${t}`);
  for (const t of v.unknown) console.log(`review: RED, not on ${KNOWN}: ${t}`);
  console.log(`review: ${v.green ? 'green' : 'RED'} (${v.known.length} known red, ${v.unknown.length} not known)`);
  if (!v.green) process.exitCode = 1;
}

if (process.argv[1] && existsSync(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
