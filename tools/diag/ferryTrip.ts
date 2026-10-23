/**
 * PLAN 7.90a: a nation's ferry round trip, read only. From a saved state, daily for `days` days:
 *
 * - each transport group of the nation, its state that day: `P` standing at one of its ports, nobody
 *   aboard nor coming; `W` the same with one of its formations marching to that port; `B` at a port
 *   with men aboard (boarding); `L` under way with men aboard; `E` under way empty; `S` standing away
 *   from its ports; `X` engaged; `-` gone (sunk). Its ferry orders (`FERRY_PROBE`) by day and way;
 * - each land formation that went aboard: the day it was first seen marching to a port of the nation,
 *   the day aboard, the day its transports sailed, the day ashore, and the cells (start, ashore);
 * - the nation's transport groups, those in training, the economic AI's wants (`wantsTransport`,
 *   `wantsFerry`) and its gold, daily (at the month's start the buy is judged);
 * - the land formations standing on each of the given pile cells, daily;
 * - on day 0, the nation's ports on the landmass of the first pile: cells from it, whether a group
 *   may stand there (water, sea zone not closed) and whether a formation of the pile may march there.
 *
 * Usage: npx tsx tools/diag/ferryTrip.ts <out.json> <days> <seed> <state.bin> <TAG> <pile cell> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { wantsFerry, wantsTransport } from '../../src/sim/ai/economic';
import { FERRY_PROBE } from '../../src/sim/ai/invasion';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import type { MobilityId } from '../../src/sim/nav/grid';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { marchingToPort, transportRoom } from '../../src/sim/systems/amphibious';
import { marchHoursLeft, passageOf, snapTarget } from '../../src/sim/systems/movement';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [out, daysS, seedS, bin, tagS, ...pileS] = process.argv.slice(2);
const days = Number(daysS);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const n = TAGS_1938.indexOf(tagS!) + 1;
const W = w.cells.w;
const c = w.formations.cols;
const piles = pileS.map(Number);
const water = portSeaOf(w);
const z = seaOf(w);
const comp = navOf(w).grid.component;
const transport = BUILD_MIX_1938.fleets!.transport;
const division = ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry] ?? 0;
const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
const r = w.atSize(AT_PORT_CELLS);
const near = (a: number, b: number): boolean => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
};
const steps = (a: number, b: number): number => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx + Math.abs(Math.floor(a / W) - Math.floor(b / W));
};
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const ownPorts = (): number[] => w.ports.map((p, i) => (water[i]! >= 0 && w.cells.controller[p.cell] === n ? i : -1)).filter((i) => i >= 0);
/** The nation's port whose water a fleet stands by, or -1. */
const portAt = (id: number): number => {
  const at = cellOf(id);
  return ownPorts().find((i) => near(at, water[i]!)) ?? -1;
};

// Day 0: the ports on the first pile's landmass.
const pass = passageOf(w, n);
const nav = navOf(w);
const pileIds = (cell: number): number[] => {
  const ids: number[] = [];
  w.formations.forEach((id) => {
    if (c.nation[id] === n && !w.isFleet(id) && !w.isWing(id) && !w.embarked.has(id) && cellOf(id) === cell) ids.push(id);
  });
  return ids;
};
const portsNear = piles.length === 0 ? [] : (() => {
  const p0 = piles[0]!;
  const one = pileIds(p0)[0];
  return ownPorts()
    .filter((i) => comp[w.ports[i]!.cell] === comp[p0])
    .map((i) => {
      const cell = w.ports[i]!.cell;
      const zone = z.zoneOf[water[i]!]!;
      let marches = false;
      if (one !== undefined) {
        const goal = snapTarget(w, cellOf(one), cell % W, Math.floor(cell / W));
        const rule = w.rules!.templates[c.template[one]!]!;
        marches = goal >= 0 && findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, cellOf(one), goal, pass) !== null;
      }
      return { port: w.ports[i]!.name, cell, steps: steps(p0, cell), zone, closed: z.closed[zone] === 1, marches };
    })
    .sort((a, b) => a.steps - b.steps);
})();

