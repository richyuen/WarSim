/**
 * PLAN 7.49: land formations standing on a cell no nation controls (the crossings of straits, of no
 * province: Gibraltar's 992,383, Bab-el-Mandeb's 1270,525, the Bosporus's 1111,368, the Øresund's
 * 1087,245, the Palk Strait's 1473,543 at M), per saved state: how many, of them of nations at war,
 * and the four largest groups (nation, cell, whether on the march). With `--days`, read after the
 * state has run that many days.
 *
 * Usage: npx tsx tools/diag/noOnesCells.ts [--days 0] <seed:state.bin> [...]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const args = process.argv.slice(2);
const di = args.indexOf('--days');
const days = di >= 0 ? Number(args.splice(di, 2)[1]) : 0;
let all = 0;
let atWarAll = 0;
for (const a of args) {
  const [seed, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < days; d++) s.step(24, quiet);
  const c = w.formations.cols;
  const cw = w.cells.w;
  const fighting = w.wars.nations();
  const groups = new Map<string, number>();
  let n = 0;
  let atWar = 0;
  let land = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    land++;
    const cell = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
    if (w.cells.controller[cell] !== 0) return;
    n++;
    if (fighting.has(c.nation[id]!)) atWar++;
    const k = `${tag(c.nation[id]!)}@${cell % cw},${Math.floor(cell / cw)}${c.moving[id] ? ' moving' : ''}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  });
  all += n;
  atWarAll += atWar;
  const top = [...groups].sort((x, y) => y[1] - x[1]).slice(0, 4);
  console.log(`${seed} ${bin}: land ${land}, on no one's cell ${n}, of nations at war ${atWar}; ${top.map(([k, v]) => `${k} ×${v}`).join('; ')}`);
}
console.log(`total ${all}, of nations at war ${atWarAll}`);
