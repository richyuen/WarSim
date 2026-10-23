/**
 * PLAN 7.97: why a nation's home army stands in a pile. From a saved state: its land formations by
 * cell (groups of 10 or more), each cell's straight cells to its nation's nearest port on the same
 * land, and whether a transport group of its stands at a port; then, for `days` days, its ferry
 * turns (`FERRY_PROBE`: free army, groups, orders) and the biggest pile each day.
 *
 * Usage: npx tsx tools/diag/pileWhy.ts <seed:state.bin> <TAG> <days>
 */
import { readFileSync } from 'node:fs';
import { FERRY_PROBE, LANDING_PROBE } from '../../src/sim/ai/invasion';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf, portSeaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seed, bin] = process.argv[2]!.split(':');
const n = TAGS_1938.indexOf(process.argv[3]!) + 1;
const days = Number(process.argv[4] ?? 30);
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const c = w.formations.cols;
const cw = w.cells.w;
const cellOf = (id: number): number => Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
const comp = navOf(w).grid.component;
const water = portSeaOf(w);

function snapshot(label: string): void {
  const by = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const k = cellOf(id);
    (by.get(k) ?? by.set(k, []).get(k)!).push(id);
  });
  const ports = w.ports.map((p, i) => ({ p, i })).filter(({ p, i }) => w.cells.controller[p.cell] === n && water[i]! >= 0);
  const groupsAt = new Map<number, number>();
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || !w.isFleet(id) || c.moving[id] === 1) return;
    const k = cellOf(id);
    for (const { i } of ports) {
      const pk = water[i]!;
      if (Math.abs((pk % cw) - (k % cw)) <= 2 && Math.abs(Math.floor(pk / cw) - Math.floor(k / cw)) <= 2) groupsAt.set(i, (groupsAt.get(i) ?? 0) + 1);
    }
  });
  console.log(`${label}: day ${w.tick / 24} wars ${w.wars.list.filter((x) => x.sides[0].includes(n) || x.sides[1].includes(n)).length} ports ${ports.length} fleets at ports ${[...groupsAt].map(([i, k]) => `${w.ports[i]!.name}:${k}`).join(' ')}`);
  for (const [k, ids] of [...by].sort((a, b) => b[1].length - a[1].length)) {
    if (ids.length < 10) break;
    let best = Infinity;
    let bp = '';
    for (const { p } of ports) {
      if (comp[p.cell] !== comp[k]) continue;
      const d = Math.abs((p.cell % cw) - (k % cw)) + Math.abs(Math.floor(p.cell / cw) - Math.floor(k / cw));
      if (d < best) [best, bp] = [d, p.name];
    }
    const st = ids.map((id) => `${c.moving[id]}${c.engaged[id]}${c.retreat[id] === 0 ? 0 : 1}${c.home[id] === 0 ? 0 : 1}`);
    const kinds: Record<string, number> = {};
    for (const x of st) kinds[x] = (kinds[x] ?? 0) + 1;
    console.log(`  (${k % cw},${Math.floor(k / cw)}) land ${comp[k]} ${ids.length} formations; nearest port ${bp} ${best} cells; state mov/eng/ret/home ${JSON.stringify(kinds)}`);
  }
}
snapshot('start');
for (const x of w.wars.list) if (x.sides[0].includes(n) || x.sides[1].includes(n)) console.log(`  war: ${x.sides[0].map((k) => TAGS_1938[k - 1]).join(',')} vs ${x.sides[1].map((k) => TAGS_1938[k - 1]).join(',')}`);
LANDING_PROBE.plan = (p): void => {
  if (p.nation === n) console.log(`  day ${w.tick / 24} ${p.kind} foes ${p.foes.map((k) => TAGS_1938[k - 1]).join(',')} target ${p.target} ${p.why}`);
};
LANDING_PROBE.turn = (m, b): void => {
  if (m === n) console.log(`  day ${w.tick / 24} turn ${b}`);
};
let turns = 0;
let orders = 0;
FERRY_PROBE.skip = (m, why): void => {
  if (m === n) console.log(`  day ${w.tick / 24} skip ${why}`);
};
FERRY_PROBE.turn = (t): void => {
  if (t.nation !== n) return;
  turns++;
  const o = t.tries.filter((x) => x.acted).length;
  orders += o;
  const lands: Record<number, number> = {};
  for (const id of t.island) lands[comp[cellOf(id)]!] = (lands[comp[cellOf(id)]!] ?? 0) + 1;
  console.log(`  free by land ${JSON.stringify(lands)}`);
  console.log(`  day ${w.tick / 24} ferry: free ${t.free} groups ${t.groups} tried ${t.tries.length} orders ${o}: ${t.tries.map((x) => `${w.ports[x.port]?.name}/${x.room}/${x.way}${x.acted ? '!' : ''}`).join(' ')}`);
};
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (let d = 1; d <= days; d++) {
  s.step(24, quiet);
  if (d % 30 === 0) snapshot(`day +${d}`);
}
console.log(`done: ferry turns ${turns}, groups that gave orders ${orders}`);
