import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { hash32, hashToUnit } from '../../src/sim/core/hash';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { applyLoss, applyWholeLoss, elementIndex } from '../../src/sim/systems/elements';
import { ARM_ARMOUR, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.23a: a tank is knocked out or it is not. An element of armour under an hour's fire loses
// the whole tanks of its damage, and one more with the chance of the rest; nothing is carried. The
// critic's case (run 8, seed 3929): armoured division 41 in contact with France's 220 from hour 72
// took 3.5 tanks of fire in 48 hours, in fractions over its 34 elements, and lost none.
// Restated by PLAN 7.79b (ADR-634): with the army allotted to the threatened sectors first, the
// division marches east to the Polish front and is first fired at in hour 237 (before, France's 220
// from hour 72); the 48 hours are from hour 231, about its contact.

/** A world of one element, for the loss alone. */
function one(strength: number, wound = 0): World {
  return { elements: { cols: { strength: new Float64Array([0, strength]), wound: new Float64Array([0, wound]) } } } as unknown as World;
}

describe('applyWholeLoss', () => {
  it('loses the whole units, and one more when the draw is under the rest; carries nothing', () => {
    let w = one(10);
    expect(applyWholeLoss(w, 1, 2.3, 0.29)).toBe(3);
    expect([w.elements.cols.strength[1], w.elements.cols.wound[1]]).toEqual([7, 0]);
    w = one(10);
    expect(applyWholeLoss(w, 1, 2.3, 0.31)).toBe(2);
    expect([w.elements.cols.strength[1], w.elements.cols.wound[1]]).toEqual([8, 0]);
    // What another loss carried counts with it, and an element loses no more than it has.
    w = one(10, 0.6);
    expect(applyWholeLoss(w, 1, 0.5, 0.99)).toBe(1);
    w = one(2);
    expect(applyWholeLoss(w, 1, 5, 0)).toBe(2);
    expect(w.elements.cols.strength[1]).toBe(0);
  });

  it("over many elements and hours its mean is applyLoss's, by the sim's own draws", () => {
    for (const f of [0.01, 0.1, 0.37, 0.8]) {
      let whole = 0;
      const n = 20_000;
      for (let i = 0; i < n; i++) whole += applyWholeLoss(one(10), 1, f, hashToUnit(hash32(99, i >> 5, i & 31, 0x6b17)));
      expect(Math.abs(whole / n - f), `fraction ${f}`).toBeLessThan(4 * Math.sqrt((f * (1 - f)) / n));
      // The carried rule: the same damage takes a whole tank only once it has summed to one.
      const carried = one(10);
      for (let i = 0; i < Math.floor(0.99 / f); i++) applyLoss(carried, 1, f);
      expect(carried.elements.cols.strength[1]).toBe(10);
    }
  });
});

describe("the critic's armour fight (seed 3929, Germany on Poland and France)", () => {
  it('armoured division 41 loses whole tanks in contact, each in an hour its element was fired at, and the same by seed', () => {
    const run = (): { lost: number; offFire: number; hash: number } => {
      const sim = new Sim({ scenario: '1938', seed: 3929, assets: assets1938(SIZE_1938.w) });
      sim.command({ kind: 'declareWar', attacker: nationId('GER'), defender: nationId('POL') });
      sim.command({ kind: 'declareWar', attacker: nationId('GER'), defender: nationId('FRA') });
      sim.step(231);
      const w = sim.world;
      const ec = w.elements.cols;
      const units = w.rules!.units;
      const tanks = (): Map<number, number> => new Map((elementIndex(w).get(41) ?? []).filter((e) => (units[ec.unit[e]!]!.arm & ARM_ARMOUR) !== 0).map((e) => [e, ec.strength[e]!]));
      let was = tanks();
      expect(was.size).toBe(34);
      let lost = 0;
      let offFire = 0;
      for (let h = 0; h < 48; h++) {
        const fired = new Set<number>();
        sim.step(1, (world) => {
          const f = world.out.fires;
          for (let i = 0; i + FIRE_STRIDE <= f.length; i += FIRE_STRIDE) fired.add(f.data[i + FireField.target]!);
          world.out.fires.length = 0;
          world.out.events.length = 0;
        });
        const now = tanks();
        for (const [e, had] of was) {
          const has = now.get(e) ?? 0;
          if (has < had) {
            lost += had - has;
            if (!fired.has(e)) offFire += had - has;
          }
        }
        was = now;
      }
      return { lost, offFire, hash: sim.hash() };
    };
    const a = run();
    // 3.5 tanks of fire in the 48 hours: lost whole and under fire (breakdowns and attrition carry as before).
    process.stderr.write(`division 41: ${a.lost} tanks lost in 48 hours
`);
    expect(a.lost).toBeGreaterThanOrEqual(1);
    expect(a.offFire).toBe(0);
    expect(run()).toEqual(a);
  }, 120_000);
});
