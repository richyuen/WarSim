// Critic run 14: engaged land formations every 15 days through the year after a checkpoint, with the
// wars, the nations at war, and the cells that changed hands in each 15 days.
// Usage: npx tsx critic/scripts/c14_engaged_year.ts <seed> <bin>
import { readFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const sim = new Sim({ scenario: '1938', seed: Number(process.argv[2]), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(process.argv[3]!)));
const w = sim.world; const c = w.formations.cols; const out: unknown[] = [];
let prev = w.cells.controller.slice();
for (let d = 0; d <= 360; d += 15) {
  let e = 0; w.formations.forEach((id) => { if (!w.isFleet(id) && !w.isWing(id) && c.engaged[id]) e++; });
  const cc = w.cells.controller; let flips = 0; for (let i = 0; i < cc.length; i++) if (cc[i] !== prev[i]) flips++; prev = cc.slice();
  out.push([d, e, w.wars.list.length, flips]); sim.step(24 * 15);
}
console.log(JSON.stringify({ seed: process.argv[2], bin: process.argv[3], dayEngagedWarsFlips: out }));
