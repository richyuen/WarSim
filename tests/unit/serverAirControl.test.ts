import { describe, expect, it } from 'vitest';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { airHolders } from '../../src/sim/systems/airSuperiority';
import { airOf } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8d (a test the phase had not): the worker's air control for its map mode (PLAN 5.7c):
// nothing while no one has flown; the holders with the cells' air zones the first time; the
// holders alone when they change; nothing again while they do not.

type Air = { type: 'airControl'; holder: Uint16Array; zones?: Uint16Array };

describe('the worker\'s air control (PLAN 5.7c, 5.8d)', () => {
  it('sent when someone flew, with the zones once, and again only when the holders change', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const w = server.sim!.world;
    const air = (): Air[] => got.filter((m) => m.type === 'airControl') as Air[];
    server.handle({ type: 'pause', paused: true }, 1);
    expect(air()).toHaveLength(0);
    // Germany flies over zone 3.
    w.airPower.set(3, new Map([[20, 900]]));
    server.handle({ type: 'pause', paused: true }, 2);
    expect(air()).toHaveLength(1);
    const first = air()[0]!;
    const zones = airOf(w);
    expect(Array.from(first.zones!)).toEqual(Array.from(zones.zoneOf));
    expect(Array.from(first.holder)).toEqual(Array.from(airHolders(w, zones.count)));
    expect(first.holder[3]).toBe(20);
    // Nothing changed: nothing sent.
    server.handle({ type: 'pause', paused: true }, 3);
    expect(air()).toHaveLength(1);
    // Another nation holds it: the holders alone, at a day's first hour.
    w.airPower.set(3, new Map([[1, 900]]));
    server.handle({ type: 'pause', paused: true }, 4);
    const last = air().at(-1)!;
    expect(air()).toHaveLength(2);
    expect(last.zones).toBeUndefined();
    expect(last.holder[3]).toBe(1);
  });
});
