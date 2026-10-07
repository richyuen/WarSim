/**
 * `npm run check`: the gate, sized to what changed since HEAD (ADR-48, ADR-49, ADR-55).
 *
 *   nothing changed, and the gate has passed this very tree           → nothing
 *   only documents changed (Markdown anywhere, anything under docs/)  → parity
 *   no sim input changed                                             → everything but the 10-year sweep tests
 *   otherwise                                                        → everything
 *
 * And of the e2e stage (ADR-87): all of it when the change ticks a numbered task of PLAN.md or
 * the review pass after one (3.4R); for a part of either (2.14a, 3.4Ra) only the spec files that
 * changed, or none (`planE2e`).
 *
 * Nothing but `npm run parity` reads the documents, and nothing but a sim input can change what
 * the sweep tests prove. `critic/` is the critic's own output and is ignored. The gate runs
 * before every commit, so the stages left out were proved by the gate of an earlier commit.
 * A green gate records the tree it passed (`.cache/gate/green.json`); a clean tree whose HEAD is
 * one of those trees has nothing left to prove (the gate at the start of an iteration). A HEAD
 * the gate has not seen (a pull, a rebase, a fresh clone) still gets the code stages.
 * `npm run check:full` (or FULL=1) always runs everything: use it for the DONE condition, after
 * a pull or rebase, and whenever in doubt. If git cannot tell what changed, everything runs.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAMP_DIR = path.join(ROOT, '.cache/gate');
const STAMP = path.join(STAMP_DIR, 'green.json');
/** Trees remembered as passed (the newest last). */
const STAMP_KEEP = 50;

/** Everything the sim and the sweep tests are built from (a dependency change shows in the lock file). */
export const SWEEP_INPUTS = ['src/sim/', 'src/shared/', 'data/', 'public/data/', 'tests/sweep/', 'tests/helpers/', 'tools/headless/', 'vitest.sweep.config.ts', 'package-lock.json'];
export const ALL_STAGES = ['typecheck', 'lint', 'test', 'test:sweep', 'build', 'e2e', 'parity'] as const;
export type Stage = (typeof ALL_STAGES)[number];

const ignored = (file: string): boolean => file.startsWith('critic/');
const isDocument = (file: string): boolean => file.endsWith('.md') || file.startsWith('docs/');

/**
 * The stages to run for `files` changed since HEAD (repo-relative, `/`-separated); null = unknown.
 * `gated`: the gate has already passed the tree of HEAD.
 */
export function planGate(files: readonly string[] | null, gated = false): Stage[] {
  if (files === null) return [...ALL_STAGES];
  const changed = files.filter((f) => !ignored(f));
  if (changed.length === 0 && gated) return [];
  if (changed.length > 0 && changed.every(isDocument)) return ['parity'];
  const sim = changed.some((f) => SWEEP_INPUTS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  return ALL_STAGES.filter((s) => s !== 'test:sweep' || sim);
}

/**
 * The ids of the numbered tasks ticked in a PLAN.md text (`- [x] 2.13 …`) and of the review passes
 * (`- [x] 3.4R …`, PROMPT step 9): not the parts either is split into (`2.13a`, `3.4Ra`).
 */
export function tickedTasks(plan: string): string[] {
  return [...plan.matchAll(/^- \[x\] (\d+\.\d+R?)(?=\s)/gm)].map((m) => m[1]!);
}

export interface E2ePlan {
  /** 'full': every spec. 'changed': only `specs`. 'none': the stage is left out. */
  mode: 'full' | 'changed' | 'none';
  specs: string[];
  why: string;
}

/**
 * How much of the e2e stage a gate with code in it runs (ADR-87, the user's decision): all of it
 * when the change ticks a numbered task of PLAN.md or a review pass (3.4R; a part such as 2.14a
 * or 3.4Ra does not), when git
 * cannot tell what changed, or when something every spec stands on changed (a helper under
 * tests/e2e, the Playwright config). Otherwise only the spec files that changed: a new or an
 * edited spec is never committed unrun. `planAtHead`: PLAN.md as of HEAD, null when unknown.
 */
export function planE2e(files: readonly string[] | null, planNow: string, planAtHead: string | null): E2ePlan {
  if (files === null || planAtHead === null) return { mode: 'full', specs: [], why: 'what changed is not known' };
  const before = new Set(tickedTasks(planAtHead));
  const ticked = tickedTasks(planNow).filter((id) => !before.has(id));
  if (ticked.length > 0) return { mode: 'full', specs: [], why: `PLAN ${ticked.join(', ')} ticked` };
  const changed = files.filter((f) => !ignored(f));
  const shared = changed.filter((f) => f === 'playwright.config.ts' || (f.startsWith('tests/e2e/') && !f.endsWith('.spec.ts')));
  if (shared.length > 0) return { mode: 'full', specs: [], why: `${shared[0]} changed` };
  const specs = changed.filter((f) => f.startsWith('tests/e2e/') && f.endsWith('.spec.ts'));
  if (specs.length > 0) return { mode: 'changed', specs, why: 'no numbered task ticked: the changed specs only' };
  return { mode: 'none', specs: [], why: 'no numbered task ticked and no spec changed' };
}

/** Files that differ from HEAD (modified, staged, untracked, both ends of a rename), or null when git cannot tell. */
export function changedFiles(): string[] | null {
  const r = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0 || r.error) return null;
  const out: string[] = [];
  const parts = r.stdout.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]!;
    if (entry.length < 4) continue;
    out.push(entry.slice(3));
    // A rename or copy is followed by its source path as a separate entry.
    if (entry[0] === 'R' || entry[0] === 'C') out.push(parts[++i] ?? '');
  }
  return out.filter((f) => f !== '');
}

