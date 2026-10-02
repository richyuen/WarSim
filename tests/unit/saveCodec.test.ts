import { describe, expect, it } from 'vitest';
import { isGzip, packSave, unpackSave } from '../../src/shared/saveCodec';
import { Sim } from '../../src/sim/sim';

// PLAN 1.27: save files are gzip-compressed sim bytes; raw bytes stay loadable.

describe('save codec (PLAN 1.27)', () => {
  it('gzip round trip is exact and smaller; raw bytes pass through', async () => {
    const s = new Sim({ scenario: 'toy', seed: 4 });
    s.step(500);
    const raw = s.save();
    const packed = await packSave(raw);
    expect(isGzip(packed)).toBe(true);
    expect(packed.length).toBeLessThan(raw.length / 2);
    expect(Buffer.from(await unpackSave(packed)).equals(Buffer.from(raw))).toBe(true);
    expect(Buffer.from(await unpackSave(raw)).equals(Buffer.from(raw))).toBe(true);
    const t = new Sim({ scenario: 'toy', seed: 0 });
    t.load(await unpackSave(packed));
    expect(t.hash()).toBe(s.hash());
  });
});
