// Critic run 16: land formations engaged (in contact) in each checkpoint, of all land formations, and
// the nations at war. Usage: npx tsx critic/scripts/c16_engaged.ts <seed:bin>...
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const assets = loadAssets1938(size1938(undefined).w);
const res: unknown[] = [];
for (const arg of process.argv.slice(2)) {
  const [seedS, bin] = arg.split(':');
  const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  sim.load(new Uint8Array(readFileSync(bin!)));
  const w = sim.world; const c = w.formations.cols;
  const atWar = new Set<number>(); for (const wr of w.wars.list) for (const s of wr.sides) for (const n of s) atWar.add(n);
  let land = 0, eng = 0, landAtWar = 0, engSamples: number[] = [];
  const hours = 24 * 7;
  for (let h = 0; h <= hours; h += 24) {
    if (h) sim.step(24);
    let e = 0; w.formations.forEach((id) => { if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return; if (c.engaged[id]) e++; });
    engSamples.push(e);
  }
  w.formations.forEach((id) => { if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return; land++; if (atWar.has(c.nation[id]!)) landAtWar++; if (c.engaged[id]) eng++; });
  const r = { seed: Number(seedS), bin, tick: w.tick, wars: w.wars.list.length, nationsAtWar: atWar.size, land, landAtWar, engagedDaily: engSamples, sorties: w.sorties.size };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync(process.env.OUT ?? 'critic/c16_engaged.json', JSON.stringify(res, null, 1));
