import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { SimInit } from '../../src/shared/protocol';
import { deadLand } from '../helpers/deadLand';
import { assets1938 } from '../helpers/earth';
import { eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 2.16Rg (the sixth read, findings 1b and 2): a God Mode Kill leaves no land with the dead.
// Each living nation is killed in a copy of the world.

const assets = assets1938(SIZE_1938.w);

/** One line for every nation whose Kill leaves it alive or with a cell, as owner or as controller. */
function killEach(init: SimInit, ticks: number): string[] {
  const base = new Sim(init);
  base.step(ticks);
  const bytes = base.save();
  const total = base.world.cells.owner.reduce((a, o) => a + (o !== 0 ? 1 : 0), 0);
  const victims: number[] = [];
  base.world.nations.forEach((n) => {
    if (base.world.nations.cols.living[n] === 1) victims.push(n);
  });
  const copy = new Sim(init);
  const bad: string[] = [];
  for (const n of victims) {
    copy.load(bytes);
    const w = copy.world;
    const cells = w.cells.owner.reduce((a, o) => a + (o === n ? 1 : 0), 0); // counted: the toy world's column is the controllers'
    copy.command({ kind: 'collapseNation', nation: n });
    copy.applyNow();
    if (w.nations.cols.living[n] === 1) bad.push(`nation ${n} (${cells} cells) lives`);
    for (const line of deadLand(w)) bad.push(`Kill of nation ${n} (${cells} cells): ${line}`);
    // Nobody's land is no answer: what was owned is owned.
    const owned = w.cells.owner.reduce((a, o) => a + (o !== 0 ? 1 : 0), 0);
    if (owned !== total) bad.push(`Kill of nation ${n} (${cells} cells): ${total - owned} cells without an owner`);
  }
  return bad;
}

describe('a God Mode Kill leaves no land with the dead (PLAN 2.16Rg)', () => {
  it('1938 at the start: every nation', () => {
    expect(killEach({ scenario: '1938', seed: 99, assets }, 0)).toEqual([]);
  }, 300_000);

  // The two nations of 1938 that own the centre of no province: nothing is founded, there is no
  // heir, and the land goes to the neighbour with the most cells beside it (ADR-113).
  it('a nation inside another’s province: its land goes to one neighbour, with one line of history', () => {
    for (const tag of ['DAN', 'CCP']) {
      const s = new Sim({ scenario: '1938', seed: 99, assets });
      const w = s.world;
      const c = nationId(tag);
      expect(c, tag).toBeGreaterThan(0);
      const count = (): Map<number, number> => {
        const m = new Map<number, number>();
        for (const o of w.cells.owner) if (o !== 0) m.set(o, (m.get(o) ?? 0) + 1);
        return m;
      };
      const before = count();
      const born = w.nations.highWater;
      s.command({ kind: 'collapseNation', nation: c });
      const ev = runEvents(s, 1);
      const after = count();
      const gainers = [...after].filter(([n, k]) => k > (before.get(n) ?? 0)).map(([n]) => n);
      expect(w.nations.highWater, `${tag}: nations founded`).toBe(born);
      expect(gainers.length, `${tag}: receivers`).toBe(1);
      expect(after.get(gainers[0]!)! - before.get(gainers[0]!)!, `${tag}: cells received`).toBe(before.get(c));
      expect(eventKinds(ev, EventKind.LandCeded), `${tag}: LandCeded`).toEqual([[gainers[0], c]]);
      expect(eventKinds(ev, EventKind.WarDeclared), `${tag}: wars`).toEqual([]);
      w.nations.forEach((n) => expect(w.nations.cols.cells[n], `${tag}: count of nation ${n}`).toBe(after.get(n) ?? 0));
      console.log(`Kill ${tag}: ${before.get(c)} cells to ${NATIONS_1938[gainers[0]! - 1]?.tag}`);
    }
  });

  it('1938 at tick 2000, with wars and occupations: every nation', () => {
    expect(killEach({ scenario: '1938', seed: 99, assets }, 2000)).toEqual([]);
  }, 300_000);

  it('a random world of 60 at tick 2000: every nation', () => {
    expect(killEach({ scenario: 'random', seed: 7, assets, options: { nations: 60 } }, 2000)).toEqual([]);
  }, 300_000);

  it('the toy world, which has no provinces: either nation', () => {
    expect(killEach({ scenario: 'toy', seed: 7 }, 0)).toEqual([]);
  });
});
