/**
 * PLAN 7.90a: why a nation's transport groups stand at the far port after the ferry. From a saved
 * state, stepped `days` days: for each transport group of the nation, where it stands and the land
 * formations of its nation nearest its port (as `sailToArmy` takes the ferry's army: cell, landmass,
 * standing, strength, the nation's other ports on that landmass and whether it may march to the
 * nearest); the strengths of the nation's land formations against a group's room; the landmasses of
 * its front cells and of its ports (as `wantsFerry` reads them); the water keys of its ports
 * (`waterKeys`: the same key, one sea). Read only, the state after the step aside.
 *
 * Usage: npx tsx tools/diag/ferryStuck.ts <seed> <state.bin> <TAG> <days> [cell ...]
 */
import { readFileSync } from 'node:fs';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { neighbours4, type MobilityId } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { passageOf, snapTarget } from '../../src/sim/systems/movement';
import { AT_PORT_CELLS, waterKeys } from '../../src/sim/systems/navalCombat';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, tagS, daysS, ...cellS] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (let d = 0; d < Number(daysS); d++) s.step(24, quiet);
const n = TAGS_1938.indexOf(tagS!) + 1;
const W = w.cells.w;
const c = w.formations.cols;
const ctl = w.cells.controller;
const water = portSeaOf(w);
const z = seaOf(w);
const nav = navOf(w);
const comp = nav.grid.component;
const pass = passageOf(w, n);
const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
const xy = (k: number): string => `(${k % W},${Math.floor(k / W)})`;
const steps = (a: number, b: number): number => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx + Math.abs(Math.floor(a / W) - Math.floor(b / W));
};
const r = w.atSize(AT_PORT_CELLS);
const marches = (id: number, cell: number): boolean => {
  const goal = snapTarget(w, cellOf(id), cell % W, Math.floor(cell / W));
  const rule = w.rules!.templates[c.template[id]!]!;
  return goal >= 0 && findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, cellOf(id), goal, pass) !== null;
};
const own: number[] = [];
w.ports.forEach((p, i) => {
  if (water[i]! >= 0 && ctl[p.cell] === n) own.push(i);
});
const keys = waterKeys(w, n);
console.log(`day ${w.tick / 24}: ${tagS} ports ${own.length}`);
// The landmasses of its front cells (beside a nation at war with it), as `wantsFerry` reads them.
const fronts = new Map<number, number>();
const nb: number[] = [];
for (const k of frontierOf(w)) {
  if (ctl[k] !== n) continue;
  for (const q of neighbours4(k, W, w.cells.h, w.settings.loopingMap, nb)) {
    const m = ctl[q]!;
    if (m !== 0 && m !== n && w.wars.atWar(n, m)) {
      fronts.set(comp[k]!, (fronts.get(comp[k]!) ?? 0) + 1);
      break;
    }
  }
}
console.log('front cells by landmass:', JSON.stringify([...fronts]));
for (const k of cellS.map(Number)) console.log(`cell ${k} ${xy(k)} landmass ${comp[k]} holder ${TAGS_1938[ctl[k]! - 1]}`);
const land: number[] = [];
w.formations.forEach((id) => {
  if (c.nation[id] === n && !w.isFleet(id) && !w.isWing(id) && !w.embarked.has(id)) land.push(id);
});
const str = land.map((id) => c.strength[id]!).sort((a, b) => a - b);
const q = (p: number): number => Math.round(str[Math.floor(p * (str.length - 1))]!);
console.log(`land formations ${land.length}: strength min ${q(0)} p25 ${q(0.25)} median ${q(0.5)} p75 ${q(0.75)} max ${q(1)}; over 12,000: ${str.filter((x) => x > 12000).length}`);
w.formations.forEach((id) => {
  if (!w.isFleet(id) || c.nation[id] !== n || transportRoom(w, id) <= 0) return;
  const at = cellOf(id);
  const pi = own.find((i) => Math.abs((water[i]! % W) - (at % W)) <= r && Math.abs(Math.floor(water[i]! / W) - Math.floor(at / W)) <= r) ?? -1;
  const pc = pi >= 0 ? w.ports[pi]!.cell : at;
  console.log(`\ngroup ${id} room ${transportRoom(w, id)} at ${pi >= 0 ? w.ports[pi]!.name : xy(at)} landmass ${comp[pc]} key ${keys[z.zoneOf[pi >= 0 ? water[pi]! : at]!]} moving ${c.moving[id]}`);
  // Standing as the ferry's `standing` takes them; on a landmass with no front cell of n's they are the ferry's for certain.
  const by = land.filter((f) => !w.offLand(f) && c.moving[f] !== 1 && c.engaged[f] !== 1 && c.retreat[f] === 0 && c.home[f] === 0).map((f) => [steps(cellOf(f), pc), f] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [d, f] of by.slice(0, 4)) {
    const k = cellOf(f);
    const ports = own.filter((i) => i !== pi && comp[w.ports[i]!.cell] === comp[k]).map((i) => [steps(w.ports[i]!.cell, k), i] as const).sort((a, b) => a[0] - b[0]).slice(0, 4);
    console.log(`  formation ${f} ${xy(k)} ${d} cells, landmass ${comp[k]}, strength ${Math.round(c.strength[f]!)}${fronts.has(comp[k]!) ? '' : ' ferry-only'}; its other ports ${ports.map(([dd, i]) => `${w.ports[i]!.name} ${dd} cells ${marches(f, w.ports[i]!.cell) ? 'march' : 'NO-MARCH'}`).join(', ') || 'none'}`);
  }
});
console.log('\nports: name landmass water-key closed');
for (const i of own) console.log(`  ${w.ports[i]!.name} ${xy(w.ports[i]!.cell)} landmass ${comp[w.ports[i]!.cell]} key ${keys[z.zoneOf[water[i]!]!]} ${z.closed[z.zoneOf[water[i]!]!] === 1 ? 'closed' : ''}`);
