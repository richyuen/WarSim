/**
 * PLAN 7.90g: the ferry's trips of one, read only. From a saved state, over `days` days, at the end
 * of each ferry turn of the nation (`FERRY_PROBE.turn`): each transport group that took formations
 * aboard on that turn and carries one formation, and of the turn's free army (free at its start)
 * those at the same port (within `AT_PORT_CELLS` of its land cell or its water) that the group had
 * room left for: aboard another group now, or still standing. A trip of one with such a formation
 * is a split: the port's army went over more groups than its room needed.
 * `strict`: a split whose formation left stands, or went on a group tried after it (or untried); one
 * aboard a group tried before it went there first, in the turn's order, and is no split.
 *
 * Usage: npx tsx tools/diag/ferrySplit.ts <out.json> <days> <seed> <state.bin> <TAG>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FERRY_PROBE } from '../../src/sim/ai/invasion';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { portSeaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [out, daysS, seedS, bin, tagS] = process.argv.slice(2);
const days = Number(daysS);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const n = TAGS_1938.indexOf(tagS!) + 1;
const W = w.cells.w;
const c = w.formations.cols;
const water = portSeaOf(w);
const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
const r = w.atSize(AT_PORT_CELLS);
const near = (a: number, b: number): boolean => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
};
const atPort = (cell: number, i: number): boolean => near(cell, w.ports[i]!.cell) || near(cell, water[i]!);
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};

interface Trip { day: number; fleet: number; port: string; count: number; men: number; room: number; left: { id: number; men: number; on: number; when: 'standing' | 'later' | 'earlier' | 'untried' }[] }
const trips: Trip[] = [];
let turns = 0;
FERRY_PROBE.turn = (t): void => {
  if (t.nation !== n) return;
  turns++;
  const day = w.tick / 24;
  const on = new Map<number, number[]>();
  for (const [id, e] of w.embarked) {
    if (c.nation[id] !== n) continue;
    const ids = on.get(e.fleet) ?? [];
    ids.push(id);
    on.set(e.fleet, ids);
  }
  const fresh = new Set(t.island.filter((id) => w.embarked.has(id)));
  for (const [fleet, ids] of on) {
    if (!ids.some((id) => fresh.has(id))) continue;
    const port = w.ports.findIndex((_, i) => water[i]! >= 0 && atPort(cellOf(fleet), i));
    const me = t.tries.findIndex((x) => x.fleet === fleet);
    let men = 0;
    for (const id of ids) men += c.strength[id]!;
    const room = transportRoom(w, fleet);
    const left = port < 0 ? [] : t.island.filter((id) => !ids.includes(id) && w.formations.has(id) && atPort(cellOf(id), port) && c.strength[id]! <= room - men).map((id) => {
          const on = w.embarked.get(id)?.fleet ?? 0;
          const at = t.tries.findIndex((x) => x.fleet === on);
          const when = on === 0 ? 'standing' : at < 0 ? 'untried' : at > me ? 'later' : 'earlier';
          return { id, men: c.strength[id]!, on, when } as const;
        });
    trips.push({ day, fleet, port: port < 0 ? '?' : w.ports[port]!.name, count: ids.length, men, room, left: ids.length === 1 ? left : [] });
  }
};
for (let d = 1; d <= days; d++) s.step(24, quiet);
delete FERRY_PROBE.turn;
const split = trips.filter((x) => x.left.length > 0);
// Strict (the AT's after the rule): left standing, or aboard a group tried after it or never tried; a
// formation aboard a group tried before it filled that group first, in the turn's order.
const strict = split.filter((x) => x.left.some((l) => l.when !== 'earlier'));
const summary = { turns, trips: trips.length, tripsOfOne: trips.filter((x) => x.count === 1).length, splits: split.length, strict: strict.length, strictDays: strict.map((x) => `${x.day}:${x.fleet}@${x.port}`), splitDays: split.map((x) => `${x.day}:${x.fleet}@${x.port}`) };
writeFileSync(out!, JSON.stringify({ seed: Number(seedS), bin, tag: tagS, summary, trips }, null, 1));
console.log(JSON.stringify(summary));
for (const x of trips) console.log(`day ${x.day} group ${x.fleet}@${x.port} aboard ${x.count} men ${x.men}/${x.room}${x.left.length > 0 ? ` LEFT ${x.left.map((l) => `${l.id} (${l.men}) ${l.on > 0 ? `on ${l.on} ${l.when}` : 'standing'}`).join(', ')}` : ''}`);
