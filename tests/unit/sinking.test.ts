import { describe, expect, it } from 'vitest';
import { SINK_MS, sunkOf, type WreckMark } from '../../src/render/fx/wrecks';
import { Wreck } from '../../src/shared/unitLooks';

// PLAN 4.7c: a ship goes down over SINK_MS: its hull shrinks into the sea as `sunkOf` goes from
// 0 to 1; a wreck of the land does not sink.

const mark = (kind: Wreck): WreckMark => ({ id: 1, kind, x: 0, y: 0, angle: 0, born: 1000 });

describe('a ship going down (PLAN 4.7c)', () => {
  it('a ship is half down at half SINK_MS and gone at SINK_MS; a burnt-out vehicle never sinks', () => {
    expect(sunkOf(mark(Wreck.ship), 1000)).toBe(0);
    expect(sunkOf(mark(Wreck.ship), 1000 + SINK_MS / 2)).toBeCloseTo(0.5, 9);
    expect(sunkOf(mark(Wreck.ship), 1000 + SINK_MS)).toBe(1);
    expect(sunkOf(mark(Wreck.ship), 1000 + 3 * SINK_MS)).toBe(1);
    expect(sunkOf(mark(Wreck.vehicle), 1000 + SINK_MS)).toBe(0);
  });
});
