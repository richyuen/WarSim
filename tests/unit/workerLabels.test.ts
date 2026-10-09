import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// Review after PLAN 1.29: the worker's label cadence. Labels follow init, are not re-derived
// while control is unchanged, are re-derived after control changes (at most every 2 s of wall
// time) and after a load.

describe('worker derived messages (labels, nation stats)', () => {
  it('derive after init, throttle, follow control changes and loads', () => {
    const msgs: FromWorker[] = [];
    const server = new SimServer((m) => msgs.push(m));
    const labels = (): Extract<FromWorker, { type: 'labels' }>[] => msgs.filter((m): m is Extract<FromWorker, { type: 'labels' }> => m.type === 'labels');
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) } }, 0);
    expect(labels().length).toBe(1);
    const first = labels()[0]!;
    expect(first.names).toContain('nation.GER');
    expect(first.data.length / 10).toBeGreaterThan(60);

    server.handle({ type: 'hash', reqId: 2 }, 100);
    expect(labels().length).toBe(1); // nothing changed

    // A control change (God brush) inside the throttle window waits; after it, labels update.
    const GER = TAGS_1938.indexOf('GER') + 1;
    server.handle({ type: 'cmd', cmd: { kind: 'paintControl', nation: GER, x: 1150, y: 230, r: 3 } }, 200);
    server.handle({ type: 'step', reqId: 3, n: 1 }, 300);
    expect(labels().length).toBe(1);
    server.handle({ type: 'hash', reqId: 4 }, 2500);
    expect(labels().length).toBe(2);

    // A load replaces the controller layer: labels follow at once (after the interval).
    server.handle({ type: 'save', reqId: 5 }, 2600);
    const saved = msgs.findLast((m): m is Extract<FromWorker, { type: 'reply' }> => m.type === 'reply' && m.reqId === 5)!.bytes!;
    server.handle({ type: 'load', reqId: 6, bytes: saved }, 5000);
    expect(labels().length).toBe(3);
  }, 120_000);

  // PLAN 1.31b: nation stats are throttled to 1 Hz. A step inside the window while paused must
  // still reach the UI: the server asks to be pumped until it is sent, without advancing ticks.
  it('nation stats follow init, and a throttled step while paused is flushed by pumping', () => {
    const msgs: FromWorker[] = [];
    const server = new SimServer((m) => msgs.push(m));
    const stats = (): Extract<FromWorker, { type: 'nationStats' }>[] => msgs.filter((m): m is Extract<FromWorker, { type: 'nationStats' }> => m.type === 'nationStats');
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) } }, 0);
    expect(stats().length).toBe(1);
    const GER = TAGS_1938.indexOf('GER') + 1;
    const ger = stats()[0]!.nations.find((n) => n.id === GER)!;
    expect(ger.cells).toBeGreaterThan(1000);
    expect(ger.alliance?.name).toBe('alliance.anti_comintern');
    expect(stats()[0]!.wars.length).toBeGreaterThan(0);
    expect(server.running).toBe(false); // paused, nothing owed

    server.handle({ type: 'step', reqId: 2, n: 1 }, 300);
    expect(stats().length).toBe(1); // throttled
    expect(server.running).toBe(true); // wants a pump to flush
    expect(server.ticking).toBe(false);
    server.pump(600, () => 600);
    expect(stats().length).toBe(1);
    server.pump(1100, () => 1100);
    expect(stats().length).toBe(2);
    expect(stats()[1]!.tick).toBe(1); // flushed, not advanced
    expect(server.running).toBe(false);

    // PLAN 3.12c: the ticker's rows come with the stats, and a God war is in them at once, paused.
    const POL = TAGS_1938.indexOf('POL') + 1;
    expect(stats()[1]!.ticker.filter((r) => r.a === GER && r.b === POL)).toEqual([]);
    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL }, now: true }, 1200);
    server.pump(1250, () => 1250);
    const told = stats().at(-1)!.ticker.filter((r) => r.a === GER && r.b === POL);
    expect(told.map((r) => [r.kind, r.an, r.bn])).toEqual([[EventKind.WarDeclared, 'nation.GER', 'nation.POL']]);
    expect(Number.isFinite(told[0]!.x) && Number.isFinite(told[0]!.y)).toBe(true);

    // PLAN 3.12d: the messages of one world have one number, and a load is another world: the
    // view tells a loaded game's past from news by it.
    expect(new Set(stats().map((m) => m.world)).size).toBe(1);
    const world = stats().at(-1)!.world;
    server.handle({ type: 'save', reqId: 3 }, 1300);
    const saved = msgs.findLast((m): m is Extract<FromWorker, { type: 'reply' }> => m.type === 'reply' && m.reqId === 3)!.bytes!;
    const sent = stats().length;
    server.handle({ type: 'load', reqId: 4, bytes: saved }, 5000);
    expect(stats().length).toBe(sent + 1);
    expect(stats().at(-1)!.world).toBe(world + 1);
    expect(stats().at(-1)!.ticker.map((r) => r.kind)).toEqual(stats().at(-2)!.ticker.map((r) => r.kind));
  }, 120_000);
});
