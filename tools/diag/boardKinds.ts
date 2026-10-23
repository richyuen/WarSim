/**
 * PLAN 7.89: formations put aboard in `days` days from a save, world-wide, by trip: a landing (target
 * held by a nation at war with the formation's) or a ferry (any other). Read only.
 *
 * Usage: npx tsx tools/diag/boardKinds.ts <seed> <state.bin> <days> <label>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, daysS, label] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const seen = new Set<number>();
let landing = 0;
let ferry = 0;
for (let h = 0; h < Number(daysS) * 24; h++) {
  s.step(1);
  w.out.events.length = 0;
  w.out.fires.length = 0;
  for (const [id, e] of w.embarked) {
    if (seen.has(id)) continue;
    seen.add(id);
    const n = w.formations.cols.nation[id]!;
    const at = w.cells.controller[e.target]!;
    if (at !== 0 && at !== n && w.wars.atWar(n, at)) landing++;
    else ferry++;
  }
  for (const id of [...seen]) if (!w.embarked.has(id)) seen.delete(id);
}
console.log(`${label} ${seedS}: boarded landing ${landing} ferry ${ferry}`);
