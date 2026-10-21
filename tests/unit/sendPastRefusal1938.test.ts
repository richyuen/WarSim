import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { sendToPort } from '../../src/sim/ai/invasion';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.54 (ADR-594): the invasion AI's send to its port ended at the first formation whose march
// was refused (PLAN 7.7's bound), so with the nearest cut off from the port by a neutral nation
// nobody was sent, every week (seed 1129 year 20: Britain's nearest three in Turkey's way to Warri,
// the fourth's march open). A refusal on the port's land is now passed over. Germany in 1938: a
// division in East Prussia, the Polish corridor between it and Stettin, listed first; one in Germany
// second. Before, neither went.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');

describe('the send to the port passes over a march refused on its land (PLAN 7.54)', () => {
  it('the East Prussian division refused, the next sent', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const world = sim.world;
    sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    sim.step(1);
    const c = world.formations.cols;
    const german: number[] = [];
    world.formations.forEach((id) => {
      if (c.nation[id] === GER && !world.isFleet(id) && !world.isWing(id) && !world.offLand(id) && c.moving[id] !== 1 && german.length < 2) german.push(id);
    });
    expect(german).toHaveLength(2);
    const [cut, open] = german as [number, number];
    // The first to Königsberg, German ground beyond Poland's.
    const [kx, ky] = cellOf(20.51, 54.71, W, H).map(Math.floor) as [number, number];
    expect(world.cells.controller[ky * W + kx]).toBe(GER);
    [c.x[cut], c.y[cut]] = [kx + 0.5, ky + 0.5];
    world.paths.delete(cut);
    const [sx, sy] = cellOf(14.55, 53.43, W, H).map(Math.floor) as [number, number];
    expect(world.cells.controller[sy * W + sx]).toBe(GER);
    expect(navOf(world).grid.component[ky * W + kx]).toBe(navOf(world).grid.component[sy * W + sx]);
    world.out.events.length = 0;
    const men = sendToPort(world, [cut, open], sx + 0.5, sy + 0.5, 1e9);
    const ev = world.out.events;
    let refused = 0;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === cut) refused++;
    expect(refused).toBe(1);
    expect(c.moving[cut]).not.toBe(1);
    expect(c.moving[open]).toBe(1);
    expect(men).toBe(c.strength[open]);
  });
});
