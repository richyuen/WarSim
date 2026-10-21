// Critic run 11: load a checkpoint, step to the start of year <toYear>, save it.
// Usage: npx tsx critic/scripts/c11_ck.ts <seed> <in.bin> <toYear> <out.bin>
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, inF, toS, outF] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(inF!)));
const target = (Number(toS) - 1) * 8760;
while (sim.world.tick < target) sim.step(Math.min(24, target - sim.world.tick));
writeFileSync(outF!, sim.save());
console.log('saved', outF, sim.world.tick, sim.hash().toString(16));
