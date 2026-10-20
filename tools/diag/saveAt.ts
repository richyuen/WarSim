/**
 * PLAN 7.37d: a checkpoint at an exact tick (`npm run sim -- --save` writes whole years), from 1938 or
 * from another checkpoint: a case's decision replayed from a state just before it, before and after
 * a rule (the critic's code in a worktree, ADR-564's A/B).
 *
 * Usage: npx tsx tools/diag/saveAt.ts <seed> <tick> <out.bin> [from.bin]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const tick = Number(process.argv[3]);
const out = process.argv[4]!;
const from = process.argv[5];
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (from) sim.load(new Uint8Array(readFileSync(from)));
while (sim.world.tick < tick)
  sim.step(Math.min(24, tick - sim.world.tick), (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
writeFileSync(out, sim.save());
process.stderr.write(`done: tick ${sim.world.tick} -> ${out}\n`);