const groups = new Map<number, string[]>();
const orders: { day: number; fleet: number; way: string }[] = [];
const turns: { day: number; free: number; groups: number; tries: string[]; refusedSails: { fleet: number; port: string; nearest: string[] }[] }[] = [];
/** The nation's ports other than `skip` on landmass `l`. */
const portsOn = (l: number, skip: number): number => ownPorts().filter((i) => i !== skip && comp[w.ports[i]!.cell] === l).length;
FERRY_PROBE.turn = (t): void => {
  if (t.nation !== n) return;
  const day = w.tick / 24;
  // A sail refused: the free army's SAIL_TRIES formations nearest its port, as `sailToArmy` takes them (landmass, the nation's other ports there).
  const refusedSails = t.tries
    .filter((x) => x.way === 'sail' && !x.acted)
    .map((x) => {
      const from = w.ports[x.port]!.cell;
      const by = t.island.map((id) => [steps(cellOf(id), from), id] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return { fleet: x.fleet, port: w.ports[x.port]!.name, nearest: by.slice(0, 4).map(([d, id]) => `${id} ${d} cells landmass ${comp[cellOf(id)]} ports ${portsOn(comp[cellOf(id)]!, x.port)}`) };
    });
  turns.push({ day, free: t.free, groups: t.groups, tries: t.tries.map((x) => `${x.fleet}@${w.ports[x.port]?.name ?? x.port}:${x.way}${x.acted ? '+' : '-'}`), refusedSails });
  for (const x of t.tries) if (x.acted) orders.push({ day, fleet: x.fleet, way: x.way });
};
interface Trip { id: number; from: number; march?: number; aboard?: number; sailed?: number; ashore?: number; at?: number; fleet?: number }
const trips = new Map<number, Trip>();
const done: Trip[] = [];
const daily: { day: number; atPortNoGroup: number; groups: number; training: number; room: number; wantsTransport: boolean; wantsFerry: boolean; gold: number; aboard: number; piles: number[] }[] = [];
const fleetsOf = (): number[] => {
  const ids: number[] = [];
  w.formations.forEach((id) => {
    if (w.isFleet(id) && c.nation[id] === n) ids.push(id);
  });
  return ids;
};
let prev = new Map<number, number>();
const where = new Map<number, string[]>();
for (let d = 0; d <= days; d++) {
  if (d > 0) s.step(24, quiet);
  const cellNow = new Map<number, number>();
  const day = w.tick / 24;
  const ports = ownPorts().map((i) => w.ports[i]!.cell);
  const fleets = fleetsOf();
  const tgs = fleets.filter((id) => c.template[id] === transport);
  // Land formations: marches to a port, boardings, landings.
  const aboardOn = new Map<number, number>();
  for (const [id, e] of w.embarked) if (c.nation[id] === n) aboardOn.set(e.fleet, (aboardOn.get(e.fleet) ?? 0) + 1);
  const marching = new Set<number>();
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id)) return;
    const t = trips.get(id);
    const e = w.embarked.get(id);
    cellNow.set(id, cellOf(id));
    const from = prev.get(id) ?? cellOf(id);
    if (e) {
      const tr = t ?? { id, from };
      if (tr.aboard === undefined) [tr.aboard, tr.fleet] = [day, e.fleet];
      if (tr.sailed === undefined && c.moving[e.fleet] === 1) tr.sailed = day;
      trips.set(id, tr);
    } else if (t?.aboard !== undefined) {
      [t.ashore, t.at] = [day, cellOf(id)];
      done.push(t);
      trips.delete(id);
    } else if (marchingToPort(w, id, ports)) {
      marching.add(c.targetCell[id]!);
      if (!t) trips.set(id, { id, from, march: day });
    } else if (t && t.aboard === undefined) trips.delete(id); // turned back
  });
  for (const id of tgs) {
    if (!groups.has(id)) groups.set(id, new Array<string>(d).fill('·'));
    const men = aboardOn.get(id) ?? 0;
    const port = portAt(id);
    const st = c.engaged[id] === 1 ? 'X' : c.moving[id] === 1 ? (men > 0 ? 'L' : 'E') : port < 0 ? 'S' : men > 0 ? 'B' : [...marching].some((k) => near(k, w.ports[port]!.cell)) ? 'W' : 'P';
    groups.get(id)!.push(st);
  }
  for (const [id, row] of groups) if (!tgs.includes(id)) row.push('-');
  for (const id of tgs) {
    const p = portAt(id);
    const name = p < 0 ? `(${cellOf(id) % W},${Math.floor(cellOf(id) / W)})` : w.ports[p]!.name;
    const row = where.get(id) ?? where.set(id, []).get(id)!;
    if (row.at(-1)?.split(' ')[1] !== name) row.push(`${day} ${name}`);
  }
  prev = cellNow;
  // Land formations standing by a port of the nation where no transport group of its stands.
  const groupPorts = new Set(tgs.filter((id) => c.moving[id] !== 1).map(portAt).filter((i) => i >= 0));
  let atPortNoGroup = 0;
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || c.moving[id] === 1) return;
    const k = cellOf(id);
    const i = ownPorts().find((p) => near(k, w.ports[p]!.cell) || near(k, water[p]!));
    if (i !== undefined && !groupPorts.has(i)) atPortNoGroup++;
  });
  let training = 0;
  w.production.forEach((q) => {
    if (w.production.cols.nation[q] === n && w.production.cols.template[q] === transport) training++;
  });
  let room = 0;
  for (const id of tgs) room += transportRoom(w, id);
  daily.push({
    day,
    atPortNoGroup,
    groups: tgs.length,
    training,
    room,
    wantsTransport: wantsTransport(w, n, transport, fleets, division),
    wantsFerry: wantsFerry(w, n, fleets),
    gold: Math.round(w.nations.cols.gold[n]!),
    aboard: [...aboardOn.values()].reduce((a, b) => a + b, 0),
    piles: piles.map((p) => pileIds(p).length),
  });
}
delete FERRY_PROBE.turn;

