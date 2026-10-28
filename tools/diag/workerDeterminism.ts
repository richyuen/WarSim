/**
 * PLAN 7.152b's read: does the worker's host change the sim's course? A 1938 world stepped by
 * `Sim` alone against the same world inside the worker's `SimServer` (as the page runs it), with
 * the page's queries put between its steps: the snapshot of a viewport at each tier, the labels
 * and stats a paused pump flushes, `inspect`, every formation's panel, every nation's economy,
 * every war's battle, the charts and the history. The state hash is compared at each chunk's end.
 *
 * Arms (`ARMS`, comma-separated; default all):
 *  - `plain`: `Sim.step` alone, the hash at each chunk;
 *  - `quiet`: the server, `step` messages only;
 *  - `start`: every query at tick 0, then the year in one `step` (critic run 17's probe);
 *  - `every`: every query after each chunk.
 *
 * Usage: npx tsx tools/diag/workerDeterminism.ts <seed> [hours = 8760] [chunk = 24] [out = .cache/workerDeterminism_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { FromWorker, Subscription, ToWorker } from '../../src/shared/protocol';
import { SimServer } from '../../src/worker/server';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2] ?? 1307);
const hours = Number(process.argv[3] ?? 8760);
const chunk = Number(process.argv[4] ?? 24);
const outPath = process.argv[5] ?? `.cache/workerDeterminism_${seed}.json`;
const arms = (process.env.ARMS ?? 'plain,quiet,start,every').split(',');
const assets = loadAssets1938(size1938(undefined).w);
const hex = (h: number): string => (h >>> 0).toString(16).padStart(8, '0');

function plain(): string[] {
  const sim = new Sim({ scenario: '1938', seed, assets });
  const out: string[] = [];
  for (let t = 0; t < hours; t += chunk) {
    sim.step(Math.min(chunk, hours - t), (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    out.push(hex(sim.hash()));
  }
  return out;
}

/** A server with a page's side: snapshots acked at once, replies kept by request id. */
function host(): { server: SimServer; send: (m: ToWorker) => void; replies: Map<number, Extract<FromWorker, { type: 'reply' }>>; sim: () => Sim } {
  const replies = new Map<number, Extract<FromWorker, { type: 'reply' }>>();
  const acks: ToWorker[] = [];
  let clock = 0;
  const server: SimServer = new SimServer((msg, transfer) => {
    if (msg.type === 'reply') replies.set(msg.reqId, msg);
    if (msg.type === 'snapshot') acks.push({ type: 'ack', seq: msg.snap.seq, buffers: transfer as ArrayBuffer[] });
  });
  const send = (m: ToWorker): void => {
    clock += 37;
    server.handle(m, clock);
    while (acks.length > 0) server.handle(acks.shift()!, clock);
  };
  send({ type: 'init', reqId: 1, init: { scenario: '1938', seed, assets } });
  const sim = (): Sim => (server as unknown as { sim: Sim }).sim;
  return { server, send, replies, sim };
}

let req = 100;
let round = 0;
const PANELS = Number(process.env.PANELS ?? 50);
const VIEWS: Subscription[] = [
  { bbox: [0, 0, 2048, 1024], z: 0, tier: 0, wantsElements: false },
  { bbox: [1000, 250, 1200, 350], z: 3, tier: 1, wantsElements: false },
  { bbox: [1080, 280, 1140, 320], z: 5, tier: 1.5, wantsElements: false },
  { bbox: [1090, 290, 1120, 310], z: 7, tier: 2, wantsElements: true },
  { bbox: [1100, 295, 1108, 300], z: 9, tier: 3, wantsElements: true },
];

/** Every query a page makes, as the page would between two steps. */
function queries(h: ReturnType<typeof host>): void {
  const { send, server } = h;
  const world = h.sim().world;
  for (const sub of VIEWS) {
    send({ type: 'subscribe', sub });
    server.pump(Number.MAX_SAFE_INTEGER / 2, () => 0);
  }
  send({ type: 'inspect', reqId: req++, full: true });
  send({ type: 'inspect', reqId: req++ });
  // Panels of up to PANELS formations, spread over the ids (every one is minutes a round).
  const ids: number[] = [];
  world.formations.forEach((id) => void ids.push(id));
  const stride = Math.max(1, Math.floor(ids.length / PANELS));
  for (let i = (round++ * 7) % stride; i < ids.length; i += stride) send({ type: 'formation', reqId: req++, id: ids[i]! });
  world.nations.forEach((n) => send({ type: 'economy', reqId: req++, nation: n }));
  for (const war of world.wars.list) send({ type: 'warBattle', reqId: req++, war: war.id });
  send({ type: 'stats', reqId: req++ });
  send({ type: 'history', reqId: req++ });
  send({ type: 'hash', reqId: req++ });
}

function served(mode: 'quiet' | 'start' | 'every'): string[] {
  const h = host();
  const out: string[] = [];
  if (mode === 'start') {
    queries(h);
    // The year in one message, as the probe sends it: one hash, at its end.
    const id = req++;
    h.send({ type: 'step', reqId: id, n: hours });
    out.push(hex(h.replies.get(id)!.status.hash));
    return out;
  }
  for (let t = 0; t < hours; t += chunk) {
    const id = req++;
    h.send({ type: 'step', reqId: id, n: Math.min(chunk, hours - t) });
    out.push(hex(h.replies.get(id)!.status.hash));
    if (mode === 'every') queries(h);
  }
  return out;
}

const res: Record<string, string[]> = {};
for (const arm of arms) {
  const t0 = Date.now();
  res[arm] = arm === 'plain' ? plain() : served(arm as 'quiet' | 'start' | 'every');
  process.stderr.write(`${arm}: ${res[arm]!.at(-1)} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
}
const base = res['plain'] ?? res['quiet']!;
for (const arm of arms) {
  const r = res[arm]!;
  if (arm === 'start') {
    process.stdout.write(`${arm}: end ${r[0]} ${r[0] === base.at(-1) ? 'same' : 'DIFFERENT'}\n`);
    continue;
  }
  const first = r.findIndex((x, i) => x !== base[i]);
  process.stdout.write(`${arm}: end ${r.at(-1)} ${first < 0 ? 'same' : `DIFFERENT from chunk ${first} (hour ${(first + 1) * chunk})`}\n`);
}
writeFileSync(outPath, JSON.stringify({ seed, hours, chunk, hashes: res }, null, 1));
