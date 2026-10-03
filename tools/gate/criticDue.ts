/**
 * `npm run critic:due`: whether PROMPT.md step 2a's commit rule calls for a critic run (ADR-49).
 *
 * The critic is due when `critic/CRITIC_REPORT.json` is missing, or when HEAD is CRITIC_EVERY or
 * more commits past the later of (a) the report's commit and (b) the last critic remediation
 * commit after it. A remediation commit is one whose subject starts with "Critic " (for example
 * "Critic B1: ..."): every commit that fixes a critic finding is named that way. So the count
 * restarts with each remediation, and the critic returns only after CRITIC_EVERY commits of
 * other work. Step 2a's other triggers (a phase review was the last ticked task; the DONE
 * condition looks met) are judgement calls and are not checked here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const CRITIC_EVERY = 5;
export const REMEDIATION_PREFIX = 'Critic ';

export interface CriticDue {
  due: boolean;
  /** Commits since the report. */
  sinceReport: number;
  /** Commits since the last remediation commit (or since the report when there is none). */
  sinceBase: number;
  /** Subject of the last remediation commit after the report, if any. */
  lastRemediation: string | null;
}

/** `subjects`: the commits after the report's commit, newest first; null = no usable report. */
export function criticDue(subjects: readonly string[] | null): CriticDue {
  if (subjects === null) return { due: true, sinceReport: 0, sinceBase: 0, lastRemediation: null };
  const i = subjects.findIndex((s) => s.startsWith(REMEDIATION_PREFIX));
  const sinceBase = i < 0 ? subjects.length : i;
  return { due: sinceBase >= CRITIC_EVERY, sinceReport: subjects.length, sinceBase, lastRemediation: i < 0 ? null : subjects[i]! };
}

function main(): void {
  const file = path.join(ROOT, 'critic/CRITIC_REPORT.json');
  let subjects: string[] | null = null;
  if (existsSync(file)) {
    const commit = (JSON.parse(readFileSync(file, 'utf8')) as { commit?: string }).commit ?? '';
    const r = /^[0-9a-f]{7,40}$/.test(commit) ? spawnSync('git', ['log', '--format=%s', `${commit}..HEAD`], { cwd: ROOT, encoding: 'utf8' }) : null;
    if (r && r.status === 0) subjects = r.stdout.split('\n').filter((l) => l !== '');
  }
  const d = criticDue(subjects);
  if (subjects === null) console.log('critic: DUE (no report, or its commit is not in this repository).');
  else {
    const base = d.lastRemediation ? `the last remediation commit ("${d.lastRemediation}")` : 'the report';
    console.log(`critic: ${d.due ? 'DUE' : 'not due'}: ${d.sinceBase} commit(s) since ${base}, ${d.sinceReport} since the report; due at ${CRITIC_EVERY}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