const count = (row: string[], ch: string): number => row.filter((x) => x === ch).length;
const groupRows = [...groups].map(([id, row]) => ({ fleet: id, line: row.join(''), P: count(row, 'P'), W: count(row, 'W'), B: count(row, 'B'), L: count(row, 'L'), E: count(row, 'E'), S: count(row, 'S'), X: count(row, 'X'), orders: orders.filter((o) => o.fleet === id).map((o) => `${o.day}:${o.way}`), where: where.get(id) ?? [] }));
const mean = (xs: number[]): number => (xs.length === 0 ? NaN : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);
const landed = done.map((t) => ({ ...t, marchDays: t.march === undefined ? null : t.aboard! - t.march, waitDays: t.sailed === undefined ? null : t.sailed - t.aboard!, seaDays: t.ashore! - (t.sailed ?? t.aboard!), fromPile: piles.indexOf(t.from), gap: steps(t.from, t.at!) }));
const marchingLeft = [...trips.values()].filter((t) => t.aboard === undefined).map((t) => ({ id: t.id, from: t.from, march: t.march, target: c.targetCell[t.id], moving: c.moving[t.id], hoursLeft: c.moving[t.id] === 1 ? Math.round(marchHoursLeft(w, t.id)) : 0, port: ownPorts().map((i) => w.ports[i]!).find((p) => near(c.targetCell[t.id]!, p.cell))?.name }));
/** Per group, after its first laden run: the days it stood (P, W, S) before it next moved, and whether it was still standing at the end. */
const after = [...groups].map(([id, row]) => {
  const l = row.indexOf('L');
  if (l < 0) return { fleet: id, ladenAt: -1, stood: 0, standingAtEnd: false };
  let e = l;
  while (row[e] === 'L') e++;
  let k = e;
  while (k < row.length && 'PWS'.includes(row[k]!)) k++;
  return { fleet: id, ladenAt: l, ladenDays: e - l, stood: k - e, standingAtEnd: k === row.length };
});
const summary = {
  division,
  landed: landed.length,
  landedFromPiles: piles.map((_, i) => landed.filter((t) => t.fromPile === i).length),
  stillAboard: [...trips.values()].filter((t) => t.aboard !== undefined).length,
  stillMarching: [...trips.values()].filter((t) => t.aboard === undefined).length,
  meanMarchDays: mean(landed.flatMap((t) => (t.marchDays === null ? [] : [t.marchDays]))),
  meanWaitDays: mean(landed.flatMap((t) => (t.waitDays === null ? [] : [t.waitDays]))),
  meanSeaDays: mean(landed.map((t) => t.seaDays)),
  groupDays: Object.fromEntries(['P', 'W', 'B', 'L', 'E', 'S', 'X'].map((k) => [k, groupRows.reduce((a, g) => a + (g as unknown as Record<string, number>)[k]!, 0)])),
  ferryTurns: turns.length,
  atPortNoGroupMean: mean(daily.map((d) => d.atPortNoGroup)),
  atPortNoGroupMax: Math.max(...daily.map((d) => d.atPortNoGroup)),
  orders: orders.length,
};
writeFileSync(out!, JSON.stringify({ seed: Number(seedS), bin, tag: tagS, piles, portsNear, summary, turns, groups: groupRows, after, landed, marchingLeft, daily }, null, 1));
console.log(JSON.stringify(summary));
console.log('ports by the first pile:', portsNear.slice(0, 8).map((p) => `${p.port}@${p.cell} ${p.steps} cells${p.closed ? ' closed' : ''}${p.marches ? '' : ' NO-MARCH'}`).join('; '));
for (const g of groupRows) console.log(`${g.fleet}\t${g.line}\t${g.orders.join(' ')}\n\t${g.where.filter((x, i) => i === 0 || !x.includes('(')).join(' | ')}`);
for (const t of turns) console.log(`turn ${t.day} free ${t.free} groups ${t.groups}: ${t.tries.join(' ')}${t.refusedSails.map((r) => `
    sail refused ${r.fleet}@${r.port}: ${r.nearest.join('; ')}`).join('')}`);
