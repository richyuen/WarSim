/**
 * PLAN 7.56's probe: a formation at a port, day by day from a saved state: whether the day is its
 * nation's invasion day (`STAGGER`), `tryLanding`'s answer for a target port, and its nation's
 * transport groups (cell, under way, room).
 *
 * Usage: npx tsx tools/diag/landingProbe.ts <seed:state.bin> <id> <from day> <to day> <target port name>
 */
import { readFileSync } from 'node:fs';
import { STAGGER } from '../../src/sim/ai/strategic';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom, tryLanding } from '../../src/sim/systems/amphibious';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { portSeaOf, seaOf } from '../../src/sim/world';
import { TAGS_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../headless/assets';

const [seed, src] = process.argv[2]!.split(':');
const id = Number(process.argv[3]);
const from = Number(process.argv[4]);
const to = Number(process.argv[5]);
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
s.load(new Uint8Array(readFileSync(src!)));
let c = w.formations.cols;
const cw = w.cells.w;
const port = w.ports.find((p) => p.name === process.argv[6])!;
s.step(24 * from);
for (let d = from; d <= to; d++) {
  c = w.formations.cols;
  const n = c.nation[id]!;
  const day = w.tick / 24;
  const [tx, ty] = w.cellPoint(port.cell);
  const save = s.save();
  const why = tryLanding(w, id, tx, ty);
  s.load(save);
  c = w.formations.cols; // replaced by the load
  const groups: string[] = [];
  w.formations.forEach((g) => {
    if (!w.isFleet(g) || c.nation[g] !== n || transportRoom(w, g) <= 0) return;
    const k = Math.floor(c.y[g]!) * cw + Math.floor(c.x[g]!);
    groups.push(`${g}@${k % cw},${Math.floor(k / cw)} moving ${c.moving[g]} engaged ${c.engaged[g]} room ${transportRoom(w, g)}`);
  });
  const k = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  // The enemy ports nearest the transports by sea, open to n, and tryLanding's answer for each.
  const water = portSeaOf(w);
  const z = seaOf(w);
  let fx = -1;
  let fy = -1;
  w.formations.forEach((g) => {
    if (w.isFleet(g) && c.nation[g] === n && transportRoom(w, g) > 0) [fx, fy] = [c.x[g]!, c.y[g]!];
  });
  const cand: [number, string][] = [];
  w.ports.forEach((p, i) => {
    const holder = w.cells.controller[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !w.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1) return;
    const sea = seaHolder(w, zone);
    if (sea !== 0 && w.wars.atWar(sea, n)) return;
    cand.push([seaKm(w, fx, fy, (at % cw) + 0.5, Math.floor(at / cw) + 0.5), `${p.name}(${TAGS_1938[holder - 1] ?? holder})`]);
    void p;
  });
  cand.sort((a, b) => a[0] - b[0]);
  const tries = cand.slice(0, 4).map(([km, name]) => {
    const p = w.ports.find((q) => name.startsWith(`${q.name}(`))!;
    const [px, py] = w.cellPoint(p.cell);
    const sv = s.save();
    const r = tryLanding(w, id, px, py);
    s.load(sv);
    c = w.formations.cols;
    return `${name} ${Math.round(km)}km -> ${r}`;
  });
  console.log(`  targets: ${tries.join(', ')}`);
  console.log(`day ${d} (${day}) actor ${(day + n) % STAGGER === 0} at ${k % cw},${Math.floor(k / cw)} moving ${c.moving[id]} men ${c.strength[id]} tryLanding ${why} | ${groups.join('; ')}`);
  s.step(24);
}
console.log('done:');
