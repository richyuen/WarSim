import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { equipFormation } from '../../src/sim/systems/elements';
import { orderSail } from '../../src/sim/systems/sail';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.8k (the tenth read): two fleets meet in a sea battle only if one of them has a weapon
// the other can be hit by. Two submarine flotillas (torpedoes, which no submarine is a target
// of, and no depth charges) met and stayed in a battle with no shot for the rest of the war,
// held where they stood.

const W = SIZE_1938.w;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const tpl = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);

function fleet(world: World, n: number, t: string, x: number, y: number): number {
  const f = world.formations;
  const k = f.create();
  const c = f.cols;
  c.nation[k] = n;
  c.x[k] = x;
  c.y[k] = y;
  c.template[k] = tpl(t);
  c.supply[k] = 1;
  c.org[k] = 1;
  equipFormation(world, k, tpl(t));
  return k;
}

/** Germany and the United Kingdom at war, the AI off; a German fleet and a British one 5 km apart in the North Atlantic. */
function pair(german: string, british: string): { s: Sim; a: number; b: number } {
  const s = new Sim({ scenario: '1938', seed: 4301, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  declareWar(w, id('GER'), id('ENG'), true);
  const [cx, cy] = cellOf(-32, 47, W, SIZE_1938.h).map(Math.floor) as [number, number];
  const a = fleet(w, id('GER'), german, cx + 0.5, cy + 0.5);
  const b = fleet(w, id('ENG'), british, cx + 0.5 + 5 / navOf(w).grid.kx[cy]!, cy + 0.5);
  return { s, a, b };
}

describe('a sea battle needs a weapon the other side can be hit by (PLAN 4.8k)', () => {
  it('two enemy submarine flotillas 5 km apart do not fight, and sail on when ordered', () => {
    const { s, a, b } = pair('submarine_flotilla', 'submarine_flotilla');
    const w = s.world;
    const c = w.formations.cols;
    s.step(1);
    expect(w.seaBattles).toEqual([]);
    expect([c.engaged[a], c.engaged[b]]).toEqual([0, 0]);
    const [hx, hy] = cellOf(-10, 50, W, SIZE_1938.h);
    orderSail(w, b, hx, hy);
    orderSail(w, a, hx, hy - 5);
    const x0 = [c.x[a]!, c.x[b]!];
    s.step(24);
    expect(c.x[a]).not.toBe(x0[0]);
    expect(c.x[b]).not.toBe(x0[1]);
  });

  it('a destroyer flotilla (depth charges) and a submarine flotilla (torpedoes) do fight', () => {
    const { s, a, b } = pair('submarine_flotilla', 'destroyer_flotilla');
    s.step(1);
    expect(s.world.seaBattles.length).toBe(1);
    expect([s.world.formations.cols.engaged[a], s.world.formations.cols.engaged[b]]).toEqual([1, 1]);
  });
});
