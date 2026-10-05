import { describe, expect, it } from 'vitest';
import { COMMAND_KINDS, isCommand, type Command } from '../../src/shared/commands';
import type { FromWorker } from '../../src/shared/protocol';
import { Sim } from '../../src/sim/sim';
import { SimServer } from '../../src/worker/server';

// PLAN 2.12b (the critic's N20): a command of a kind the sim does not know was queued, given a
// sequence number, applied as nothing and written into the command log. All three are state:
// seven made-up kinds changed the worker's hash. Such a command is refused at the door.

/** What only a caller without the types can send: the test API of a page, a message made by hand. */
const MADE_UP: unknown[] = [
  { kind: 'nonsense' },
  { kind: 'spawnformation', nation: 1, x: 50, y: 50, strength: 900 }, // the case is part of the kind
  { kind: 'toString' }, // a name every object has
  { kind: '__proto__' },
  { kind: 7 },
  { nation: 1 },
  null,
  'declareWar',
  [],
];

describe('a command of a kind the sim does not know', () => {
  it('is not queued, counted or logged, and the game is that of a sim that never got it', () => {
    const sim = new Sim({ scenario: 'toy', seed: 7 });
    const twin = new Sim({ scenario: 'toy', seed: 7 });
    sim.step(50);
    twin.step(50);
    for (const cmd of MADE_UP) {
      expect(sim.command(cmd as Command), JSON.stringify(cmd)).toBe(false);
      expect(sim.world.pending, JSON.stringify(cmd)).toEqual([]);
      expect(sim.world.nextCommandSeq, JSON.stringify(cmd)).toBe(0);
      expect(sim.hash(), `${JSON.stringify(cmd)}: the hash before a step`).toBe(twin.hash());
    }
    // A known one between them has the sequence number it would have had alone.
    const spawn: Command = { kind: 'spawnFormation', nation: 1, x: 50, y: 50, strength: 900 };
    expect(sim.command(spawn)).toBe(true);
    twin.command(spawn);
    sim.command({ kind: 'nonsense' } as unknown as Command);
    sim.step(50);
    twin.step(50);
    expect(sim.world.commandLog).toEqual(twin.world.commandLog);
    expect(sim.world.commandLog.map((c) => c.seq)).toEqual([0]);
    expect(sim.world.nextCommandSeq).toBe(1);
    expect(sim.hash()).toBe(twin.hash());
    expect(sim.save()).toEqual(twin.save());
  });

  it('is refused by the worker too, applied at once or not, and the worker goes on', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 3 } }, 0);
    const plain = new Sim({ scenario: 'toy', seed: 3 });
    for (const cmd of MADE_UP) {
      server.handle({ type: 'cmd', cmd: cmd as Command }, 0);
      server.handle({ type: 'cmd', cmd: cmd as Command, now: true }, 0);
    }
    server.handle({ type: 'step', reqId: 2, n: 30 }, 0);
    plain.step(30);
    const sim = server.sim!;
    expect(sim.world.commandLog).toEqual([]);
    expect(sim.world.nextCommandSeq).toBe(0);
    expect(sim.hash()).toBe(plain.hash());
    expect(replies.filter((r) => r.type === 'error')).toEqual([]);
  });

  it('every kind of the Command type is known, and nothing else is', () => {
    // The list is held to the type by the compiler (`Record<Command['kind'], true>`): a kind
    // added to the type without a line there, or a line without a kind, does not compile.
    const kinds = Object.keys(COMMAND_KINDS);
    expect(kinds.length).toBeGreaterThan(40);
    for (const kind of kinds) expect(isCommand({ kind }), kind).toBe(true);
    for (const cmd of MADE_UP) expect(isCommand(cmd), JSON.stringify(cmd)).toBe(false);
  });
});
