import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_STAGES, changedFiles, gatedTrees, planE2e, planGate, tickedTasks, worktreeTree } from '../../tools/gate/check';
import { criticDue, tickedReviews } from '../../tools/gate/criticDue';
import { archive, LEDGER, MOVED } from '../../tools/plan/archive';

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

  // ADR-87 (the user's decision, 2026-10-05): the e2e stage in full when a numbered task is
  // ticked, not for the parts it is split into.
  it('e2e: in full when the change ticks a numbered task; for a part, the changed specs or none', () => {
    const head = ['- [x] 2.12 A task', '  - [x] 2.12a its part', '- [ ] 2.14 Another', '  - [ ] 2.14a its part', '- [x] 1.42f An old part at the margin'].join('\n');
    const code = ['src/render/units/markers.ts', 'PLAN.md'];
    expect(tickedTasks(head)).toEqual(['2.12']);
    // Nothing ticked, no spec touched: left out.
    expect(planE2e(code, head, head)).toMatchObject({ mode: 'none' });
    // A part ticked: not a numbered task.
    const part = head.replace('  - [ ] 2.14a', '  - [x] 2.14a');
    expect(planE2e(code, part, head)).toMatchObject({ mode: 'none' });
    // With a spec written or edited for the part: that spec is run.
    expect(planE2e([...code, 'tests/e2e/tags1938.spec.ts', 'tests/unit/tags.test.ts'], part, head)).toMatchObject({ mode: 'changed', specs: ['tests/e2e/tags1938.spec.ts'] });
    // The numbered task ticked: everything.
    const whole = part.replace('- [ ] 2.14 ', '- [x] 2.14 ');
    expect(planE2e(code, whole, head)).toMatchObject({ mode: 'full' });
    expect(planE2e(['PLAN.md', 'src/sim/tick.ts'], whole, head).why).toContain('2.14');
    // A review pass (PROMPT step 9) is ticked like a numbered task; its parts are parts (PLAN 3.4Rn).
    const review = ['- [x] 3.4 A task', '- [ ] 3.4R Review pass', '  - [x] 3.4Ra its part', '- [ ] 3.4Rn A part at the margin'].join('\n');
    expect(tickedTasks(review)).toEqual(['3.4']);
    expect(planE2e(code, review.replace('- [ ] 3.4Rn', '- [x] 3.4Rn'), review)).toMatchObject({ mode: 'none' });
    const passed = review.replace('- [ ] 3.4R ', '- [x] 3.4R ');
    expect(tickedTasks(passed)).toEqual(['3.4', '3.4R']);
    expect(planE2e(code, passed, review)).toMatchObject({ mode: 'full', why: 'PLAN 3.4R ticked' });
    // What every spec stands on, or an unknown change: everything.
    expect(planE2e([...code, 'tests/e2e/settle.ts'], head, head)).toMatchObject({ mode: 'full' });
    expect(planE2e([...code, 'playwright.config.ts'], head, head)).toMatchObject({ mode: 'full' });
    expect(planE2e(null, head, head)).toMatchObject({ mode: 'full' });
    expect(planE2e(code, head, null)).toMatchObject({ mode: 'full' });
    // The critic's own files are not a change.
    expect(planE2e(['critic/scripts/x.spec.ts', 'src/app/hud.ts'], head, head)).toMatchObject({ mode: 'none' });
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

// ADR-231: PLAN.md holds what is still to do. `npm run plan:archive` moves the text of a task
// that is done to docs/PLAN_DONE.md and leaves its first line, which the gate and the critic's
// count read.
describe('the archive of the plan (ADR-231)', () => {
  const plan = [
    '## Phase 3',
    '',
    '- [x] 3.1 Tanks.',
    '  AT: a test.',
    '  - [x] 3.1a A part.',
    '',
    '- [x] 3.2 One line.',
    '- [x] 3.3 Phase 3 review: all of it,',
    '  on two lines.',
    '- [ ] 3.4R Review pass.',
    '  Its text.',
    '  - [x] 3.4Ra Done part.',
    '    *Done.*',
    '  - [ ] 3.4Rb Open part.',
    '    - [x] 3.4Rb1 Done under an open part.',
    '      Stays.',
    '  - [x] 3.4Rc A part with an open one under it.',
    '    - [ ] 3.4Rc1 Open.',
    '',
    '## Phase 4',
    '',
    '- [ ] 4.1 Sea zones.',
    '  AT: a test.',
  ];

  // ADR-235: the first line of a numbered task that is done goes to the plan's last section,
  // which an iteration does not read; that of a done part stays in its open task.
  it('moves the done tasks and the done parts of an open task; the first lines of the tasks to the last section', () => {
    const r = archive(plan);
    expect(r.moved).toBe(3);
    expect(r.listed).toBe(3);
    expect(r.plan).toEqual([
      '## Phase 3',
      '',
      '- [ ] 3.4R Review pass.',
      '  Its text.',
      `  - [x] 3.4Ra Done part.${MOVED}`,
      ...plan.slice(13),
      '',
      LEDGER,
      '',
      expect.stringContaining('Not read at the start of an iteration'),
      '',
      `- [x] 3.1 Tanks.${MOVED}`,
      '- [x] 3.2 One line.',
      `- [x] 3.3 Phase 3 review: all of it,${MOVED}`,
      '',
    ]);
    expect(r.done).toEqual(['## Phase 3', '', ...plan.slice(2, 5), '', ...plan.slice(7, 9), '', 'Of 3.4R (open in PLAN.md):', '', ...plan.slice(11, 13), '']);
    // What the gate and the critic's count read is as it was, and a second run moves nothing.
    expect(tickedTasks(r.plan.join('\n'))).toEqual(tickedTasks(plan.join('\n')));
    expect(tickedReviews(r.plan.join('\n'))).toEqual(['3.3']);
    expect(archive(r.plan)).toEqual({ plan: r.plan, done: [], moved: 0, listed: 0 });
    // A task ticked later joins the section at its end.
    const later = archive(r.plan.map((l) => (l === '- [ ] 4.1 Sea zones.' ? '- [x] 4.1 Sea zones.' : l)));
    expect([later.moved, later.listed]).toEqual([1, 1]);
    expect(later.plan.slice(-5)).toEqual([`- [x] 3.1 Tanks.${MOVED}`, '- [x] 3.2 One line.', `- [x] 3.3 Phase 3 review: all of it,${MOVED}`, `- [x] 4.1 Sea zones.${MOVED}`, '']);
    expect(later.plan).not.toContain('  AT: a test.');
  });

  it('PLAN.md itself has nothing left to move: run `npm run plan:archive` after a tick', () => {
    const text = readFileSync(path.resolve(import.meta.dirname, '../../PLAN.md'), 'utf8');
    const r = archive(text.split(/\r?\n/));
    expect([r.moved, r.listed]).toEqual([0, 0]);
  });
});
