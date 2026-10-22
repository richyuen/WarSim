/**
 * PLAN 7.79d: how far a land formation on the march goes a day, cells (from a saved state): of the
 * land formations moving at the start and the end of each day, the straight distance covered, by
 * quantile. Usage: npx tsx tools/diag/marchSpeed.ts <seed> <state.bin> <days>
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seed, bin, days] = [Number(process.argv[2]), process.argv[3]!, Number(process.argv[4])];
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const f = w.formations.cols;
const seen: number[] = [];
for (let d = 0; d < days; d++) {
  const at = new Map<number, [number, number]>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id) && !w.isWing(id) && !w.offLand(id) && f.moving[id] === 1) at.set(id, [f.x[id]!, f.y[id]!]);
  });
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  for (const [id, [x, y]] of at) {
    if (!w.formations.has(id) || f.moving[id] !== 1 || w.offLand(id)) continue;
    let dx = Math.abs(f.x[id]! - x);
    if (dx > w.cells.w / 2) dx = w.cells.w - dx;
    seen.push(Math.hypot(dx, f.y[id]! - y));
  }
}
seen.sort((a, b) => a - b);
const q = (p: number): number => Math.round(seen[Math.floor(p * (seen.length - 1))]! * 10) / 10;
console.log(`map ${w.cells.w}x${w.cells.h}; ${seen.length} formation-days on the march; cells a day p25 ${q(0.25)} p50 ${q(0.5)} p75 ${q(0.75)} p90 ${q(0.9)}`);
console.log('done:');
