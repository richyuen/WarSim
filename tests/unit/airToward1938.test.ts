import { describe, expect, it } from 'vitest';
import { airAi } from '../../src/sim/ai/air';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, FERRY_RANGE, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.12a (the critic's R5-B2): on seed 7321 most of the AI's wings at war sat at bases out of
// range of every front, the median front two ranges off, and were given no mission. A wing with a
// front to serve and none of it in range now rebases toward it, a hop a day, until it is in range
// and is tasked.

const [SOV, POL] = ['SOV', 'POL'].map(nationId) as [number, number];

describe('a wing out of range of its front (PLAN 5.12a)', () => {
  it('rebases toward it a hop a day, each hop within its range and nearer, and is tasked there', () => {
    const w: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const c = w.formations.cols;
    w.wars.start([SOV], [POL], 0);
    // The front, on the Polish border: a Polish formation and the Soviet one nearest it, in contact.
    // (In the far east no Soviet airbase is within 5,000 km of the front: a wing there stays.)
    let pol = -1;
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.offLand(id) && c.nation[id] === POL && pol < 0) pol = id;
    });
    let ger = -1;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.offLand(id) || c.nation[id] !== SOV) return;
      if (ger < 0 || seaKm(w, c.x[id]!, c.y[id]!, c.x[pol]!, c.y[pol]!) < seaKm(w, c.x[ger]!, c.y[ger]!, c.x[pol]!, c.y[pol]!)) ger = id;
    });
    c.engaged[ger] = 1;
    c.engaged[pol] = 1;
    // A Soviet fighter wing at the Soviet airbase furthest from that front.
    const fighter = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === SOV && w.rules!.units[w.rules!.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'fighter')![0];
    const fromFront = (base: number): number => {
      const p = basePlace(w, base)!;
      return seaKm(w, p[0], p[1], c.x[ger]!, c.y[ger]!);
    };
    const range = wingRange(w, fighter);
    // Its base: the Soviet airbase furthest from the front that is out of range of it and has
    // another, nearer it, within a ferry flight (1938's are few: the furthest has none).
    const soviet = w.airbases.map((_, i) => i + 1).filter((b) => w.cells.controller[w.airbases[b - 1]!.cell] === SOV);
    const hop = (a: number, b: number): number => {
      const [p, q] = [basePlace(w, a)!, basePlace(w, b)!];
      return seaKm(w, p[0], p[1], q[0], q[1]);
    };
    const far = soviet.filter((b) => fromFront(b) > range && soviet.some((o) => fromFront(o) < fromFront(b) && hop(b, o) <= FERRY_RANGE * range)).sort((a, b) => fromFront(b) - fromFront(a))[0];
    expect(far, 'a Soviet airbase out of range with a hop toward the front').toBeDefined();
    w.wingBase.set(fighter, far!);
    w.wingMission.delete(fighter);
    [c.x[fighter], c.y[fighter]] = basePlace(w, far!)!;
    expect(fromFront(far!), 'out of range of the front').toBeGreaterThan(range);

    const hops: number[] = [fromFront(far!)];
    for (let day = 0; day < 30 && !w.wingMission.has(fighter); day++) {
      const was = w.wingBase.get(fighter)!;
      airAi(w);
      const now = w.wingBase.get(fighter)!;
      if (now === was) continue;
      // Each hop a ferry's reach (FERRY_RANGE ranges) from the base before, and nearer the front.
      const [a, b] = [basePlace(w, was)!, basePlace(w, now)!];
      expect(seaKm(w, a[0], a[1], b[0], b[1])).toBeLessThanOrEqual(FERRY_RANGE * range);
      expect(fromFront(now)).toBeLessThan(hops.at(-1)!);
      hops.push(fromFront(now));
    }
    expect(hops.length, 'a hop at least').toBeGreaterThan(1);
    expect(w.wingMission.get(fighter)?.kind, 'tasked once in range').toBe('patrol');
    expect(hops.at(-1)!).toBeLessThanOrEqual(range);
    process.stderr.write(`fighter ${fighter}: range ${range.toFixed(0)} km; from the front ${hops.map((d) => d.toFixed(0)).join(' → ')} km\n`);
  });
});
