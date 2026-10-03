import { describe, expect, it } from 'vitest';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// Review after PLAN 1.29: the worker's label cadence. Labels follow init, are not re-derived
// while control is unchanged, are re-derived after control changes (at most every 2 s of wall
// time) and after a load.

describe('worker nation labels', () => {
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
});
