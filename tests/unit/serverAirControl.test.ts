import { describe, expect, it } from 'vitest';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { airHolders } from '../../src/sim/systems/airSuperiority';
import { declareWar } from '../../src/sim/systems/war';
import { airOf } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8d (a test the phase had not): the worker's air control for its map mode (PLAN 5.7c):
// nothing while no one has flown; the holders with the cells' air zones the first time; the
// holders alone when they change; nothing again while they do not. Since PLAN 7.8 (ADR-467) a
// zone's holder is one fighting there: the nations that fly in zone 3 here, Germany (1) and the
// United Kingdom (20), are at war, and each flies a little where the other holds the air.

type Air = { type: 'airControl'; holder: Uint16Array; zones?: Uint16Array };

describe('the worker\'s air control (PLAN 5.7c, 5.8d)', () => {
  it('sent when someone flew, with the zones once, and again only when the holders change', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const w = server.sim!.world;
    expect(declareWar(w, 1, 20, true)).not.toBeNull();
    const air = (): Air[] => got.filter((m) => m.type === 'airControl') as Air[];
    server.handle({ type: 'pause', paused: true }, 1);
    expect(air()).toHaveLength(0);
    // Germany flies over zone 3.
    w.airPower.set(3, new Map([[20, 900], [1, 10]]));
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
    w.airPower.set(3, new Map([[1, 900], [20, 10]]));
    server.handle({ type: 'pause', paused: true }, 4);
    const last = air().at(-1)!;
    expect(air()).toHaveLength(2);
    expect(last.zones).toBeUndefined();
    expect(last.holder[3]).toBe(1);
  });

  // PLAN 5.8n: a load sends the loaded game's holders at once, and a day's first sending is not
  // lost to a pump that steps past its first hour.
  it('a load sends the loaded game\'s holders at once, whatever its hour', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const w = server.sim!.world;
    expect(declareWar(w, 1, 20, true)).not.toBeNull();
    const air = (): Air[] => got.filter((m) => m.type === 'airControl') as Air[];
    w.tick = 5;
    const bytes = server.sim!.save();
    w.airPower.set(3, new Map([[20, 900], [1, 10]]));
    server.handle({ type: 'pause', paused: true }, 1);
    expect(air()).toHaveLength(1);
    expect(air()[0]!.holder[3]).toBe(20);
    // The save, at hour 5 with nobody flown: the page is told all none, with the zones, now.
    server.handle({ type: 'load', reqId: 2, bytes }, 2);
    server.handle({ type: 'pause', paused: true }, 3);
    expect(air()).toHaveLength(2);
    expect(air()[1]!.holder.every((h) => h === 0)).toBe(true);
    expect(air()[1]!.zones).toBeDefined();
  });

  it('a day\'s holders are sent at the first look of the day, if not its first hour; once a day', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const w = server.sim!.world;
    expect(declareWar(w, 1, 20, true)).not.toBeNull();
    const air = (): Air[] => got.filter((m) => m.type === 'airControl') as Air[];
    w.airPower.set(3, new Map([[20, 900], [1, 10]]));
    server.handle({ type: 'pause', paused: true }, 1);
    expect(air()).toHaveLength(1);
    // The holders change at hour 23; the pump steps to 25, past the next day's first hour.
    w.tick = 23;
    w.airPower.set(3, new Map([[1, 900], [20, 10]]));
    server.handle({ type: 'pause', paused: true }, 2);
    expect(air()).toHaveLength(1);
    w.tick = 25;
    server.handle({ type: 'pause', paused: true }, 3);
    expect(air()).toHaveLength(2);
    expect(air()[1]!.holder[3]).toBe(1);
    // Again the same day: not sent before the next.
    w.airPower.set(3, new Map([[20, 900], [1, 10]]));
    w.tick = 30;
    server.handle({ type: 'pause', paused: true }, 4);
    expect(air()).toHaveLength(2);
    w.tick = 48;
    server.handle({ type: 'pause', paused: true }, 5);
    expect(air()).toHaveLength(3);
  });
});
