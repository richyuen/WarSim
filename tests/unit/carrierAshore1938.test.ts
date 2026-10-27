import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airAi } from '../../src/sim/ai/air';
import { airSystem, kmFromBase, wingRange } from '../../src/sim/systems/air';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.145 (ADR-738): a carrier's wings, their fleet at war and in no sea battle, take a naval bomber's missions
// from the deck: the enemy's fleet nearest in range, else its land formations in range; they never rebase. In a sea
// battle they strike for their fleet (PLAN 5.4d). Before, the AI gave a carrier's wings no mission: they struck only
// in a sea battle, and the carriers at war stood by the ports of enemies with no fleet afloat (PLAN 7.141).

const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];

/** Britain and Germany at war, Germany's fleets gone, a German division in Scotland; the AI on for Britain alone. */
function setup(): { w: World; wing: number; fleet: number; div: number } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.nations.forEach((n) => (w.nations.cols.aiOff[n] = n === ENG ? 0 : 1));
  w.wars.start([ENG], [GER], 0);
  w.formations.forEach((id) => {
    if (w.isFleet(id) && w.formations.cols.nation[id] === GER) destroyFormation(w, id);
  });
  const [wing, base] = [...w.wingBase].find(([id, b]) => b < 0 && w.formations.cols.nation[id] === ENG)!;
  const [x, y] = cellOf(-4.2, 57.5, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
  const div = addDivision(w, GER, x + 0.5, y + 0.5);
  return { w, wing, fleet: -base, div };
}

describe("a carrier's wings strike ashore (PLAN 7.145)", () => {
  it('its fleet in no sea battle, a carrier wing strikes the enemy division in range from its deck', () => {
    const { w, wing, fleet, div } = setup();
    const c = w.formations.cols;
    expect(kmFromBase(w, wing, c.x[div]!, c.y[div]!)).toBeLessThanOrEqual(wingRange(w, wing));
    airAi(w);
    expect(w.wingMission.get(wing)).toEqual({ kind: 'strike', x: c.x[div], y: c.y[div] });
    // From the deck: its base is still its fleet.
    expect(w.wingBase.get(wing)).toBe(-fleet);
    // The hour's scheduler launches it from the fleet.
    airSystem(w);
    const s = w.sorties.get(wing)!;
    expect([s.bx, s.by, s.tx, s.ty]).toEqual([c.x[fleet], c.y[fleet], c.x[div], c.y[div]]);
  });

  it('with no enemy in range it has no mission and stays aboard: no rebase', () => {
    const { w, wing, fleet, div } = setup();
    destroyFormation(w, div);
    // Mid-Atlantic: Germany's land beyond its range.
    const c = w.formations.cols;
    [c.x[fleet], c.y[fleet]] = cellOf(-35, 45, SIZE_1938.w, SIZE_1938.h).map((v) => Math.floor(v) + 0.5) as [number, number];
    airAi(w);
    expect(w.wingMission.has(wing)).toBe(false);
    expect(w.wingBase.get(wing)).toBe(-fleet);
  });

  it('its fleet in a sea battle, no mission; one held ends in the air system\'s hour, a player\'s stands', () => {
    const { w, wing, fleet, div } = setup();
    const c = w.formations.cols;
    w.seaBattles.push({ fleets: [fleet], ships: [1], range: 20, a: ENG, b: GER, lostA: 0, lostB: 0, x: c.x[fleet]!, y: c.y[fleet]! });
    airAi(w);
    expect(w.wingMission.has(wing)).toBe(false);
    w.wingMission.set(wing, { kind: 'strike', x: c.x[div]!, y: c.y[div]! });
    airSystem(w);
    expect(w.wingMission.has(wing)).toBe(false);
    expect(w.sorties.has(wing)).toBe(false);
    // Britain's AI off: the player's order stands.
    w.nations.cols.aiOff[ENG] = 1;
    w.wingMission.set(wing, { kind: 'strike', x: c.x[div]!, y: c.y[div]! });
    airSystem(w);
    expect(w.wingMission.get(wing)).toEqual({ kind: 'strike', x: c.x[div], y: c.y[div] });
  });
});
