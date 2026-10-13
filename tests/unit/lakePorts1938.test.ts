import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { sailRoute } from '../../src/sim/nav/sailRoute';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { nearestOwnPort } from '../../src/sim/systems/navalCombat';
import { shipyard } from '../../src/sim/systems/production';
import { laneOf, navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.8o (the tenth read): a fleet's nearest port and a nation's shipyard were chosen among
// ports no sea reaches, 22 of them on the Great Lakes, the Caspian and the African lakes: Iran's
// shipyard was on the Caspian, and a fleet that broke off off New York sailed for Toronto, with
// no way there. Ports a ship reaches only.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

describe('a fleet\'s home and a shipyard are ports a ship reaches (PLAN 4.8o)', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  const water = portSeaOf(w);
  const ref = water[w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Portsmouth')]!;
  const reaches = (at: number): boolean => sailRoute(navOf(w).grid, seaOf(w), laneOf(w), ref, at) !== null;

  it('every living nation\'s shipyard has a way to the world\'s seas (Iran\'s not on the Caspian)', () => {
    const lake: string[] = [];
    w.nations.forEach((n) => {
      if (w.nations.cols.living[n] !== 1) return;
      const y = shipyard(w, n);
      if (y >= 0 && !reaches(water[y]!)) lake.push(NATIONS_1938[n - 1]!.tag);
    });
    expect(lake).toEqual([]);
    const iran = shipyard(w, id('IRN'));
    if (iran >= 0) expect(reaches(water[iran]!)).toBe(true);
  });

  it('a Canadian fleet off New York sails home to a port it reaches, not Toronto', () => {
    let fleet = 0;
    w.formations.forEach((f) => {
      if (fleet === 0 && w.isFleet(f)) fleet = f;
    });
    const c = w.formations.cols;
    c.nation[fleet] = id('CAN');
    const [x, y] = cellOf(-73.0, 40.3, W, H);
    c.x[fleet] = x!;
    c.y[fleet] = y!;
    const at = nearestOwnPort(w, fleet);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(reaches(at), 'a port on a lake').toBe(true);
  });
});
