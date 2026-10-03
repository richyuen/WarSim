/**
 * Gate stage `test:sweep:changed` (ADR-48): runs the 10-year sweep tests (`npm run test:sweep`,
 * ~6 min) only when the working tree differs from HEAD in a path that can change their outcome.
 * The gate runs before every commit, so a commit that touches none of these paths cannot change
 * what the previous gate proved. `npm run check:full` always runs them (use it for the DONE
 * condition, after a rebase or pull, and whenever in doubt). FULL=1 forces them here too.
 * Any doubt (git missing, not a repository) runs them.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
/** Everything the sim and the sweep tests are built from. */
export const SWEEP_INPUTS = ['src/sim', 'src/shared', 'data', 'public/data', 'tests/sweep', 'tests/helpers', 'tools/headless', 'vitest.sweep.config.ts', 'package.json', 'package-lock.json'];

/** Changed or untracked files under SWEEP_INPUTS, or null when git cannot tell. */
export function changedSweepInputs(): string[] | null {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...SWEEP_INPUTS], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0 || r.error) return null;
  return r.stdout.split('\n').filter((l) => l.trim() !== '');
}

function main(): void {
  const changed = process.env['FULL'] ? null : changedSweepInputs();
  if (changed !== null && changed.length === 0) {
    console.log('test:sweep skipped: no change under ' + SWEEP_INPUTS.join(', ') + ' since HEAD (npm run check:full runs it anyway).');
    return;
  }
  console.log(changed === null ? 'test:sweep: running (forced, or git could not tell).' : `test:sweep: running, ${changed.length} sim input(s) changed since HEAD.`);
  const r = spawnSync('npm run test:sweep', { cwd: ROOT, stdio: 'inherit', shell: true });
  process.exitCode = r.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
