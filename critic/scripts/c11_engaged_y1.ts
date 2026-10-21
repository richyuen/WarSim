// Critic run 11: engaged land formations in the first year of a fresh 1938 world, every 15 days.
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const sim = new Sim({ scenario: '1938', seed: Number(process.argv[2] ?? 6421), assets: loadAssets1938(size1938(undefined).w) });
const w = sim.world; const c = w.formations.cols; const out: number[] = [];
for (let d = 0; d <= 360; d += 15) {
  let e = 0; w.formations.forEach((id) => { if (!w.isFleet(id) && !w.isWing(id) && c.engaged[id]) e++; });
  out.push(e); sim.step(24 * 15);
}
console.log(JSON.stringify({ seed: process.argv[2], engagedEvery15Days: out }));
