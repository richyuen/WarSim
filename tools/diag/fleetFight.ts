/**
 * PLAN 7.126: the fleets in contact of two nations at war and their panels' fights. Germany
 * declares war on Poland by God Mode; at each hour's end from day `from` to the end of day `to`, every fleet of
 * either side's war (the two and those at war with them) in contact: the enemy fleet its panel's
 * fight names (`formation` of the worker), or none. Ends with the count of fleets seen in
 * contact with no fight.
 *
 * Usage: npx tsx tools/diag/fleetFight.ts [seed] [from] [to]
 */
import type { FormationDetail, FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const seed = Number(process.argv[2] ?? 5381);
const from = Number(process.argv[3] ?? 21);
const to = Number(process.argv[4] ?? 35);
const GER = nationId('GER');
const POL = nationId('POL');
const replies: FromWorker[] = [];
const server = new SimServer((msg) => {
  if (msg.type === 'reply') replies.push(msg);
});
server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed, assets: assets1938(SIZE_1938.w) } }, 0);
const w = server.sim!.world;
server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL } }, 0);
let req = 10;
const step = (hours: number): void => {
  server.handle({ type: 'step', reqId: req++, n: hours }, 0);
  w.out.events.length = 0;
  w.out.fires.length = 0;
  replies.length = 0;
};
const ask = (id: number): FormationDetail => {
  const reqId = req++;
  server.handle({ type: 'formation', reqId, id }, 0);
  const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
  if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply');
  return JSON.parse(new TextDecoder().decode(r.bytes)) as FormationDetail;
};
for (let h = 0; h < 24 * from; h += 24) step(24);
let seen = 0;
let none = 0;
const ofTwo = { seen: 0, none: 0 };
const fleets = new Set<number>();
for (let hour = 24 * from; hour < 24 * (to + 1); hour++) {
  const d = Math.floor(hour / 24);
  const fc = w.formations.cols;
  w.formations.forEach((f) => {
    if (!w.isFleet(f) || fc.engaged[f] !== 1) return;
    const n = fc.nation[f]!;
    const two = n === GER || n === POL;
    if (!two && !w.wars.atWar(n, GER) && !w.wars.atWar(n, POL)) return;
    const fight = ask(f).fight;
    seen++;
    if (two) {
      ofTwo.seen++;
      fleets.add(f);
    }
    if (!fight) {
      none++;
      if (two) ofTwo.none++;
    }
    if (hour % 24 === 23 || !fight) console.log(`day ${d} h${hour % 24}: fleet ${f} (nation ${n}) ${fight ? `fights ${fight.enemy} (nation ${fc.nation[fight.enemy]}), box ${fight.span.map((s) => s.toFixed(2)).join(' x ')} cells` : 'NO FIGHT'}`);
  });
  step(1);
}
console.log(`fleets in contact seen (fleet-hours): ${seen}, with no fight ${none}; of Germany and Poland ${ofTwo.seen}, with no fight ${ofTwo.none} (${fleets.size} fleets: ${[...fleets].join(', ')})`);
console.log('done:');
