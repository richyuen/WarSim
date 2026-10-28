import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { equipFormation } from '../../src/sim/systems/elements';
import { closeOn } from '../../src/sim/systems/navalCombat';
import { orderSail } from '../../src/sim/systems/sail';
import { laneOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.156 (ADR-753): a sea battle's closing step that ended inside the Panama canal's jump
// stopped the fleet there, over the isthmus's land, in no sea zone; every order to it after was
// refused for no sea way (on seed 1448, a Japanese fleet at Balboa 8,255 times in nine years).

const { w: W } = SIZE_1938;

describe('a fleet closing through a canal (PLAN 7.156)', () => {
  it('keeps its way inside the passage, takes an order there, and comes out into the far sea', () => {
    const s = new Sim({ scenario: '1938', seed: 7156, assets: assets1938(W) });
    const world = s.world;
    world.settings.aiEnabled = false;
    const lanes = laneOf(world);
    const panama = world.seaPassages.findIndex((p) => p.id === 'panama');
    const edge = lanes.edges.find((e) => e.passage === panama)!;
    const caribbean = edge.cells[edge.landAt - 1]!;
    const pacific = edge.cells[edge.landAt]!;
    const zoneOf = seaOf(world).zoneOf;
    expect(zoneOf[caribbean]).not.toBe(zoneOf[pacific]);

    const f = world.formations;
    const c = f.cols;
    const id = f.create();
    c.nation[id] = NATIONS_1938.findIndex((n) => n.tag === 'JAP') + 1;
    [c.x[id], c.y[id]] = world.seaPoint(caribbean)!;
    c.template[id] = TEMPLATES_1938.findIndex((t) => t.id === 'destroyer_flotilla');
    c.supply[id] = 1;
    c.org[id] = 1;
    equipFormation(world, id, c.template[id]!);
    const zoneUnder = (): number => zoneOf[Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)]!;

    // An hour's closing of 36 km on a fleet beyond the isthmus: the straight line is over land,
    // so it sails its sea way, into the canal, and its hour ends there.
    const [px, py] = world.seaPoint(pacific)!;
    closeOn(world, id, px, py, 36);
    expect(zoneUnder()).toBe(0);
    expect(c.moving[id]).toBe(1);
    expect(world.paths.get(id)?.[c.pathStep[id]!]).toBe(caribbean);

    // An order there is taken: the way goes on from the jump it is in.
    world.out.events.length = 0;
    expect(orderSail(world, id, px, py)).toBe(true);
    const refused: number[] = [];
    for (let i = 0; i < world.out.events.length; i += 6) if (world.out.events[i + 1] === EventKind.MoveRejected) refused.push(world.out.events[i + 4]!);
    expect(refused).not.toContain(RejectReason.NoSeaWay);

    // And it sails out of the canal into the Pacific's zone within a few hours.
    s.step(6, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    expect(zoneUnder()).toBe(zoneOf[pacific]);
  });

  it('a fleet already under way inside the canal is not stopped there by a closing: it goes on from its step', () => {
    // Seed 1453: seven British fleets in the Suez canal's jump, in a battle, closed on an enemy;
    // the closing dropped their way first and then asked one from the land under them: refused,
    // and they stood there 13 years.
    const s = new Sim({ scenario: '1938', seed: 7156, assets: assets1938(W) });
    const world = s.world;
    world.settings.aiEnabled = false;
    const lanes = laneOf(world);
    const panama = world.seaPassages.findIndex((p) => p.id === 'panama');
    const edge = lanes.edges.find((e) => e.passage === panama)!;
    const caribbean = edge.cells[edge.landAt - 1]!;
    const pacific = edge.cells[edge.landAt]!;
    const zoneOf = seaOf(world).zoneOf;
    const f = world.formations;
    const c = f.cols;
    const id = f.create();
    c.nation[id] = NATIONS_1938.findIndex((n) => n.tag === 'JAP') + 1;
    [c.x[id], c.y[id]] = world.seaPoint(caribbean)!;
    c.template[id] = TEMPLATES_1938.findIndex((t) => t.id === 'destroyer_flotilla');
    c.supply[id] = 1;
    c.org[id] = 1;
    equipFormation(world, id, c.template[id]!);
    const [px, py] = world.seaPoint(pacific)!;
    expect(orderSail(world, id, px, py)).toBe(true);
    s.step(1, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    const zoneUnder = (): number => zoneOf[Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)]!;
    expect(zoneUnder()).toBe(0);
    expect(c.moving[id]).toBe(1);

    world.out.events.length = 0;
    closeOn(world, id, px, py, 5);
    for (let i = 0; i < world.out.events.length; i += 6) expect(world.out.events[i + 4]).not.toBe(RejectReason.NoSeaWay);
    expect(c.moving[id]).toBe(1);
    s.step(6, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    expect(zoneUnder()).toBe(zoneOf[pacific]);
  });
});
