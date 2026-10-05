import { describe, expect, it } from 'vitest';
import { FormationFlag, marching } from '../../src/shared/protocol';

// PLAN 2.11e: what the view draws as walking. The sim sets `moving` for a formation that has a
// march and holds it where it stands while it is `engaged` (`movementSystem`: "in contact:
// holds and fights"). The view played the walk for `moving` alone: a division that had fought
// in one place for a month walked in place.

describe('a formation on the march (PLAN 2.11e)', () => {
  it('has a march and is not in contact', () => {
    const { moving, engaged } = FormationFlag;
    expect(marching(0)).toBe(false);
    expect(marching(moving)).toBe(true);
    expect(marching(engaged)).toBe(false);
    expect(marching(moving | engaged)).toBe(false);
    // Other bits, should the snapshot come to carry any, do not make a march.
    expect(marching(4 | 8)).toBe(false);
    expect(marching(moving | 4)).toBe(true);
    expect(marching(moving | engaged | 4)).toBe(false);
  });
});
