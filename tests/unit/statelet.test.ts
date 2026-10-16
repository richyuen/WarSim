import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt, spawnRebels } from '../../src/sim/systems/revolts';
import { declareWar, isFounded, makePeace, SMALL_STATE_KM2, STATELET_KM2 } from '../../src/sim/systems/war';
import { ATTACKERS, type War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938, earthAdmin1 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.3d2 (ADR-432): a nation founded in play that loses a peace with under STATELET_KM2 of
// land after the terms is annexed whole. Seeds 1 and 3 × 20 years: founded nations lived through
// 112 and 179 lost peaces with 8,500 to 50,000 km², and the world broke up.

const USA = nationId('USA');
const GER = nationId('GER');
const BEL = nationId('BEL');

function world1938(): World {
  const w = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
  w.settings.revoltMode = 'province';
  return w;
}

function provinceOf(name: string, adm0: string): number {
  const m = earthAdmin1().meta.find((x) => x.name === name && x.adm0 === adm0);
  if (!m) throw new Error(`no province ${name} (${adm0})`);
  return m.id;
}

const km2 = (w: World, n: number): number => w.landCounts().owned[n]!;

/** The war between a and b, its score set so that `winner` wins by `by` (0: a white peace). */
function warOf(w: World, a: number, b: number, winner: number, by: number): War {
  const war = w.wars.list.find((x) => (x.sides[0].includes(a) && x.sides[1].includes(b)) || (x.sides[0].includes(b) && x.sides[1].includes(a)))!;
  expect(war).toBeDefined();
  war.score = war.sides[ATTACKERS].includes(winner) ? by : -by;
  return war;
}

/** Rebels on Maryland, at war with the United States. */
function marylandRebels(): { w: World; rebel: number } {
  const w = world1938();
  const rebel = w.nations.highWater;
  expect(forceRevolt(w, provinceOf('Maryland', 'USA'))).toBe(true);
  expect(isFounded(w, rebel)).toBe(true);
  expect(km2(w, rebel)).toBeGreaterThan(SMALL_STATE_KM2);
  expect(km2(w, rebel)).toBeLessThan(STATELET_KM2);
  expect(w.wars.atWar(USA, rebel)).toBe(true);
  return { w, rebel };
}

describe('a statelet founded in play is annexed whole at a peace it loses (PLAN 7.3d2)', () => {
  it('rebels on Maryland that lose their war are annexed whole', () => {
    const { w, rebel } = marylandRebels();
    makePeace(w, warOf(w, USA, rebel, USA, 50));
    expect(w.nations.cols.living[rebel]).toBe(0);
    expect(km2(w, rebel)).toBe(0);
  });

  it('a white peace leaves them be', () => {
    const { w, rebel } = marylandRebels();
    makePeace(w, warOf(w, USA, rebel, USA, 0));
    expect(w.nations.cols.living[rebel]).toBe(1);
  });

  it('nor are they annexed when they win', () => {
    const { w, rebel } = marylandRebels();
    makePeace(w, warOf(w, USA, rebel, rebel, 50));
    expect(w.nations.cols.living[rebel]).toBe(1);
  });

  it('a nation of the scenario of that size keeps its life', () => {
    const w = world1938();
    expect(isFounded(w, BEL)).toBe(false);
    expect(km2(w, BEL)).toBeGreaterThan(SMALL_STATE_KM2);
    expect(km2(w, BEL)).toBeLessThan(STATELET_KM2);
    expect(declareWar(w, GER, BEL, true)).not.toBeNull();
    makePeace(w, warOf(w, GER, BEL, GER, 50));
    expect(w.nations.cols.living[BEL]).toBe(1);
  });

  it('and so does a revived one', () => {
    const w = world1938();
    // Belgium is taken by Germany and returns on its land.
    const land = new Set<number>();
    w.cells.owner.forEach((o, c) => {
      if (o !== BEL) return;
      land.add(w.cells.province[c]!);
      w.setOwner(c, GER);
      w.setController(c, GER);
    });
    expect(spawnRebels(w, [...land].sort((a, b) => a - b), GER, BEL)).toBe(BEL);
    expect(w.nations.cols.living[BEL]).toBe(1);
    expect(isFounded(w, BEL)).toBe(false);
    expect(km2(w, BEL)).toBeLessThan(STATELET_KM2);
    makePeace(w, warOf(w, GER, BEL, GER, 50));
    expect(w.nations.cols.living[BEL]).toBe(1);
  });
});
