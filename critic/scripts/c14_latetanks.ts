// Critic run 14: late armour in contact. From a save, 30 days day by day: engaged land formations whose template is
// tracked (mobility 2), with their men and the tanks they hold; the share of engaged formations that are armour.
// Usage: npx tsx critic/scripts/c14_latetanks.ts <seed:bin>...
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
  const w = sim.world; const c = w.formations.cols; const T = w.rules!.templates;
  let engDays = 0, armEngDays = 0; const firsts: unknown[] = []; const armAll = { n: 0, hollow: 0 };
  for (let d = 0; d < 30; d++) {
    sim.step(24);
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
      const t = T[c.template[id]!]!;
      const key = `t${c.template[id]}`;
      const arm = t.mobility === 2;
      if (d === 0 && arm) { armAll.n++; if (c.strength[id]! < 500) armAll.hollow++; }
      if (!c.engaged[id]) return;
      engDays++;
      if (arm) { armEngDays++; if (firsts.length < 6) firsts.push({ day: d + 1, id, key, men: c.strength[id], x: +c.x[id]!.toFixed(1), y: +c.y[id]!.toFixed(1), nation: c.nation[id] }); }
    });
  }
  const r = { seed: Number(seedS), bin, engagedFormationDays: engDays, armourEngagedDays: armEngDays, armourLand: armAll, firsts };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync(process.env.OUT ?? 'critic/c14_latetanks.json', JSON.stringify(res, null, 1));
