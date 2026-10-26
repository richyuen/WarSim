/**
 * PLAN 7.129: the state's hash after each hour from a saved state, one line an hour (`hour hash`),
 * to find the first hour at which two trees' rules part (`diff` the two outputs).
 *
 * Usage: npx tsx tools/diag/hashSteps.ts <seed> <state.bin> <hours>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const s = new Sim({ scenario: '1938', seed: Number(process.argv[2]), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(process.argv[3]!)));
const hours = Number(process.argv[4]);
const clear = (w: typeof s.world): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
for (let h = 0; h < hours; h++) {
  s.step(1, clear);
  console.log(h, s.hash().toString(16));
}
