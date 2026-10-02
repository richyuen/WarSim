import { describe, expect, it } from 'vitest';
import { checkParity, computeScore, evidencePaths, writeScore } from '../../tools/parity/parity';

const T1 = '| # | feature | AoC behaviour | our behaviour | status | evidence | notes |';
const T2 = '| # | addition | description | status | evidence | notes |';

function doc(score: string, rows1: string[], rows2: string[] = []): string {
  return [
    '# AoC Parity',
    '',
    score,
    '',
    '## Table 1 — AoC parity rows',
    '',
    T1,
    '|---|---|---|---|---|---|---|',
    ...rows1,
    '',
    '## Table 2 — Our additions',
    '',
    T2,
    '|---|---|---|---|---|---|',
    ...rows2,
    '',
  ].join('\n');
}

const existing = new Set(['tests/unit/a.test.ts', 'docs/shots/a.png']);
const exists = (p: string): boolean => existing.has(p);

const rowVerified =
  '| 1 | War | Nations declare war [TEXT 2026-10-02] | AI declares wars | verified | `tests/unit/a.test.ts`, `docs/shots/a.png` | |';
const rowPartial = '| 2 | Peace | Broke nations sue [VISUAL 2026-10-02] | partial impl | partial | | |';
const rowNot = '| 3 | Nukes | none [TEXT+VISUAL 2026-10-02] | — | not started | | a \\| b |';
const VALID_SCORE = '**Parity score: 50.0%** (verified 1 · partial 1 · not started 1 · total 3)';

describe('parity checker', () => {
  it('passes a valid file and computes the score', () => {
    const r = checkParity(doc(VALID_SCORE, [rowVerified, rowPartial, rowNot], ['| 1 | Nukes | AI nukes | not started | | |']), exists);
    expect(r.errors).toEqual([]);
    expect(r.counts).toEqual({ verified: 1, partial: 1, notStarted: 1, total: 3 });
    expect(r.score).toBe(50);
    expect(r.table1[2]?.cells['notes']).toBe('a | b'); // escaped pipe stays in the cell
    expect(r.table2).toHaveLength(1);
  });

  it('fails when the header score disagrees with the table', () => {
    const r = checkParity(doc(VALID_SCORE.replace('50.0%', '60.0%'), [rowVerified, rowPartial, rowNot]), exists);
    expect(r.errors.some((e) => e.includes('header disagrees'))).toBe(true);
  });

  it('fails when the header counts disagree even if the percentage matches', () => {
    const r = checkParity(doc(VALID_SCORE.replace('total 3', 'total 4'), [rowVerified, rowPartial, rowNot]), exists);
    expect(r.errors.some((e) => e.includes('header disagrees'))).toBe(true);
  });

  it('fails when a header score line is missing', () => {
    const r = checkParity(doc('Score: lots', [rowVerified, rowPartial, rowNot]), exists);
    expect(r.errors.some((e) => e.includes('missing header score line'))).toBe(true);
  });

  it('fails when a verified row has a missing evidence path', () => {
    const bad = rowVerified.replace('docs/shots/a.png', 'docs/shots/missing.png');
    const r = checkParity(doc(VALID_SCORE, [bad, rowPartial, rowNot]), exists);
    expect(r.errors).toEqual([expect.stringContaining('evidence path does not exist: docs/shots/missing.png')]);
  });

  it('fails when a verified row has no evidence at all', () => {
    const bad = rowVerified.replace('`tests/unit/a.test.ts`, `docs/shots/a.png`', '');
    const r = checkParity(doc(VALID_SCORE, [bad, rowPartial, rowNot]), exists);
    expect(r.errors).toEqual([expect.stringContaining('verified row has no evidence paths')]);
  });

  it('does not require evidence for partial / not started rows', () => {
    const r = checkParity(doc(VALID_SCORE, [rowVerified, rowPartial.replace('| | |', '| `nope.png` | |'), rowNot]), exists);
    expect(r.errors).toEqual([]);
  });

  it('fails on out-of-order numbering, unknown status and a missing source tag', () => {
    const rows = [rowVerified, rowNot.replace('| 3 |', '| 2 |').replace('not started', 'done'), rowPartial.replace('| 2 |', '| 3 |').replace(' [VISUAL 2026-10-02]', '')];
    const score = '**Parity score: 33.3%** (verified 1 · partial 0 · not started 0 · total 3)';
    const r = checkParity(doc(score, rows), exists);
    expect(r.errors.some((e) => e.includes('status "done"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('needs a dated source tag'))).toBe(true);
    const r2 = checkParity(doc(VALID_SCORE, [rowVerified, rowNot, rowPartial]), exists);
    expect(r2.errors.some((e) => e.includes('row number "3" should be 2'))).toBe(true);
  });

  it('fails on wrong table columns', () => {
    const r = checkParity(doc(VALID_SCORE, [rowVerified]).replace(T1, T1.replace('notes', 'remarks')), exists);
    expect(r.errors.some((e) => e.includes('table columns are'))).toBe(true);
  });

  it('writeScore regenerates the header so a re-check passes', () => {
    const text = doc('**Parity score: 99.9%** (verified 9 · partial 9 · not started 9 · total 9)', [rowVerified, rowPartial, rowNot]);
    const first = checkParity(text, exists);
    const fixed = writeScore(text, first.counts);
    expect(checkParity(fixed, exists).errors).toEqual([]);
  });

  it('computeScore and evidencePaths helpers', () => {
    expect(computeScore({ verified: 0, partial: 0, notStarted: 0, total: 0 })).toBe(0);
    expect(computeScore({ verified: 1, partial: 0, notStarted: 2, total: 3 })).toBe(33.3);
    expect(evidencePaths('`a.png`, see `b/c.ts` and text')).toEqual(['a.png', 'b/c.ts']);
  });
});
