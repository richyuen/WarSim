import { describe, expect, it } from 'vitest';
import type { FromWorker, Snapshot, Subscription } from '../../src/shared/protocol';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 7.4g3 (ADR-460): the T1 order arrow ended at the target cell's middle; the formation will
// stand at the cell's point (`cellPoint`: its land point where the middle is water, up to 0.6
// cells off on a coast). A march on land now has its way in the snapshot: its place and where it
// will stand. A German division sent to a German coastal cell whose middle is water: its way ends
// at that cell's land point, and the division stands there when it arrives.

const { w: W } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

describe('the end of a march on land in the snapshot (PLAN 7.4g3)', () => {
  it('is where the formation will stand: the target cell\'s land point on a coast', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const world = sim.world;
    sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    sim.step(1);
    // A German cell of the Baltic coast whose middle is water, with a German land cell beside it inland.
    let target = -1;
    let start = -1;
    for (let y = 230; y < 260 && target < 0; y++)
      for (let x = 1080; x < 1150 && target < 0; x++) {
        const c = y * W + x;
        if (world.cells.owner[c] !== GER || world.onLand(x + 0.5, y + 0.5)) continue;
        const inland = (y + 1) * W + x;
        if (world.cells.owner[inland] === GER && world.onLand(x + 0.5, y + 1.5)) [target, start] = [c, inland];
      }
    expect(target, 'a German coastal cell whose middle is water').toBeGreaterThan(0);
    const [px, py] = world.cellPoint(target);
    const mid = [(target % W) + 0.5, Math.floor(target / W) + 0.5];
    expect(Math.hypot(px - mid[0]!, py - mid[1]!), 'its point off its middle').toBeGreaterThan(0.05);

    const before = world.formations.highWater;
    sim.command({ kind: 'spawnFormation', nation: GER, x: (start % W) + 0.5, y: Math.floor(start / W) + 0.5, strength: 0, template: INF });
    sim.step(1);
    const f = before;
    sim.command({ kind: 'moveFormation', id: f, x: (target % W) + 0.5, y: Math.floor(target / W) + 0.5 });
    sim.step(1);
    expect(world.formations.cols.moving[f]).toBe(1);

    // The snapshot the page gets.
    let snap: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') snap = m.snap;
    });
    server.sim = sim;
    const sub: Subscription = { bbox: [1000, 200, 1200, 300], z: 0, tier: 1, wantsElements: false };
    server.handle({ type: 'subscribe', sub }, 0);
    expect(snap).not.toBeNull();
    const s = snap! as Snapshot;
    const i = Array.from(s.formations.id.subarray(0, s.formations.count)).indexOf(f);
    expect(i).toBeGreaterThanOrEqual(0);
    const way = Array.from(s.formations.way.subarray(s.formations.wayStart[i]!, s.formations.wayStart[i + 1]!));
    expect(way).toHaveLength(4);
    expect(way[2]!).toBeCloseTo(px, 4);
    expect(way[3]!).toBeCloseTo(py, 4);

    // And there it stands when it has arrived.
    for (let h = 0; h < 24 * 5 && world.formations.cols.moving[f] === 1; h++) sim.step(1);
    expect(world.formations.cols.moving[f]).toBe(0);
    expect(world.formations.cols.x[f]!).toBeCloseTo(px, 9);
    expect(world.formations.cols.y[f]!).toBeCloseTo(py, 9);
  });
});
