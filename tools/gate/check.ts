/**
 * `npm run check`: the gate, sized to what changed since HEAD (ADR-48, ADR-49).
 *
 *   only documents changed (Markdown anywhere, anything under docs/)  → parity
 *   no sim input changed                                             → everything but the 10-year sweep tests
 *   otherwise                                                        → everything
 *
 * Nothing but `npm run parity` reads the documents, and nothing but a sim input can change what
 * the sweep tests prove. `critic/` is the critic's own output and is ignored. The gate runs
 * before every commit, so the stages left out were proved by the gate of an earlier commit.
 * `npm run check:full` (or FULL=1) always runs everything: use it for the DONE condition, after
 * a pull or rebase, and whenever in doubt. If git cannot tell what changed, everything runs.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Everything the sim and the sweep tests are built from (a dependency change shows in the lock file). */
export const SWEEP_INPUTS = ['src/sim/', 'src/shared/', 'data/', 'public/data/', 'tests/sweep/', 'tests/helpers/', 'tools/headless/', 'vitest.sweep.config.ts', 'package-lock.json'];
export const ALL_STAGES = ['typecheck', 'lint', 'test', 'test:sweep', 'build', 'e2e', 'parity'] as const;
export type Stage = (typeof ALL_STAGES)[number];

const ignored = (file: string): boolean => file.startsWith('critic/');
const isDocument = (file: string): boolean => file.endsWith('.md') || file.startsWith('docs/');

/** The stages to run for `files` changed since HEAD (repo-relative, `/`-separated); null = unknown. */
export function planGate(files: readonly string[] | null): Stage[] {
  if (files === null) return [...ALL_STAGES];
  const changed = files.filter((f) => !ignored(f));
  if (changed.length > 0 && changed.every(isDocument)) return ['parity'];
  const sim = changed.some((f) => SWEEP_INPUTS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  return ALL_STAGES.filter((s) => s !== 'test:sweep' || sim);
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

function main(): void {
  const files = process.env['FULL'] ? null : changedFiles();
  const stages = planGate(files);
  const skipped = ALL_STAGES.filter((s) => !stages.includes(s));
  console.log(`gate: ${stages.join(' → ')}${skipped.length > 0 ? `   (skipped: ${skipped.join(', ')}; npm run check:full runs everything)` : ''}`);
  for (const stage of stages) {
    const r = spawnSync(`npm run ${stage}`, { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) {
      console.error(`gate: FAILED at ${stage}`);
      process.exitCode = r.status ?? 1;
      return;
    }
  }
  console.log('gate: green');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
