import { describe, expect, it } from 'vitest';
import { DISBAND_MANPOWER, economicAi } from '../../src/sim/ai/economic';
import { HOLLOW_MEN, MERGE_KM } from '../../src/sim/ai/hollow';
import { isDayStart, isMonthStart } from '../../src/shared/calendar';
import { kmPerCell } from '../../src/sim/data/projection';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { bleedFormation, elementIndex } from '../../src/sim/systems/elements';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.116a (ADR-701): a land formation of an AI nation under HOLLOW_MEN men, out of contact,
// is folded daily into the nearest formation of its nation with room on the same landmass within
// MERGE_KM, or disbanded with DISBAND_MANPOWER of its men back to the pool. Before (critic run 14,
// R14-B1), 63.5 → 76.3 such remnants a world stood at year 20, never refilled on occupied land.

const GER = nationId('GER');

/** The 1938 world on day 2 at 00:00: a day's start that is not a month's, so the economic AI's day is the fold alone. */
function world1938(): World {
  const w = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
  w.tick = 24;
  expect(isDayStart(w.tick)).toBe(true);
  expect(isMonthStart(w.startDay, w.tick)).toBe(false);
  return w;
}

/** The economic AI's system as the 1938 game runs it, one call. */
const day = (w: World): void => economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);

/** Germany's land formations on land with elements, at their template's strength, ids ascending. */
function fullGerman(w: World): number[] {
  const fc = w.formations.cols;
  return w.formations.ids().filter((id) => {
    const rule = w.rules!.templates[fc.template[id]!];
    return fc.nation[id] === GER && !!rule && rule.domain === Domain.land && !w.offLand(id) && fc.strength[id] === rule.manpower && (elementIndex(w).get(id)?.length ?? 0) >= 4;
  });
}

/** Germany's land formations on land below their template's strength. */
function germanWithRoom(w: World): number[] {
  const fc = w.formations.cols;
  return w.formations.ids().filter((id) => {
    const rule = w.rules!.templates[fc.template[id]!];
    return fc.nation[id] === GER && !!rule && rule.domain === Domain.land && !w.offLand(id) && fc.strength[id]! < rule.manpower;
  });
}

/** Bleeds `id` until it has fewer than HOLLOW_MEN men and some left. */
function hollowOut(w: World, id: number): number {
  const fc = w.formations.cols;
  bleedFormation(w, id, 1 - 300 / fc.strength[id]!);
  const men = fc.strength[id]!;
  expect(men).toBeGreaterThan(0);
  expect(men).toBeLessThan(HOLLOW_MEN);
  return men;
}

describe('hollow divisions are folded or sent home (PLAN 7.116a)', () => {
  it("a hollow division's men join the formation of its nation beside it with room, and it is gone", () => {
    const w = world1938();
    // Germany's other formations full, so the one bled to half is the only one with room.
    expect(germanWithRoom(w)).toEqual([]);
    const [a, b] = fullGerman(w);
    const fc = w.formations.cols;
    bleedFormation(w, b!, 0.5);
    const room = w.rules!.templates[fc.template[b!]!]!.manpower - fc.strength[b!]!;
    const men = hollowOut(w, a!);
    expect(room).toBeGreaterThan(men);
    // The hollow one stands 10 km from the receiver.
    fc.x[a!] = fc.x[b!]! + 10 / kmPerCell(w.cells.w);
    fc.y[a!] = fc.y[b!]!;
    const before = fc.strength[b!]!;
    const pool = w.nations.cols.manpower[GER]!;
    day(w);
    expect(w.formations.has(a!)).toBe(false);
    // Its men are the receiver's, to a unit (the receiver's units are of up to a few dozen men).
    expect(fc.strength[b!]! - before).toBeGreaterThan(men - 100);
    expect(fc.strength[b!]! - before).toBeLessThanOrEqual(men);
    const left = men - (fc.strength[b!]! - before);
    expect(w.nations.cols.manpower[GER]! - pool).toBeCloseTo(DISBAND_MANPOWER * left, 6);
  });

  it('with no formation of its nation with room within MERGE_KM, it is disbanded, half its men to the pool', () => {
    const w = world1938();
    const [a, b] = fullGerman(w);
    const fc = w.formations.cols;
    bleedFormation(w, b!, 0.5);
    const men = hollowOut(w, a!);
    // The only one with room is beyond MERGE_KM.
    fc.x[a!] = fc.x[b!]! + (MERGE_KM + 20) / kmPerCell(w.cells.w);
    fc.y[a!] = fc.y[b!]!;
    const before = fc.strength[b!]!;
    const pool = w.nations.cols.manpower[GER]!;
    day(w);
    expect(w.formations.has(a!)).toBe(false);
    expect(fc.strength[b!]).toBe(before);
    expect(w.nations.cols.manpower[GER]! - pool).toBeCloseTo(DISBAND_MANPOWER * men, 6);
  });

  it('a hollow division in contact, or of a nation without AI, is kept', () => {
    const w = world1938();
    const [a, c] = fullGerman(w);
    const fc = w.formations.cols;
    hollowOut(w, a!);
    hollowOut(w, c!);
    fc.engaged[a!] = 1;
    day(w);
    expect(w.formations.has(a!)).toBe(true);
    expect(w.formations.has(c!)).toBe(false);

    const w2 = world1938();
    const [a2] = fullGerman(w2);
    hollowOut(w2, a2!);
    w2.nations.cols.aiOff[GER] = 1;
    day(w2);
    expect(w2.formations.has(a2!)).toBe(true);
  });
});
