/**
 * PLAN 7.106's A/B from one saved state: steps a save `days` days and prints the founded nations
 * alive (origin ≠ 0) and the land moved (owner changed, land cells) since the save, the AT's two
 * figures when the save is year 25 of a 30-year run (`foundedAt.ts`).
 *
 * Usage: npx tsx tools/diag/foundedFrom.ts <seed> <in.bin> <days> [out.bin]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Terrain } from '../../src/shared/terrain';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, daysS, outBin] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const before = w.cells.owner.slice();
s.step(Number(daysS) * 24, (ww) => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
});
const nc = w.nations.cols;
let founded = 0;
let living = 0;
w.nations.forEach((n) => {
  if (nc.living[n] !== 1) return;
  living++;
  if (nc.origin[n] !== 0) founded++;
});
let land = 0;
let moved = 0;
for (let c = 0; c < before.length; c++) {
  if (w.cells.terrain[c] === Terrain.Water) continue;
  land++;
  if (before[c] !== w.cells.owner[c]) moved++;
}
if (outBin) writeFileSync(outBin, s.save());
console.log(`done: ${seedS} founded alive ${founded} of ${living}; moved ${((100 * moved) / land).toFixed(1)} %`);
