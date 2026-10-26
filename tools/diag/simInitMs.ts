/**
 * PLAN 7.125: how long a new process takes to make a 1938 Sim (the world built, the map's caches
 * with it), timed alone. Usage: npx tsx tools/diag/simInitMs.ts [seed = 99]
 */
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2] ?? 99);
const assets = loadAssets1938(SIZE_1938.w);
const a = performance.now();
new Sim({ scenario: '1938', seed, assets });
console.log(`new Sim 1938 seed ${seed}: ${(performance.now() - a).toFixed(0)} ms`);
console.log('done:');
