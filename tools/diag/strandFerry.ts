/**
 * PLAN 7.79c: whether the ferry could take a stranded pile in 30 days. From a saved state, for a
 * nation and its pile's cell: its transport groups (room, standing, at a port of its own), whether
 * any of its formations is aboard (the invasion turn is skipped then), the pile's men, its own open
 * ports on the pile's landmass and the nearest of them (straight cells), and `wantsFerry`. Then
 * daily for `days` days: the days its transports stood at a port of its own and the days it had
 * someone aboard.
 *
 * Usage: npx tsx tools/diag/strandFerry.ts <seed:state.bin:TAG:cell> <days> [...]
 */
import { readFileSync } from 'node:fs';
import { wantsFerry } from '../../src/sim/ai/economic';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { portShut } from '../../src/sim/systems/bombing';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { navOf, portSeaOf, seaRangeOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const days = Number(process.argv[3]);
const [seedS, bin, tagS, cellS] = process.argv[2]!.split(':');
const seed = Number(seedS);
const n = TAGS_1938.indexOf(tagS!) + 1;
const pile = Number(cellS);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const cw = w.cells.w;
const near = (a: number, b: number, r: number): boolean => Math.abs((a % cw) - (b % cw)) <= r && Math.abs(Math.floor(a / cw) - Math.floor(b / cw)) <= r;
const transports = (): { id: number; room: number; moving: boolean; engaged: boolean; ranged: boolean; atPort: boolean; cell: number }[] => {
  const c = w.formations.cols;
  const water = portSeaOf(w);
  const out: { id: number; room: number; moving: boolean; engaged: boolean; ranged: boolean; atPort: boolean; cell: number }[] = [];
  w.formations.forEach((id) => {
    if (!w.isFleet(id) || c.nation[id] !== n) return;
    const room = transportRoom(w, id);
    if (room <= 0) return;
    const at = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
    const atPort = w.ports.some((p, k) => water[k]! >= 0 && w.cells.controller[p.cell] === n && near(at, water[k]!, w.atSize(AT_PORT_CELLS)));
    out.push({ id, room, moving: c.moving[id] === 1, engaged: c.engaged[id] === 1, ranged: seaRangeOf(w, id) !== undefined, atPort, cell: at });
  });
  return out;
};
const aboard = (): number => {
  let k = 0;
  for (const id of w.embarked.keys()) if (w.formations.cols.nation[id] === n) k++;
  return k;
};
const c = w.formations.cols;
let men = 0;
let count = 0;
const own: number[] = [];
w.formations.forEach((id) => {
  if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || c.nation[id] !== n) return;
  own.push(id);
  if (Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!) === pile) {
    men += c.strength[id]!;
    count++;
  }
});
const comp = navOf(w).grid.component;
const water = portSeaOf(w);
const ports: { name: string; cell: number; d: number; shut: boolean }[] = [];
w.ports.forEach((p, i) => {
  if (water[i]! < 0 || w.cells.controller[p.cell] !== n || comp[p.cell] !== comp[pile]) return;
  const d = Math.max(Math.abs((p.cell % cw) - (pile % cw)), Math.abs(Math.floor(p.cell / cw) - Math.floor(pile / cw)));
  ports.push({ name: p.name, cell: p.cell, d, shut: portShut(w, i) });
});
ports.sort((a, b) => a.d - b.d);
console.log(JSON.stringify({ seed, nation: tagS, pile, count, men, transports: transports(), aboard: aboard(), wantsFerry: wantsFerry(w, n, own), portsOnLand: ports.length, nearestPorts: ports.slice(0, 5) }));
let atPortDays = 0;
let aboardDays = 0;
let roomMax = 0;
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const t = transports();
  if (t.some((x) => x.atPort && !x.moving && !x.engaged && !x.ranged)) atPortDays++;
  if (aboard() > 0) aboardDays++;
  for (const x of t) roomMax = Math.max(roomMax, x.room);
}
console.log(JSON.stringify({ days, atPortDays, aboardDays, roomMax, transportsEnd: transports().length }));
console.log('done:');
