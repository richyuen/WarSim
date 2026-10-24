/**
 * PLAN 7.106's measure: the land moved between two saves of one run (owner changed, land cells),
 * split by whether the owner before or after is a founded nation (origin ≠ 0 in its own save).
 *
 * Usage: npx tsx tools/diag/movedBy.ts <seed> <before.bin> <after.bin>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Terrain } from '../../src/shared/terrain';
import { loadAssets1938 } from '../headless/assets';

const [seedS, a, b] = process.argv.slice(2);
const assets = loadAssets1938(SIZE_1938.w);
const read = (bin: string): { owner: Uint32Array; founded: (n: number) => boolean; terrain: Uint8Array } => {
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const origin = w.nations.cols.origin.slice();
  return { owner: Uint32Array.from(w.cells.owner), founded: (n) => n !== 0 && (origin[n] ?? 0) !== 0, terrain: Uint8Array.from(w.cells.terrain) };
};
const x = read(a!);
const y = read(b!);
let land = 0;
let moved = 0;
let founded = 0;
let fromFounded = 0;
let toFounded = 0;
for (let c = 0; c < x.owner.length; c++) {
  if (x.terrain[c] === Terrain.Water) continue;
  land++;
  if (x.owner[c] === y.owner[c]) continue;
  moved++;
  const f0 = x.founded(x.owner[c]!);
  const f1 = y.founded(y.owner[c]!);
  if (f0 || f1) founded++;
  if (f0) fromFounded++;
  if (f1) toFounded++;
}
console.log(`done: ${seedS} moved ${((100 * moved) / land).toFixed(1)} % of land; touching founded ${((100 * founded) / Math.max(1, moved)).toFixed(1)} % of it (from founded ${((100 * fromFounded) / Math.max(1, moved)).toFixed(1)} %, to founded ${((100 * toFounded) / Math.max(1, moved)).toFixed(1)} %)`);
