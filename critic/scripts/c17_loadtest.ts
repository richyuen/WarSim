// Critic run 17: does a run-16 save (7b883084) load and step on HEAD?
import { readFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, inF] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(inF!)));
const t0 = sim.world.tick; sim.step(48);
console.log('loaded', inF, t0, '->', sim.world.tick, sim.hash().toString(16));
