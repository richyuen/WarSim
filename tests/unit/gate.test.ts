import { describe, expect, it } from 'vitest';
import { changedSweepInputs, SWEEP_INPUTS } from '../../tools/gate/sweepIfSimChanged';

// ADR-48: the gate runs the 10-year sweep tests only when a sim input changed since HEAD.

describe('gate: sweep tests only when the sim changed (ADR-48)', () => {
  it('watches everything the sim and the sweep tests are built from', () => {
    for (const p of ['src/sim', 'src/shared', 'data', 'tests/sweep', 'tests/helpers', 'package.json']) expect(SWEEP_INPUTS).toContain(p);
  });

  it('asks git for changes under those paths only', () => {
    const changed = changedSweepInputs();
    expect(changed).not.toBeNull(); // this is a git repository
    for (const line of changed!) expect(SWEEP_INPUTS.some((p) => line.slice(3).replace(/^"/, '').startsWith(p))).toBe(true);
  });
});
