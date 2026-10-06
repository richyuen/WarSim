import { describe, expect, it } from 'vitest';
import type { FormationDetail, FromWorker } from '../../src/shared/protocol';
import { SimServer } from '../../src/worker/server';

// PLAN 2.14b: the worker's answer to `formation`, what the formation panel shows. (The 1938
// world's answer, with its elements by unit type, is read off the page in
// tests/e2e/formationPanel1938.spec.ts.)

function ask(server: SimServer, replies: FromWorker[], id: number, generation?: number): FormationDetail | null {
  const reqId = 100 + replies.length;
  server.handle(generation === undefined ? { type: 'formation', reqId, id } : { type: 'formation', reqId, id, generation }, 0);
  const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
  if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
  return JSON.parse(new TextDecoder().decode(r.bytes)) as FormationDetail | null;
}

describe('the worker\'s answer to `formation` (PLAN 2.14b)', () => {
  it('is the formation as the sim has it, and null for one that is not there', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 3 } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 30 }, 0);
    const w = server.sim!.world;
    const id = w.formations.ids()[0]!;
    const hash = server.sim!.hash();
    const d = ask(server, replies, id)!;
    expect(d).toMatchObject({ id, tick: 30, nation: w.formations.cols.nation[id], strength: w.formations.cols.strength[id], supply: w.formations.cols.supply[id], x: w.formations.cols.x[id], y: w.formations.cols.y[id] });
    expect(d.engaged).toBe(w.formations.cols.engaged[id] === 1);
    expect(d.moving).toBe(w.formations.cols.moving[id] === 1);
    // A toy formation has no template and no elements.
    expect(d.full).toBe(0);
    expect(d.units).toEqual([]);
    for (const none of [0, -1, 1.5, 999_999, Number.NaN]) expect(ask(server, replies, none), String(none)).toBeNull();
    // Asking changes nothing.
    expect(server.sim!.hash()).toBe(hash);
    expect(replies.filter((r) => r.type === 'error')).toEqual([]);
  });

  // PLAN 2.16Ri: a table gives a freed id to the next row made, so the id alone does not say
  // which formation is meant. The panel asks with the count its formation had (`generation`).
  it('is null for a formation that is gone, though another has taken its id', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 3 } }, 0);
    const w = server.sim!.world;
    const id = w.formations.ids()[0]!;
    const first = ask(server, replies, id)!;
    expect(first.generation).toBe(w.formations.generation[id]);
    // Asked with its own count, it is itself.
    expect(ask(server, replies, id, first.generation)).toEqual(first);

    // The formation is removed, and another nation raises one in the same tick: it has the id.
    const other = w.nations.ids().find((n) => n !== first.nation)!;
    server.handle({ type: 'cmd', cmd: { kind: 'removeFormation', id } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: other, x: first.x, y: first.y, strength: 500 } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 1 }, 0);
    expect(w.formations.has(id), 'the freed id is given out again').toBe(true);
    expect(w.formations.cols.nation[id]).toBe(other);

    expect(ask(server, replies, id, first.generation), 'asked as the formation that is gone').toBeNull();
    // Asked by the id alone (a click on the new one), it is the new one, with another count.
    const second = ask(server, replies, id)!;
    expect(second.nation).toBe(other);
    expect(second.generation).not.toBe(first.generation);
    expect(ask(server, replies, id, second.generation)).toEqual(second);
    expect(replies.filter((r) => r.type === 'error')).toEqual([]);
  });
});
