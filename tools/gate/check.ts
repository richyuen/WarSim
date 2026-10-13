/**
 * `npm run check`: the gate, sized to what changed since HEAD (ADR-48, ADR-49, ADR-55).
 *
 *   nothing changed, and the gate has passed this very tree           → nothing
 *   only documents changed (Markdown anywhere, anything under docs/)  → parity
 *   no sim input changed                                             → everything but the 10-year sweep tests
 *   otherwise                                                        → everything, the sweep stage the pin alone
 *   a phase review ticked (`- [x] 4.8 Phase 4 review`)               → everything, every sweep test
 *   … on code a green `npm run check:review` ran on (ADR-297)          → as if none were ticked
 *
 * Of the unit stage (ADR-280, ADR-293, the user's decisions): all of it when the change ticks a
 * phase review (not a numbered task: ADR-293), when git cannot tell what changed, under FULL, or when
 * something every test stands on changed (`UNIT_SHARED`); otherwise only the test files whose
 * imports reach a file that changed (`vitest related`), or none (`planUnit`).
 *
 * Of the sweep stage (ADR-278, the user's decision): every 10-year test only when the change ticks
 * a phase review, git cannot tell what changed, or FULL is set; otherwise only the pinned state
 * hash of seed 99 (`tests/sweep/baselineHash.test.ts`, 81 s), so a rule change still moves the
 * pin in its own commit (`planSweep`).
 *
 * And of the e2e stage (ADR-87, ADR-293): all of it when the change ticks a phase review
 * (`- [x] 4.8 Phase 4 review`; until ADR-293 every numbered task); otherwise only the spec files that
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
import { tickedReviews } from './criticDue';
import { reviewProven } from './review';

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
 * `gated`: the gate has already passed the tree of HEAD. `review`: the change ticks a phase review
 * (`reviewTicked`), whose gate runs every stage whatever changed: a commit of documents alone too
 * (ADR-286; since ADR-293 the tick of a numbered task is a commit as any other).
 */
