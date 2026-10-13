import { describe, expect, it } from 'vitest';
import { EVENT_STRIDE, EventKind } from '../../src/shared/events';
import { AirFx, AirMark, BOMBS_MS, DOGFIGHT_MS, FLAK_MS, MAX_AIR_MARKS } from '../../src/render/fx/air';

// PLAN 5.7b: the air's effects the view keeps of a snapshot's events. The drawing is checked in
// the browser (tests/e2e/airFx1938.spec.ts); here what becomes a mark and for how long.

function events(list: readonly [kind: number, a: number, b: number, x: number, y: number][]): Float64Array {
  const out = new Float64Array(list.length * EVENT_STRIDE);
  list.forEach((e, i) => out.set([i + 1, 50, ...e], i * EVENT_STRIDE));
  return out;
}
const add = (fx: AirFx, list: readonly [number, number, number, number, number][], now: number): void => fx.add(list.length, events(list), now);

describe('AirFx (PLAN 5.7b)', () => {
  it('a fight of each AirBattle with its losses, bombs of each AirStrike, flak of each FlakFired; nothing of the rest', () => {
    const fx = new AirFx();
    add(fx, [[EventKind.AirBattle, 7, 5, 10, 20], [EventKind.AirStrike, 30, 117, 11, 21], [EventKind.FlakFired, 31, 2, 12, 22], [EventKind.ElementDestroyed, 1, 0, 10, 20]], 1000);
    expect(fx.marks.map((m) => [m.kind, m.x, m.y, m.lost, m.born])).toEqual([
      [AirMark.fight, 10, 20, 5, 1000],
      [AirMark.bombs, 11, 21, 0, 1000],
      [AirMark.flak, 12, 22, 0, 1000],
    ]);
    expect(fx.until).toBe(1000 + Math.max(DOGFIGHT_MS, BOMBS_MS, FLAK_MS));
  });

  it('a mark lives its time and is let go at the next snapshot after; animating while one lives; held to MAX_AIR_MARKS', () => {
    const fx = new AirFx();
    add(fx, [[EventKind.FlakFired, 1, 1, 0, 0], [EventKind.AirBattle, 2, 0, 0, 0]], 0);
    expect(fx.animating(FLAK_MS - 1)).toBe(true);
    add(fx, [], FLAK_MS + 1);
    expect(fx.marks.map((m) => m.kind)).toEqual([AirMark.fight]);
    expect(fx.animating(DOGFIGHT_MS - 1)).toBe(true);
    expect(fx.animating(DOGFIGHT_MS)).toBe(false);
    add(fx, Array.from({ length: MAX_AIR_MARKS + 10 }, (_, i) => [EventKind.FlakFired, i, 1, i, 0] as [number, number, number, number, number]), DOGFIGHT_MS + 1);
    expect(fx.marks).toHaveLength(MAX_AIR_MARKS);
    expect(fx.marks[0]!.x).toBe(10);
    fx.clear();
    expect([fx.marks.length, fx.animating(DOGFIGHT_MS + 2)]).toEqual([0, false]);
  });

  it('the same event, the same picture: a mark\'s seed is its event\'s', () => {
    const a = new AirFx();
    const b = new AirFx();
    add(a, [[EventKind.AirStrike, 30, 5, 11.5, 21.25]], 0);
    add(b, [[EventKind.AirStrike, 30, 5, 11.5, 21.25]], 900);
    expect(a.marks[0]!.seed).toBe(b.marks[0]!.seed);
    add(b, [[EventKind.AirStrike, 31, 5, 11.5, 21.25]], 900);
    expect(b.marks[1]!.seed).not.toBe(b.marks[0]!.seed);
  });
});
