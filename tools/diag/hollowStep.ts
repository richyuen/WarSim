/**
 * PLAN 7.116a's check from a save: loads it, steps `days` days and prints, every `every` days, the
 * land formations of living nations on land and those under 500 men, and those engaged.
 *
 * Usage: npx tsx tools/diag/hollowStep.ts <save.bin> [days=30] [every=7]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const bin = process.argv[2]!;
const days = Number(process.argv[3] ?? 30);
const every = Number(process.argv[4] ?? 7);
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const count = (): string => {
  const c = w.formations.cols;
  let land = 0;
  let hollow = 0;
  let engaged = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
    land++;
    if (c.strength[id]! < 500) hollow++;
    if (c.engaged[id] === 1) engaged++;
  });
  return `land ${land} hollow ${hollow} engaged ${engaged}`;
};
const quiet = (): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
console.log(`${bin} day 0: ${count()}`);
for (let d = 1; d <= days; d++) {
  s.step(24, quiet);
  if (d % every === 0 || d === 1) console.log(`${bin} day ${d}: ${count()}`);
}
