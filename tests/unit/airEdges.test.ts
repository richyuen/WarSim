import { describe, expect, it } from 'vitest';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { bombIndustry } from '../../src/sim/systems/bombing';
import { cellX, loopW } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.8c (the watch list of 5.8a): the air's paths wrap east–west only on a map that loops.

const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

/** Seed 1's world, France and Germany at war, three German cells of industry by each edge of row 300. */
function edges(looping: boolean): { w: World; wing: number; cells: number[] } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.settings.loopingMap = looping;
  w.wars.start([FRA], [GER], 0);
  const W = w.cells.w;
  const cells = [300 * W, 300 * W + 1, 300 * W + W - 1];
  for (const c of cells) {
    w.cells.controller[c] = GER;
    w.cells.econ[c] = 100;
  }
  const wing = [...w.wingBase].find(([id, b]) => b > 0 && w.formations.cols.nation[id] === FRA && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'strategic_bomber_group')![0];
  return { w, wing, cells };
}

describe('the air at the edge of a map (PLAN 5.8c)', () => {
  it('bombs by the west edge fall on the east edge\'s cells where the map loops, not where it does not', () => {
    const loop = edges(true);
    bombIndustry(loop.w, loop.wing, 0.5, 300.5);
    expect(loop.cells.map((c) => loop.w.bombDamage.has(c))).toEqual([true, true, true]);
    const flat = edges(false);
    bombIndustry(flat.w, flat.wing, 0.5, 300.5);
    expect(flat.cells.map((c) => flat.w.bombDamage.has(c))).toEqual([true, true, false]);
  });

  it('a column: wrapped where the map loops, none off its edge where it does not; the width to wrap by', () => {
    const { w } = edges(true);
    expect([cellX(w, -1), cellX(w, w.cells.w), cellX(w, 5)]).toEqual([w.cells.w - 1, 0, 5]);
    expect(loopW(w)).toBe(w.cells.w);
    w.settings.loopingMap = false;
    expect([cellX(w, -1), cellX(w, w.cells.w), cellX(w, 5)]).toEqual([null, null, 5]);
    expect(loopW(w)).toBe(0);
  });
});
