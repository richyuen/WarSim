// Critic run 13: land formations by strength in a checkpoint: how many are hollow (under 500 / 1,000 men),
// and of those how many belong to nations at war. Usage: npx tsx critic/scripts/c13_hollow.ts <seed:bin>... (OUT env)
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
  let land = 0, u500 = 0, u1000 = 0, u500War = 0, men = 0;
  w.formations.forEach((id) => { if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return; land++; const s = c.strength[id]!; men += s; if (s < 500) { u500++; if (atWar.has(c.nation[id]!)) u500War++; } if (s < 1000) u1000++; });
  const r = { seed: Number(seedS), bin, land, under500: u500, under1000: u1000, under500AtWar: u500War, meanMen: Math.round(men / Math.max(1, land)) };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync(process.env.OUT ?? 'critic/c13_hollow.json', JSON.stringify(res, null, 1));
