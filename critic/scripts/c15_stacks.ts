// Critic run 15: in each checkpoint, the biggest pile of one nation's idle land formations (not
// moving, not engaged) within 3 cells of one another, and where. Usage: npx tsx ... <seed:bin>...
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
const assets = loadAssets1938(size1938(undefined).w);
const res: unknown[] = [];
for (const arg of process.argv.slice(2)) {
  const [seedS, bin] = arg.split(':');
  const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  sim.load(new Uint8Array(readFileSync(bin!)));
  const w = sim.world; const c = w.formations.cols;
  const nm = (id: number) => { const d = NATIONS_1938[id - 1]; return d && (w.nations.cols.origin[id] ?? 0) === 0 ? (en as Record<string, string>)[d.nameKey] ?? d.tag : `founded#${id}`; };
  const idle: number[] = []; let total = 0;
  w.formations.forEach((id) => { if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return; total++; if (!c.moving[id] && !c.engaged[id]) idle.push(id); });
  let best = { n: 0, men: 0, nation: 0, x: 0, y: 0, atWar: false };
  for (const a of idle) {
    let n = 0, men = 0;
    for (const b of idle) { if (c.nation[b] !== c.nation[a]) continue; const dx = c.x[a]! - c.x[b]!, dy = c.y[a]! - c.y[b]!; if (dx * dx + dy * dy <= 9) { n++; men += c.strength[b]!; } }
    if (n > best.n) best = { n, men, nation: c.nation[a]!, x: +c.x[a]!.toFixed(1), y: +c.y[a]!.toFixed(1), atWar: w.wars.list.some((wr) => wr.sides.some((s) => s.includes(c.nation[a]!))) };
  }
  let navTotal = 0; w.formations.forEach((id) => { if (c.nation[id] === best.nation && !w.isFleet(id) && !w.isWing(id)) navTotal++; });
  const r = { seed: Number(seedS), bin, tick: w.tick, landFormations: total, idle: idle.length, pile: { ...best, name: nm(best.nation), ofNation: navTotal } };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync('critic/c15_stacks.json', JSON.stringify(res, null, 1));
