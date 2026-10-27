/**
 * PLAN 7.148's read: checkpoints of a 1938 world every `every` days to `until` days, for windows stepped both ways
 * (`seaWindow.ts`). Files `<dir>/<seed>_d<day>.bin`.
 *
 * Usage: npx tsx tools/diag/seaSaves.ts <seed> [every = 90] [until = 1080] [dir = .cache/7148/saves]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const every = Number(process.argv[3] ?? 90);
const until = Number(process.argv[4] ?? 1080);
const dir = process.argv[5] ?? '.cache/7148/saves';
mkdirSync(dir, { recursive: true });
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
for (let day = every; day <= until; day += every) {
  sim.step(24 * every, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  writeFileSync(`${dir}/${seed}_d${day}.bin`, sim.save());
  console.log(`day ${day}`);
}
console.log('done:');