const git = (args: string[], env?: NodeJS.ProcessEnv): string | null => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', env: env ?? process.env });
  return r.status === 0 && !r.error ? r.stdout.trim() : null;
};

/**
 * The tree a commit of the working tree would have (everything but `critic/`, as the builder
 * commits), or null when git cannot tell. Written through a scratch index, so the real index and
 * the working tree are untouched.
 */
export function worktreeTree(): string | null {
  const real = git(['rev-parse', '--git-path', 'index']);
  if (real === null) return null;
  mkdirSync(STAMP_DIR, { recursive: true });
  const index = path.join(STAMP_DIR, 'index');
  try {
    // From the real index, so files that did not change are not hashed again.
    copyFileSync(path.resolve(ROOT, real), index);
  } catch {
    rmSync(index, { force: true });
  }
  const env = { ...process.env, GIT_INDEX_FILE: index };
  if (git(['add', '-A', '--', '.', ':!critic'], env) === null) return null;
  return git(['write-tree'], env);
}

/** The trees the gate has passed on this machine (oldest first). */
export function gatedTrees(): string[] {
  try {
    const trees = (JSON.parse(readFileSync(STAMP, 'utf8')) as { trees?: unknown }).trees;
    return Array.isArray(trees) ? trees.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function recordGreen(tree: string | null): void {
  if (tree === null) return;
  const trees = gatedTrees().filter((t) => t !== tree);
  trees.push(tree);
  mkdirSync(STAMP_DIR, { recursive: true });
  writeFileSync(STAMP, JSON.stringify({ trees: trees.slice(-STAMP_KEEP) }, null, 1));
}

function main(): void {
  const files = process.env['FULL'] ? null : changedFiles();
  const head = git(['rev-parse', 'HEAD^{tree}']);
  const stages = planGate(files, head !== null && gatedTrees().includes(head));
  if (stages.length === 0) {
    console.log('gate: nothing changed since HEAD, and the gate has passed this tree (npm run check:full runs everything)');
    console.log('gate: green');
    return;
  }
  // The tree as it is now: what the stages below prove. A file edited while they run is not in it.
  const tree = worktreeTree();
  // The e2e stage in full only when a numbered task is ticked (ADR-87); a spec that changed is run.
  let e2e: E2ePlan = { mode: 'full', specs: [], why: '' };
  if (stages.includes('e2e') && !process.env['FULL']) {
    let planNow = '';
    try {
      planNow = readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
    } catch {
      // No plan: everything runs.
    }
    const atHead = spawnSync('git', ['show', 'HEAD:PLAN.md'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    e2e = planE2e(files, planNow, atHead.status === 0 && !atHead.error && planNow !== '' ? atHead.stdout : null);
    e2e.specs = e2e.specs.filter((f) => existsSync(path.join(ROOT, f)));
    if (e2e.mode === 'changed' && e2e.specs.length === 0) e2e.mode = 'none';
    if (e2e.mode === 'none') stages.splice(stages.indexOf('e2e'), 1);
  }
  const skipped = ALL_STAGES.filter((s) => !stages.includes(s));
  console.log(`gate: ${stages.join(' → ')}${skipped.length > 0 ? `   (skipped: ${skipped.join(', ')}; npm run check:full runs everything)` : ''}`);
  if (e2e.why !== '') console.log(`gate: e2e ${e2e.mode === 'full' ? 'in full' : e2e.mode === 'changed' ? `of ${e2e.specs.length} spec file(s)` : 'left out'}: ${e2e.why}`);
  for (const stage of stages) {
    const command = stage === 'e2e' && e2e.mode === 'changed' ? `npx playwright test ${e2e.specs.join(' ')}` : `npm run ${stage}`;
    const r = spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) {
      console.error(`gate: FAILED at ${stage}`);
      process.exitCode = r.status ?? 1;
      return;
    }
  }
  recordGreen(tree);
  console.log('gate: green');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
