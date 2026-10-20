// Critic run 10: the nearest 1938 city to a few strike points.
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const sim = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(size1938(undefined).w) });
const w = sim.world as unknown as { cities: { forEach?: (f: (id: number) => void) => void; cols?: Record<string, ArrayLike<number>> } };
const pts = [[1418.2, 348.0], [1566.3, 565.7], [1714.8, 413.8], [1037.3, 294.8], [1095.0, 344.0], [1083.2, 290.8], [1089.8, 300.2]];
console.log(Object.keys(sim.world).filter((k) => /cit/i.test(k)));
const c = (sim.world as any).cities;
console.log(c && Object.keys(c));
const cols = c.cols; console.log(Object.keys(cols));
const names = (sim.world as any).cityNames;
for (const [px, py] of pts) {
  let best = -1, bd = 1e9;
  c.forEach((id: number) => { const d = Math.hypot(cols.x[id] - px, cols.y[id] - py); if (d < bd) { bd = d; best = id; } });
  console.log(px, py, '-> def', cols.def[best], 'pop', cols.pop?.[best] ?? cols.size?.[best], 'd', bd.toFixed(2));
}
