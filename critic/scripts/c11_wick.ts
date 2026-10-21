// Critic run 11: who stands at Wick before the Soviet strike of seed 1129 (tick 140833); samples
// from the year-17 checkpoint every 30 days: UK formations within 6 cells of the burst.
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const sim = new Sim({ scenario: '1938', seed: 1129, assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync('critic/c11_seed1129_y17s.bin')));
const w = sim.world;
const [bx, by] = [1005.6875, 218.9375];
const out: unknown[] = [];
const sample = () => {
  const near: unknown[] = []; let men = 0; const nations: Record<number, number> = {};
  w.formations.forEach((id) => {
    const c = w.formations.cols; const dx = c.x[id]! - bx, dy = c.y[id]! - by;
    if (dx * dx + dy * dy > 36) return;
    nations[c.nation[id]!] = (nations[c.nation[id]!] ?? 0) + 1;
    men += c.strength[id]!;
    near.push({ id, n: c.nation[id], s: c.strength[id], mv: c.moving[id], eng: c.engaged[id], home: c.home[id], sup: +c.supply[id]!.toFixed(2), tgt: c.targetCell[id], emb: w.embarked.has(id), fleet: w.isFleet(id) });
  });
  const r = { tick: w.tick, count: near.length, men, nations, sampleF: near.slice(0, 8) };
  out.push(r); console.log(JSON.stringify(r).slice(0, 600));
};
for (let i = 0; i < 30 && w.tick < 140833; i++) { sample(); sim.step(Math.min(24 * 2, 140833 - w.tick)); }
sample();
writeFileSync('critic/c11_wick_1129.json', JSON.stringify(out, null, 1));
