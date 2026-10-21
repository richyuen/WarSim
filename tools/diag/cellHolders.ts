/**
 * The holders round a cell after `days` of a saved state, and the wars they are in with a nation
 * (PLAN 7.56's trace: whose front a sector is).
 *
 * Usage: npx tsx tools/diag/cellHolders.ts <seed:state.bin> <days> <x,y> <TAG> [radius]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seed, src] = process.argv[2]!.split(':');
const days = Number(process.argv[3]);
const [x, y] = process.argv[4]!.split(',').map(Number) as [number, number];
const n = TAGS_1938.indexOf(process.argv[5]!) + 1;
const r = Number(process.argv[6] ?? 3);
const tag = (k: number): string => (k === 0 ? '-' : (TAGS_1938[k - 1] ?? `#${k}`));
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
s.load(new Uint8Array(readFileSync(src!)));
s.step(24 * days);
const count = new Map<number, number>();
for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
  const k = w.cells.controller[(y + dy) * w.cells.w + x + dx]!;
  count.set(k, (count.get(k) ?? 0) + 1);
}
for (const [k, m] of count) console.log(`${tag(k)}: ${m} cells; at war with ${tag(n)}: ${w.wars.atWar(n, k)}; same side: ${k === n || w.wars.list.some((war) => war.sides.some((sd) => sd.includes(n) && sd.includes(k)))}`);
console.log('done:');
