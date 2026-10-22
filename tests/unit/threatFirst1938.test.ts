import { describe, expect, it } from 'vitest';
import { DEPLOY_RANGE_CELLS, OP_PROBE, type SectorsSeen } from '../../src/sim/ai/operational';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 7.79b (ADR-634): the threatened sectors are allotted first. A long front with a small
// enemy on it and a few divisions near it: before, the allotment by 1 + threat / THREAT_UNIT gave
// the threatened sectors some of them and spread the rest over the empty front by its
// length; now every division within the range of a threatened sector is allotted to one.

const W = SIZE_1938.w;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];

describe('threatened sectors first (PLAN 7.79b, ADR-634)', () => {
  it('on a long front with one small enemy, the divisions within its range all go to the sectors it threatens', () => {
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [GER, POL]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    // Only Germany plans: Poland's one division stands where it is.
    w.nations.forEach((n) => {
      if (n !== GER) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[GER] = 0;
    const land = (n: number): number[] => w.formations.ids().filter((id) => f.nation[id] === n && !w.isFleet(id) && !w.isWing(id) && !w.offLand(id));
    const d2 = (a: number, b: number): number => {
      let dx = Math.abs(f.x[a]! - f.x[b]!);
      if (dx > W / 2) dx = W - dx;
      return dx * dx + (f.y[a]! - f.y[b]!) ** 2;
    };
    // Poland keeps the division nearest a German one; Germany the six nearest to it.
    const ger = land(GER);
    const pol = land(POL);
    let keep = pol[0]!;
    let kd = Infinity;
    for (const p of pol) for (const g of ger) if (d2(p, g) < kd) [kd, keep] = [d2(p, g), p];
    for (const p of pol) if (p !== keep) destroyFormation(w, p);
    const near = ger.slice().sort((a, b) => d2(a, keep) - d2(b, keep) || a - b);
    for (const g of near.slice(6)) destroyFormation(w, g);
    for (const g of near.slice(0, 6)) f.moving[g] = 0;
    expect(Math.sqrt(d2(near[5]!, keep))).toBeLessThan(DEPLOY_RANGE_CELLS / 2);
    runEvents(s, 1);
    w.wars.start([GER], [POL], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    const plans: SectorsSeen[] = [];
    OP_PROBE.sectors = (p) => {
      if (p.nation === GER) plans.push(p);
    };
    try {
      runEvents(s, 24);
    } finally {
      delete OP_PROBE.sectors;
    }
    const first = plans[0]!;
    expect(first).toBeDefined();
    // A long front: many sectors, few of them threatened.
    expect(first.sectors.length).toBeGreaterThan(20);
    const threatened = first.sectors.filter((x) => x.threat > 0);
    expect(threatened.length).toBeGreaterThan(0);
    expect(threatened.length).toBeLessThan(first.sectors.length / 4);
    const canTake = first.classes.reduce((t, c) => t + c.canTake, 0);
    const filled = first.classes.reduce((t, c) => t + c.filled, 0);
    expect(canTake).toBeGreaterThanOrEqual(4);
    // Every division within the range of a threatened sector is placed in one (before: 4 of 6).
    expect(filled).toBe(canTake);
    expect(threatened.reduce((t, x) => t + x.n, 0)).toBe(canTake);
  }, 180_000);
});