export function planGate(files: readonly string[] | null, gated = false, review = false): Stage[] {
  if (files === null || review) return [...ALL_STAGES];
  const changed = files.filter((f) => !ignored(f));
  if (changed.length === 0 && gated) return [];
  if (changed.length > 0 && changed.every(isDocument)) return ['parity'];
  const sim = changed.some((f) => SWEEP_INPUTS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  return ALL_STAGES.filter((s) => s !== 'test:sweep' || sim);
}

/** Whether `planNow` ticks a phase review that `planAtHead` had not (null = unknown: no). */
export function reviewTicked(planNow: string, planAtHead: string | null): boolean {
  if (planAtHead === null) return false;
  const before = new Set(tickedReviews(planAtHead));
  return tickedReviews(planNow).some((id) => !before.has(id));
}

/** The pinned state hash: the one sweep test of a commit that ticks no phase review (ADR-278). */
export const PIN_TEST = 'tests/sweep/baselineHash.test.ts';

/**
 * How much of the sweep stage a gate with a sim input in it runs (ADR-278, the user's decision):
 * every test when the change ticks a phase review or what changed is not known; otherwise the pin.
 */
export function planSweep(files: readonly string[] | null, review: boolean): 'full' | 'pin' {
  return files === null || review ? 'full' : 'pin';
}

/**
 * What every unit test stands on, or reads without importing it (the earth's assets and the
 * scenario's data are read from disk): a change to any of it runs the whole unit stage.
 */
export const UNIT_SHARED = ['vitest.config.ts', 'tests/helpers/', 'package.json', 'package-lock.json', 'tsconfig.json', 'data/', 'public/data/', 'tools/headless/'];

export interface UnitPlan {
  /** 'full': every unit test. 'related': the test files whose imports reach `files`. 'none': the stage is left out. */
  mode: 'full' | 'related' | 'none';
  files: string[];
  why: string;
}

/**
 * How much of the unit stage a gate with code in it runs (ADR-280). `ticked`: the numbered tasks
 * and reviews the change ticks (`newTicks`), null when unknown. `exists`: whether a path is on disk
 * (a file removed runs everything: what imported it is not known any more).
 */
export function planUnit(files: readonly string[] | null, ticked: readonly string[] | null, exists: (f: string) => boolean): UnitPlan {
  if (files === null || ticked === null) return { mode: 'full', files: [], why: 'what changed is not known' };
  if (ticked.length > 0) return { mode: 'full', files: [], why: `PLAN ${ticked.join(', ')} ticked (a phase review)` };
  const changed = files.filter((f) => !ignored(f) && !isDocument(f));
  const shared = changed.find((f) => UNIT_SHARED.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  if (shared !== undefined) return { mode: 'full', files: [], why: `${shared} changed` };
  const code = changed.filter((f) => (f.startsWith('src/') || f.startsWith('tools/') || f.startsWith('tests/unit/')) && /\.(ts|tsx|js|json)$/.test(f));
  const gone = code.find((f) => !exists(f));
  if (gone !== undefined) return { mode: 'full', files: [], why: `${gone} removed` };
  if (code.length === 0) return { mode: 'none', files: [], why: 'no source or unit test changed' };
  return { mode: 'related', files: code, why: 'no phase review ticked: the tests that import what changed' };
}

/**
 * The command for the spec files that changed (an e2e stage of `changed`): a perf spec on its own
 * project without its dependency (`--no-deps`: the perf project runs after chromium's every test,
 * so named alone it would run them all), the others on chromium.
 */
export function changedSpecsCommand(specs: readonly string[]): string {
  const perf = specs.filter((f) => f.endsWith('.perf.spec.ts'));
  const rest = specs.filter((f) => !f.endsWith('.perf.spec.ts'));
  const parts: string[] = [];
  if (rest.length > 0) parts.push(`npx playwright test ${rest.join(' ')} --project=chromium`);
  if (perf.length > 0) parts.push(`npx playwright test ${perf.join(' ')} --project=perf --no-deps`);
  return parts.join(' && ');
}

/** The phase reviews ticked in `planNow` and not in `planAtHead` (null = unknown; ADR-293: a numbered task is not one). */
export function newTicks(planNow: string, planAtHead: string | null): string[] | null {
  if (planAtHead === null) return null;
  const before = new Set(tickedReviews(planAtHead));
  return tickedReviews(planNow).filter((id) => !before.has(id));
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
  const ticked = newTicks(planNow, planAtHead) ?? [];
  if (ticked.length > 0) return { mode: 'full', specs: [], why: `PLAN ${ticked.join(', ')} ticked (a phase review)` };
  const changed = files.filter((f) => !ignored(f));
  const shared = changed.filter((f) => f === 'playwright.config.ts' || (f.startsWith('tests/e2e/') && !f.endsWith('.spec.ts')));
  if (shared.length > 0) return { mode: 'full', specs: [], why: `${shared[0]} changed` };
  const specs = changed.filter((f) => f.startsWith('tests/e2e/') && f.endsWith('.spec.ts'));
  if (specs.length > 0) return { mode: 'changed', specs, why: 'no phase review ticked: the changed specs only' };
  return { mode: 'none', specs: [], why: 'no phase review ticked and no spec changed' };
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
  let planNow = '';
  try {
    planNow = readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
  } catch {
    // No plan: everything runs.
  }
  const atHead = spawnSync('git', ['show', 'HEAD:PLAN.md'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const planAtHead = atHead.status === 0 && !atHead.error && planNow !== '' ? atHead.stdout : null;
  // A phase review's tick whose code a green `npm run check:review` proved (ADR-297): a commit as
  // any other, its full run already done on this code.
  const ticked = reviewTicked(planNow, planAtHead);
  const proof = ticked && !process.env['FULL'] ? reviewProven() : null;
  if (proof) console.log(`gate: a phase review ticked: ${proof.why}`);
  const review = ticked && !proof?.proven;
  const planBefore = proof?.proven ? planNow : planAtHead;
  const ticks = newTicks(planNow, planBefore);
  const stages = planGate(files, head !== null && gatedTrees().includes(head), review);
  const sweep = planSweep(files, review);
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
    e2e = planE2e(files, planNow, planBefore);
    e2e.specs = e2e.specs.filter((f) => existsSync(path.join(ROOT, f)));
    if (e2e.mode === 'changed' && e2e.specs.length === 0) e2e.mode = 'none';
    if (e2e.mode === 'none') stages.splice(stages.indexOf('e2e'), 1);
  }
  // The unit stage in full only when a numbered task is ticked (ADR-280); else the tests related to what changed.
  const unit: UnitPlan = process.env['FULL'] ? { mode: 'full', files: [], why: '' } : planUnit(files, ticks, (f) => existsSync(path.join(ROOT, f)));
  const unitWhy = unit.why !== '' && stages.includes('test');
  if (stages.includes('test') && unit.mode === 'none') stages.splice(stages.indexOf('test'), 1);
  const skipped = ALL_STAGES.filter((s) => !stages.includes(s));
  console.log(`gate: ${stages.join(' → ')}${skipped.length > 0 ? `   (skipped: ${skipped.join(', ')}; npm run check:full runs everything)` : ''}`);
  if (unitWhy) console.log(`gate: unit ${unit.mode === 'full' ? 'in full' : unit.mode === 'related' ? `the tests related to ${unit.files.length} file(s)` : 'left out'}: ${unit.why}`);
  if (e2e.why !== '') console.log(`gate: e2e ${e2e.mode === 'full' ? 'in full' : e2e.mode === 'changed' ? `of ${e2e.specs.length} spec file(s)` : 'left out'}: ${e2e.why}`);
  if (stages.includes('test:sweep')) console.log(`gate: sweep ${sweep === 'full' ? 'in full' : `the pin alone (${PIN_TEST}); every sweep test at a phase review`}`);
  for (const stage of stages) {
    const command =
      stage === 'e2e' && e2e.mode === 'changed'
        ? changedSpecsCommand(e2e.specs)
        : stage === 'test' && unit.mode === 'related'
          ? `npx vitest related --run --passWithNoTests ${unit.files.join(' ')}`
          : stage === 'test:sweep' && sweep === 'pin'
            ? `npx vitest run --config vitest.sweep.config.ts ${PIN_TEST}`
            : `npm run ${stage}`;
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
