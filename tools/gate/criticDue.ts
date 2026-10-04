/**
 * `npm run critic:due`: whether PROMPT.md step 2a calls for a critic run (ADR-59).
 *
 * The critic is due when `critic/CRITIC_REPORT.json` is missing (or names a commit this
 * repository does not have), or when a phase review has been ticked in PLAN.md since the commit
 * the report names: one run per phase. (Until ADR-59 it was also due every 5 commits of work
 * that fixed no critic finding, ADR-49.) Step 2a's last trigger, the DONE condition looking met,
 * is a judgement call and is not checked here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

export interface CriticDue {
  due: boolean;
  /** PLAN ids of the phase reviews ticked now and not at the report's commit. */
  reviews: string[];
}

/** The ids of the phase reviews ticked in a PLAN.md text (`- [x] 2.11 Phase 2 review…`). */
export function tickedReviews(plan: string): string[] {
  return [...plan.matchAll(/^- \[x\] (\d+\.\d+\w*) Phase \d+ review/gm)].map((m) => m[1]!);
}

/** `planAtReport`: PLAN.md as of the commit the report names; null = no usable report. */
export function criticDue(planNow: string, planAtReport: string | null): CriticDue {
  if (planAtReport === null) return { due: true, reviews: [] };
  const before = new Set(tickedReviews(planAtReport));
  const reviews = tickedReviews(planNow).filter((id) => !before.has(id));
  return { due: reviews.length > 0, reviews };
}

function main(): void {
  const file = path.join(ROOT, 'critic/CRITIC_REPORT.json');
  let planAtReport: string | null = null;
  let commit = '';
  if (existsSync(file)) {
    commit = (JSON.parse(readFileSync(file, 'utf8')) as { commit?: string }).commit ?? '';
    const r = /^[0-9a-f]{7,40}$/.test(commit) ? spawnSync('git', ['show', `${commit}:PLAN.md`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }) : null;
    if (r && r.status === 0) planAtReport = r.stdout;
  }
  const d = criticDue(readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8'), planAtReport);
  if (planAtReport === null) console.log('critic: DUE (no report, or its commit is not in this repository).');
  else if (d.due) console.log(`critic: DUE: phase review ${d.reviews.join(', ')} ticked since the report (${commit.slice(0, 7)}).`);
  else console.log(`critic: not due: no phase review ticked since the report (${commit.slice(0, 7)}). It runs after each phase review and for the DONE condition.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
