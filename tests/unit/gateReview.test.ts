import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { E2E_CHUNK, FILE_RED, judge, KNOWN, outOfKey, playwrightRed, reviewSteps, runRed, vitestRed, type ReviewRecord } from '../../tools/gate/review';

// ADR-297 (the user's decision): the phase review's full run is recorded by `npm run check:review`
// under a code key, and judged against a list of known reds, so that the commit that ticks the
// review (documents alone) does not run it again.

const ROOT = path.resolve(import.meta.dirname, '../..');

const record = (done: Record<string, string[]>, steps = ['lint', 'test', 'e2e:1']): ReviewRecord => ({
  key: 'k',
  steps,
  done: Object.fromEntries(Object.entries(done).map(([s, red]) => [s, { red, at: '' }])),
});

describe('npm run check:review (ADR-297)', () => {
  it('steps: the plain stages, the unit and sweep tests, a step a chunk of specs, the perf spec', () => {
    expect(reviewSteps(2 * E2E_CHUNK + 1)).toEqual(['typecheck', 'lint', 'build', 'parity', 'test', 'test:sweep', 'e2e:1', 'e2e:2', 'e2e:3', 'e2e:perf']);
    expect(reviewSteps(E2E_CHUNK)).toContain('e2e:1');
    expect(reviewSteps(E2E_CHUNK)).not.toContain('e2e:2');
  });

  it('green: every step done and every red test known; a step not done or a red not known is not', () => {
    expect(judge(record({ lint: [], test: ['a › t'], 'e2e:1': [] }), ['a › t']).green).toBe(true);
    const unfinished = judge(record({ lint: [], test: [] }), []);
    expect(unfinished.green).toBe(false);
    expect(unfinished.missing).toEqual(['e2e:1']);
    const unknown = judge(record({ lint: ['stage:lint'], test: ['a › t', 'b › u'], 'e2e:1': [] }), ['a › t']);
    expect(unknown.green).toBe(false);
    expect(unknown.unknown).toEqual(['stage:lint', 'b › u']);
    expect(unknown.known).toEqual(['a › t']);
  });

  it('the code key leaves out the documents, the critic and the list of known reds, and nothing else', () => {
    for (const f of ['PLAN.md', 'PROGRESS.md', 'docs/PARITY.md', 'docs/evidence/4.7/a.png', 'critic/CRITIC_REPORT.json', KNOWN]) expect(outOfKey(f), f).toBe(true);
    for (const f of ['src/sim/sim.ts', 'tests/unit/gate.test.ts', 'tools/gate/review.ts', 'data/terrain.json', 'package.json']) expect(outOfKey(f), f).toBe(false);
  });

  it('the ids of red tests: a vitest report by file and full name, a Playwright one by file and titles', () => {
    const v = vitestRed({
      testResults: [
        { name: path.join(ROOT, 'tests/unit/a.test.ts'), assertionResults: [{ fullName: 'suite one', status: 'passed' }, { fullName: 'suite two', status: 'failed' }] },
      ],
    });
    expect(v).toEqual(['tests/unit/a.test.ts › suite two']);
    const p = playwrightRed({
      suites: [
        {
          title: 'b.spec.ts',
          file: 'b.spec.ts',
          specs: [{ title: 'top', ok: false, file: 'b.spec.ts' }, { title: 'fine', ok: true, file: 'b.spec.ts' }],
          suites: [{ title: 'group', specs: [{ title: 'inner', ok: false, file: 'b.spec.ts' }] }],
        },
      ],
    });
    expect(p).toEqual(['tests/e2e/b.spec.ts › top', 'tests/e2e/b.spec.ts › group › inner']);
  });

  it('a file red with no test red, a spec that fails to load, a run failed with no red named: each red (PLAN 5.8p)', () => {
    // A unit file that fails to import, or throws in a hook: failed, no failed test.
    const v = vitestRed({
      testResults: [
        { name: path.join(ROOT, 'tests/unit/broken.test.ts'), status: 'failed', assertionResults: [] },
        { name: path.join(ROOT, 'tests/unit/hook.test.ts'), status: 'failed', assertionResults: [{ fullName: 'skipped one', status: 'skipped' }] },
        { name: path.join(ROOT, 'tests/unit/one.test.ts'), status: 'failed', assertionResults: [{ fullName: 'it', status: 'failed' }] },
        { name: path.join(ROOT, 'tests/unit/fine.test.ts'), status: 'passed', assertionResults: [{ fullName: 'it', status: 'passed' }] },
      ],
    });
    expect(v).toEqual([`tests/unit/broken.test.ts › ${FILE_RED}`, `tests/unit/hook.test.ts › ${FILE_RED}`, 'tests/unit/one.test.ts › it']);
    // Playwright's errors outside every test: by the file they name, else the run's.
    const p = playwrightRed({ suites: [], errors: [{ location: { file: path.join(ROOT, 'tests/e2e/c.spec.ts') } }, { location: { file: 'd.spec.ts' } }, {}] });
    expect(p).toEqual([`tests/e2e/c.spec.ts › ${FILE_RED}`, `tests/e2e/d.spec.ts › ${FILE_RED}`, 'stage:playwright']);
    // A non-zero exit with no red named is the stage's red; with reds, those; a clean exit, none.
    expect(runRed([], false, 'test')).toEqual(['stage:test']);
    expect(runRed(['a › t'], false, 'test')).toEqual(['a › t']);
    expect(runRed([], true, 'test')).toEqual([]);
    // And none of these is green against an empty list of known reds.
    expect(judge(record({ lint: [], test: v, 'e2e:1': p }), []).green).toBe(false);
  });

  it('the list of known reds: each test once, of a file that exists, with why it is there', () => {
    const list = (JSON.parse(readFileSync(path.join(ROOT, KNOWN), 'utf8')) as { tests: { id: string; why: string }[] }).tests;
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    for (const t of list) {
      expect(existsSync(path.join(ROOT, t.id.split(' › ')[0]!)), t.id).toBe(true);
      expect(t.why.length, t.id).toBeGreaterThan(20);
    }
  });
});
