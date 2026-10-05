import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_STAGES, changedFiles, gatedTrees, planGate, worktreeTree } from '../../tools/gate/check';
import { criticDue, tickedReviews } from '../../tools/gate/criticDue';

// ADR-48, ADR-49: the gate is sized to what changed since HEAD. ADR-55: a clean tree that the
// gate has already passed runs nothing. ADR-59: the critic comes back once per phase, when a
// phase review has been ticked since its report (until then: every 5 commits, ADR-49).

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

  it('a clean tree the gate has already passed runs nothing; any change runs as before (ADR-55)', () => {
    expect(planGate([], true)).toEqual([]);
    expect(planGate(['critic/CRITIC_REPORT.json'], true)).toEqual([]);
    expect(planGate(['PROGRESS.md'], true)).toEqual(['parity']);
    expect(planGate(['src/render/units/counters.ts'], true)).toEqual(ALL_STAGES.filter((s) => s !== 'test:sweep'));
    expect(planGate(['src/sim/systems/war.ts'], true)).toEqual([...ALL_STAGES]);
    expect(planGate(null, true)).toEqual([...ALL_STAGES]);
  });

  it('the working tree has a tree id, the same when asked twice; the record of passed trees is a list of ids', () => {
    const tree = worktreeTree();
    expect(tree).toMatch(/^[0-9a-f]{40,64}$/);
    expect(worktreeTree()).toBe(tree);
    for (const t of gatedTrees()) expect(t).toMatch(/^[0-9a-f]{40,64}$/);
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

describe('critic cadence (ADR-59)', () => {
  const plan = (...lines: string[]): string => ['# Plan', '', ...lines, ''].join('\n');
  const DONE = '- [x] 1.41 Phase 1 review + PARITY rows updated with evidence.';

  it('no report: due', () => {
    expect(criticDue(plan(DONE), null)).toEqual({ due: true, reviews: [] });
  });

  it('not due while no phase review has been ticked since the report, whatever else was', () => {
    const then = plan(DONE, '- [ ] 2.4 FireEvent visuals', '- [ ] 2.11 Phase 2 review: SPEC drift');
    const now = plan(DONE, '- [x] 2.4 FireEvent visuals', '- [x] 2.5 Casualty consistency', '- [ ] 2.11 Phase 2 review: SPEC drift');
    expect(criticDue(now, then)).toEqual({ due: false, reviews: [] });
  });

  it('due once a phase review is ticked, and it names the review', () => {
    const then = plan(DONE, '- [ ] 2.11 Phase 2 review: SPEC drift');
    const now = plan(DONE, '- [x] 2.11 Phase 2 review: SPEC drift');
    expect(criticDue(now, then)).toEqual({ due: true, reviews: ['2.11'] });
    // The report made after it names a commit in which the review is ticked: not due again.
    expect(criticDue(now, now).due).toBe(false);
  });

  it('only a ticked task named "Phase N review" counts', () => {
    const now = plan('- [x] 0.6 Screenshot of a flag grid reviewed', '- [x] 1.9 Economy (Phase 1 review notes)', '  Phase 3 review happens later', '- [ ] 3.7 Phase 3 review');
    expect(tickedReviews(now)).toEqual([]);
    expect(tickedReviews(plan('- [x] 0.22 Phase 0 review: re-read SPEC', DONE))).toEqual(['0.22', '1.41']);
  });

  // The Phase 2 review was ticked on 2026-10-05 (`3d6a2b2`, a commit of documents, whose gate is
  // parity alone): this test then named a PLAN.md that was no more (ADR-85). It now holds every
  // state the plan passes through: the reviews are ticked in the order of the phases, none out
  // of turn, and those of phases 0 to 2 are done.
  it('PLAN.md itself: the seven phase reviews exist, those of phases 0 to 2 are ticked, and the ticked ones are the first ones', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, '../../PLAN.md'), 'utf8');
    const all = ['0.22', '1.41', '2.11', '3.7', '4.8', '5.8', '6.9'];
    const ticked = tickedReviews(text);
    expect(ticked.length).toBeGreaterThanOrEqual(3);
    expect(ticked).toEqual(all.slice(0, ticked.length));
    for (const id of all.slice(ticked.length)) expect(text).toMatch(new RegExp(`^- \\[ \\] ${id.replace('.', '\\.')} Phase \\d review`, 'm'));
  });
});
