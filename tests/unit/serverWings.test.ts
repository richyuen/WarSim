import { describe, expect, it } from 'vitest';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { wingAircraft } from '../../src/sim/systems/air';
import { airfield } from '../../src/sim/systems/production';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8v1: the worker's stats carry the wings of the nation the player controls: none
// without a player, and each of its with its template, base, mission and whether it flies.

type Stats = Extract<FromWorker, { type: 'nationStats' }>;

describe('the player\'s wings in the stats (PLAN 5.8v1)', () => {
  it('none without a player; Germany\'s with their missions as the sim has them', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const last = (): Stats => got.filter((m): m is Stats => m.type === 'nationStats').at(-1)!;
    server.handle({ type: 'step', reqId: 2, n: 1 }, 1);
    expect(last().wings).toEqual([]);
    const GER = TAGS_1938.indexOf('GER') + 1;
    const w = server.sim!.world;
    const own = [...w.wingBase].filter(([id]) => w.formations.cols.nation[id] === GER).map(([id]) => id).sort((a, b) => a - b);
    server.handle({ type: 'cmd', cmd: { kind: 'setPlayer', nation: GER } }, 2);
    const first = own[0]!;
    w.wingMission.set(first, { kind: 'patrol', x: 1, y: 1 });
    server.handle({ type: 'step', reqId: 3, n: 1 }, 1000);
    const wings = last().wings;
    expect(wings.map((x) => x.id)).toEqual(own.filter((id) => w.formations.has(id)));
    const one = wings.find((x) => x.id === first)!;
    expect(one).toMatchObject({ template: w.formations.cols.template[first], carrier: false, transport: false });
    expect(one.mission === 'patrol' || one.flying).toBe(true);
    expect(wings.filter((x) => x.transport).length).toBe(2);
  });

  // PLAN 5.8v4: the room for aircraft at a nation's airbases, and a wing's aircraft, for the build list.
  it('a nation\'s most room at an airbase it holds (a template\'s aircraft: airOrders1938.spec)', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 1 }, 1);
    const w = server.sim!.world;
    const fighter = TEMPLATES_1938.findIndex((t) => t.id === 'fighter_group');
    const GER = TAGS_1938.indexOf('GER') + 1;
    const stats = got.filter((m): m is Stats => m.type === 'nationStats').at(-1)!;
    const ger = stats.nations.find((n) => n.id === GER)!;
    expect(ger.airRoom).toBeGreaterThanOrEqual(wingAircraft(w, fighter));
    expect(ger.airRoom).toBeGreaterThan(0);
    // As `airfield` has it: a fighter group fits where the room is.
    expect(airfield(w, GER, fighter)).toBeGreaterThanOrEqual(0);
  });
});
