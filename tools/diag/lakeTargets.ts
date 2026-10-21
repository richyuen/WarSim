/**
 * PLAN 7.56b's search for a test case: in the 1938 world, for each port of nation A with water,
 * the port of nation B nearest it by straight km (`seaKm`) with an open zone, and whether it is in
 * the waters A's ships sail from there (`waterKeys`); the ports whose nearest is not.
 *
 * Usage: npx tsx tools/diag/lakeTargets.ts <A> <B>
 */
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { keyAt, seaKm, waterKeys } from '../../src/sim/systems/navalCombat';
import { portSeaOf, seaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const A = TAGS_1938.indexOf(process.argv[2]!) + 1;
const B = TAGS_1938.indexOf(process.argv[3]!) + 1;
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const cw = w.cells.w;
const water = portSeaOf(w);
const z = seaOf(w);
const keys = waterKeys(w, A);
const ctl = w.cells.controller;
w.ports.forEach((p, i) => {
  if (ctl[p.cell] !== A || water[i]! < 0) return;
  const [x, y] = [(water[i]! % cw) + 0.5, Math.floor(water[i]! / cw) + 0.5];
  const mine = keyAt(w, keys, x, y);
  const rows: [number, string, boolean][] = [];
  w.ports.forEach((q, k) => {
    const at = water[k]!;
    if (ctl[q.cell] !== B || at < 0) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1) return;
    rows.push([seaKm(w, x, y, (at % cw) + 0.5, Math.floor(at / cw) + 0.5), q.name, keys[zone] === mine]);
  });
  rows.sort((a, b) => a[0] - b[0]);
  if (rows.length > 0 && !rows[0]![2]) console.log(`${p.name}: ${rows.slice(0, 3).map(([km, n, ok]) => `${n} ${Math.round(km)} km ${ok ? 'sails' : 'NO WAY'}`).join(', ')}`);
});
console.log('done:');