for (const a of after) if (a.ladenAt >= 0) console.log(`after the voyage ${a.fleet}: laden from day ${daily[0]!.day + a.ladenAt} for ${a.ladenDays}, then stood ${a.stood} days${a.standingAtEnd ? ' (to the end)' : ''}`);
for (const m of marchingLeft.slice(0, 12)) console.log(`still marching ${m.id} from ${m.from} since ${m.march} to ${m.port ?? '?'} moving ${m.moving} hours left ${m.hoursLeft}`);
for (const t of landed) console.log(`landed ${t.id} from ${t.from}${t.fromPile >= 0 ? ` (pile ${t.fromPile})` : ''} march ${t.march ?? '-'} aboard ${t.aboard} sailed ${t.sailed ?? '-'} ashore ${t.ashore} at ${t.at} (${t.at! % W},${Math.floor(t.at! / W)})`);
for (const d of daily.filter((x, i) => i % 10 === 0 || x.day === daily.at(-1)!.day)) console.log(`day ${d.day} at a port with no group ${d.atPortNoGroup} groups ${d.groups} training ${d.training} room ${d.room} wantsT ${d.wantsTransport} wantsF ${d.wantsFerry} gold ${d.gold} aboard ${d.aboard} piles ${d.piles.join('/')}`);
