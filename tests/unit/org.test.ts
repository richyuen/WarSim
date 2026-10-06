import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { ORG_FIRE, combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { ORG_RATE } from '../../src/sim/systems/supply';
import { FIRE_STRIDE } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { PZ, setUp } from '../helpers/pocket';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.2c: org. A formation that moves on engines and has no supply left loses its order,
// and gets it back on its network; its fire falls with it.
// AT (the second stage of 3.2's): unsupplied armour slows, then loses org.

const W = SIZE_1938.w;
const H = SIZE_1938.h;

describe('org (PLAN 3.2c)', () => {
  it('the dry panzer division loses its org after its speed; what walks keeps it', () => {
    const { s, pz, inf, mot, rifle, idle } = setUp(true);
    const f = s.world.formations.cols;
    for (const id of [pz, inf, mot, rifle, idle]) expect(f.org[id]).toBe(1);
    s.step(4);
    // Slowed since the first hour (fuel.test.ts), and not yet dry: in order.
    expect(f.supply[pz]!).toBeLessThan(0.05);
    expect(f.supply[pz]!).toBeGreaterThan(0);
    expect(f.org[pz]).toBe(1);
    s.step(1);
    expect(f.supply[pz]).toBe(0);
    expect(f.org[pz]).toBe(1 - ORG_RATE);
    s.step(15); // hour 20
    expect(f.org[pz]).toBe(1 - 16 * ORG_RATE);
    expect(f.supply[idle]).toBe(0); // armour that stood: dry in hour 8, 13 hours without
    expect(f.org[idle]).toBe(1 - 13 * ORG_RATE);
    expect(f.org[mot]!).toBeLessThan(1);
    expect(f.org[mot]!).toBeGreaterThan(f.org[pz]!);
    expect(f.supply[inf]).toBe(0);
    expect(f.supply[rifle]).toBe(0);
    expect(f.org[inf]).toBe(1);
    expect(f.org[rifle]).toBe(1); // its men walk; its tank battalion is not its order
    s.step(20);
    expect(f.org[pz]).toBe(0);
    expect(f.org[idle]).toBe(0);
    expect(f.org[inf]).toBe(1);
    expect(f.org[rifle]).toBe(1);
  });

  it('on its network a formation gets its org back; off it with supply left the org stands', () => {
    const fed = setUp(false);
    const f = fed.s.world.formations.cols;
    f.org[fed.pz] = 0.5;
    f.org[fed.idle] = 0;
    fed.s.step(4);
    expect(f.org[fed.pz]).toBe(0.5 + 4 * ORG_RATE);
    expect(f.org[fed.idle]).toBe(4 * ORG_RATE);
    expect(f.org[fed.inf]).toBe(1);
    const cut = setUp(true);
    const g = cut.s.world.formations.cols;
    g.org[cut.idle] = 0.5;
    cut.s.step(4);
    expect(g.supply[cut.idle]).toBe(0.5);
    expect(g.org[cut.idle]).toBe(0.5);
  });

  it("a formation's fire falls with its org, to a quarter with none", () => {
    const GER = nationId('GER');
    const POL = nationId('POL');
    const [x, y] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
    /** What a panzer division with this org deals a Polish division in one hour, and what it takes. */
    const hour = (org: number): { dealt: number; taken: number } => {
      const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
      const w = s.world;
      w.formations.ids().forEach((id) => destroyFormation(w, id));
      w.wars.set(GER, POL, true);
      const a = addDivision(w, GER, x + 0.5, y + 0.5, PZ);
      const b = addDivision(w, POL, x + 1.5, y + 0.5);
      w.formations.cols.org[a] = org;
      combatSystem(w);
      let dealt = 0;
      let taken = 0;
      const fires = w.out.fires;
      for (let i = 0; i < fires.length; i += FIRE_STRIDE) {
        const from = w.elements.cols.formation[fires[i + 2]!];
        if (from === a) dealt += fires[i + 5]!;
        else if (from === b) taken += fires[i + 5]!;
      }
      return { dealt, taken };
    };
    const whole = hour(1);
    const half = hour(0.5);
    const none = hour(0);
    expect(whole.dealt).toBeGreaterThan(0);
    expect(half.dealt / whole.dealt).toBeCloseTo(ORG_FIRE + (1 - ORG_FIRE) * 0.5, 9);
    expect(none.dealt / whole.dealt).toBeCloseTo(ORG_FIRE, 9);
    expect(ORG_FIRE).toBe(0.25);
    // What it takes does not depend on its org.
    expect(none.taken).toBe(whole.taken);
    expect(whole.taken).toBeGreaterThan(0);
  });

  it('org is state: a save has it, and the loaded game goes on as the saved one', () => {
    const { s, pz, idle } = setUp(true);
    s.step(20);
    const t = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    t.step(3); // a live sim with its own caches loads the save
    t.load(s.save());
    expect(t.world.formations.cols.org[pz]).toBe(1 - 16 * ORG_RATE);
    expect(t.world.formations.cols.org[idle]).toBe(1 - 13 * ORG_RATE);
    expect(t.hash()).toBe(s.hash());
    s.step(10);
    t.step(10);
    expect(t.world.formations.cols.org[pz]).toBe(s.world.formations.cols.org[pz]);
    expect(t.hash()).toBe(s.hash());
  });
});
