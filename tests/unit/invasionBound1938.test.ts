import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { sendToPort } from '../../src/sim/ai/invasion';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.7 (critic R7-B2): with no formation at its transports' port, the invasion AI sends its
// free formations there, the nearest first, until their men fill the room. Seed 3371's Italy, its
// port out of its army's reach by land, tried all its 109 formations each week from year 27, each a
// failed search of the map (about 10 ms): calls of 0.7 to 1.1 s, 86 % of the tick. The first that
// cannot be ordered there now ends it.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');

describe('the invasion AI sends formations to its port until one cannot go (PLAN 7.7)', () => {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  sim.step(1);
  const c = world.formations.cols;
  const german: number[] = [];
  world.formations.forEach((id) => {
    if (c.nation[id] === GER && !world.isFleet(id) && !world.isWing(id) && !world.offLand(id) && c.moving[id] !== 1 && german.length < 5) german.push(id);
  });

  const rejected = (): number => {
    const ev = world.out.events;
    let n = 0;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && german.includes(ev[i + 2]!)) n++;
    return n;
  };

  it('to a place no land route reaches (London from Germany): one refused, the rest not tried', () => {
    expect(german).toHaveLength(5);
    world.out.events.length = 0;
    const [lx, ly] = cellOf(-0.13, 51.5, W, H);
    const [x, y] = [lx + 0.5, ly + 0.5];
    const men = sendToPort(world, german, x, y, 1e9);
    expect(men).toBe(0);
    expect(rejected()).toBe(1);
    for (const id of german) expect(c.moving[id]).not.toBe(1);
  });

  it('to a place in reach (Munich): each sent while the room holds their men', () => {
    world.out.events.length = 0;
    const [mx, my] = cellOf(11.58, 48.14, W, H);
    const [x, y] = [mx + 0.5, my + 0.5];
    const all = german.reduce((t, id) => t + c.strength[id]!, 0);
    expect(sendToPort(world, german, x, y, 1e9)).toBe(all);
    expect(rejected()).toBe(0);
    // A room for the first two: two sent, and no more tried.
    const sim2 = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    sim2.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    sim2.step(1);
    const c2 = sim2.world.formations.cols;
    const room = c2.strength[german[0]!]! + c2.strength[german[1]!]!;
    expect(sendToPort(sim2.world, german, x, y, room)).toBe(room);
    expect(german.filter((id) => c2.moving[id] === 1).length).toBeLessThanOrEqual(2);
  });
});
