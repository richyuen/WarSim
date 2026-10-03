import { describe, expect, it } from 'vitest';
import { ALL_STAGES, changedFiles, planGate } from '../../tools/gate/check';
import { CRITIC_EVERY, criticDue } from '../../tools/gate/criticDue';

// ADR-48, ADR-49: the gate is sized to what changed since HEAD; the critic comes back only
// CRITIC_EVERY commits after the last remediation commit.

describe('gate plan (ADR-48, ADR-49)', () => {
  it('documents only: parity alone', () => {
    expect(planGate(['PROGRESS.md', 'docs/PARITY.md', 'docs/sweeps/2026-10-03-sweep-b1.json', 'docs/evidence/2.3/warsaw.png'])).toEqual(['parity']);
    expect(planGate(['CLAUDE.md', 'critic/shots/s1.png'])).toEqual(['parity']); // critic/ is ignored
  });

  it('code outside the sim: everything but the sweep tests', () => {
    const stages = planGate(['src/render/units/counters.ts', 'PROGRESS.md']);
    expect(stages).toEqual(ALL_STAGES.filter((s) => s !== 'test:sweep'));
    expect(planGate(['package.json'])).not.toContain('test:sweep'); // scripts; dependencies show in the lock file
    expect(planGate(['tests/unit/war.test.ts'])).toContain('test');
  });

  it('a sim input: everything', () => {
    for (const f of ['src/sim/systems/war.ts', 'src/shared/calendar.ts', 'data/terrain.json', 'tests/helpers/aiSweep.ts', 'tools/headless/runner.ts', 'package-lock.json', 'vitest.sweep.config.ts']) {
      expect(planGate([f, 'PLAN.md']), f).toEqual([...ALL_STAGES]);
    }
  });

  it('a clean tree, or only critic output, still checks the code; unknown changes run everything', () => {
    expect(planGate([])).toEqual(ALL_STAGES.filter((s) => s !== 'test:sweep'));
    expect(planGate(['critic/CRITIC_REPORT.json'])).toEqual(ALL_STAGES.filter((s) => s !== 'test:sweep'));
    expect(planGate(null)).toEqual([...ALL_STAGES]);
  });

  it('a file that only looks like a document is code', () => {
    expect(planGate(['src/docs/readme.ts'])).toContain('typecheck');
    expect(planGate(['docs.ts'])).toContain('typecheck');
  });

  it('git reports the changed files of this repository', () => {
    const files = changedFiles();
    expect(files).not.toBeNull();
    for (const f of files!) expect(f).not.toMatch(/^.. /); // paths, not status lines
  });
});

describe('critic cadence (ADR-49)', () => {
  const work = (n: number): string[] => Array.from({ length: n }, (_, i) => `PLAN 2.${i + 4}: something`);

  it('no report: due', () => {
    expect(criticDue(null).due).toBe(true);
  });

  it('without remediation commits, due CRITIC_EVERY commits after the report', () => {
    expect(criticDue(work(CRITIC_EVERY - 1)).due).toBe(false);
    expect(criticDue(work(CRITIC_EVERY)).due).toBe(true);
  });

  it('a remediation commit restarts the count', () => {
    // Newest first: 3 commits of other work, a remediation, 4 more before it.
    const subjects = [...work(3), 'Critic B1 part 2: leader share', ...work(4)];
    const d = criticDue(subjects);
    expect(d).toMatchObject({ due: false, sinceReport: 8, sinceBase: 3, lastRemediation: 'Critic B1 part 2: leader share' });
    expect(criticDue([...work(CRITIC_EVERY), 'Critic B6: brush paints on drag']).due).toBe(true);
  });

  it('only subjects that start with "Critic " are remediation', () => {
    expect(criticDue([...work(4), 'Add critic subagent to the build loop']).due).toBe(true); // 5 commits, none a remediation
  });
});
