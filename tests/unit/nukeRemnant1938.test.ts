import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { bleedFormation, destroyFormation } from '../../src/sim/systems/elements';
import { placeParts, TARGET_SCALE, THEATRE_FLOOR, THEATRE_MEN_MIN } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.32 (critic R9-B2, ADR-528): seed 2609's Soviet Union struck China's last men week after
// week, 10,847 → 1,373 → 168 → 24 dead, each burst 87 % of the side's men left and each of value
// 1: a place's men were weighed as a share of the side's, and the side was a few thousand men.
// The theatre now counts for at least THEATRE_MEN_MIN men: a burst is worth what it destroys.

const { w: W, h: H } = SIZE_1938;
const [SOV, TIB] = ['SOV', 'TIB'].map(nationId) as [number, number];

describe("a beaten side's last men are not a warhead's worth (PLAN 7.32)", () => {
  it('a lone division of a side of one division is worth what it is, three massed are worth a warhead', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    const war = w.wars.start([SOV], [TIB], 0);
    const c = w.formations.cols;
    // Tibet's army: one division, far from Lhasa (no capital in the blast).
    w.formations.ids().forEach((id) => {
      if (c.nation[id] === TIB) destroyFormation(w, id);
    });
    const [x, y] = cellOf(86.0, 31.5, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
    const div = addDivision(w, TIB, x, y);
    const men = c.strength[div]!;
    expect(men).toBeGreaterThan(5000);
    const one = placeParts(w, SOV, war, 0, x, y);
    process.stderr.write(`one division of ${men} men, the side's all: men share ${one.menShare.toFixed(4)} of ${one.theatreMen}, value ${one.value.toFixed(3)} (through ${one.through.toFixed(2)})\n`);
    expect(one.sideMen).toBe(men);
    expect(one.capital).toBe(0);
    expect(one.theatreMen).toBe(THEATRE_MEN_MIN);
    // Before: weighed against its own men (the theatre, above THEATRE_FLOOR of the side): about
    // 0.9 of them in the blast, a share of 9 tenths, value 1.
    const hit = one.menShare * one.theatreMen;
    const before = Math.min(1, (TARGET_SCALE * hit) / Math.max(one.menAll, THEATRE_FLOOR * one.sideMen));
    expect(before).toBe(1);
    // Now what it destroys: its men in the blast, against the floor.
    expect(one.value).toBeLessThanOrEqual(((TARGET_SCALE * men) / THEATRE_MEN_MIN) * one.through + 1e-9);
    expect(one.value).toBeLessThan(0.5 * one.through);

    // Its remnant (a tenth of it, the chain's second burst) is worth a tenth of that.
    const ids = w.formations.ids().filter((id) => c.nation[id] === TIB);
    expect(ids).toEqual([div]);
    bleedFormation(w, div, 0.9);
    const rest = placeParts(w, SOV, war, 0, x, y);
    process.stderr.write(`its remnant of ${c.strength[div]} men: value ${rest.value.toFixed(4)}\n`);
    expect(rest.value).toBeLessThan(one.value / 5);

    // Three divisions massed at one place: as many men as a warhead is worth, value whole.
    destroyFormation(w, div);
    for (let k = 0; k < 3; k++) addDivision(w, TIB, x, y);
    const three = placeParts(w, SOV, war, 0, x, y);
    process.stderr.write(`three massed (${three.sideMen} men): value ${three.value.toFixed(3)}\n`);
    expect(three.sideMen).toBeGreaterThan(THEATRE_MEN_MIN / TARGET_SCALE);
    expect(three.value).toBeCloseTo(three.through, 6);
  }, 300_000);
});
