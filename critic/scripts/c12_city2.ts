// Critic run 12: the cities within 8 cells of a strike point, their holders and populations, from a checkpoint,
// then stepped past the strike tick: what the burst did to each.
// Usage: npx tsx critic/scripts/c12_city2.ts <seed> <bin> <x> <y> <hoursToStep>
import { readFileSync } from 'node:fs';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
const [seedS, bin, xs, ys, hs] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(bin!)));
const w = sim.world as any;
const nm = (id: number): string => { const d = NATIONS_1938[id - 1]; return d && (w.nations.cols.origin[id] ?? 0) === 0 ? (en as Record<string, string>)[d.nameKey] ?? d.tag : `founded#${id}`; };
const px = Number(xs), py = Number(ys);
const cols = w.cities.cols;
console.log('city cols', Object.keys(cols));
const snap = () => { const r: unknown[] = []; w.cities.forEach((id: number) => { const d = Math.hypot(cols.x[id] - px, cols.y[id] - py); if (d < 8) { const cell = Math.floor(cols.y[id]) * w.cells.w + Math.floor(cols.x[id]); r.push({ id, name: w.cityNames?.[id] ?? null, d: +d.toFixed(2), holder: nm(w.cells.controller[cell]), pop: cols.pop?.[id] ?? null, size: cols.size?.[id] ?? null, def: cols.def?.[id] ?? null }); } }); return r; };
console.log('before', JSON.stringify(snap()));
const atWar = (a: number, b: number) => w.wars.list.some((wr: any) => (wr.sides[0].includes(a) && wr.sides[1].includes(b)) || (wr.sides[1].includes(a) && wr.sides[0].includes(b)));
const J = NATIONS_1938.findIndex((n) => n.tag === 'JAP') + 1, I = NATIONS_1938.findIndex((n) => n.tag === 'ITA') + 1, N = NATIONS_1938.findIndex((n) => n.tag === 'NED') + 1;
console.log('war JAP-ITA', atWar(J, I), 'JAP-NED', atWar(J, N));
sim.step(Number(hs));
console.log('after', JSON.stringify(snap()));
