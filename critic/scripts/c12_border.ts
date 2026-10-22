// Critic run 12: from a checkpoint, the land borders between nations at war with each other (cells
// of A next to cells of B), how many, and the formations of either side within 10 cells of each.
// Usage: npx tsx critic/scripts/c12_border.ts <seed> <bin>
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
const seed = Number(process.argv[2]);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(process.argv[3]!)));
const w = sim.world; const C = w.cells.controller; const W = w.cells.w; const H = C.length / W;
const nm = (id: number) => { const d = NATIONS_1938[id - 1]; return d && (w.nations.cols.origin[id] ?? 0) === 0 ? (en as Record<string, string>)[d.nameKey] ?? d.tag : `founded#${id}`; };
const foes = new Map<string, number>();
for (const war of w.wars.list) for (const a of war.sides[0]!) for (const b of war.sides[1]!) { foes.set(`${a},${b}`, 1); foes.set(`${b},${a}`, 1); }
const pairs = new Map<string, { n: number; x: number; y: number }>();
for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) {
  const a = C[y * W + x]!, b = C[y * W + x + 1]!, c = y + 1 < H ? C[(y + 1) * W + x]! : 0;
  for (const o of [b, c]) if (a && o && a !== o && foes.has(`${a},${o}`)) { const k = a < o ? `${a},${o}` : `${o},${a}`; const p = pairs.get(k) ?? { n: 0, x: 0, y: 0 }; p.n++; p.x += x; p.y += y; pairs.set(k, p); }
}
const fc = w.formations.cols; const out: unknown[] = [];
for (const [k, p0] of [...pairs].sort((a, b) => b[1].n - a[1].n).slice(0, 8)) { const p = { n: p0.n, x: Math.round(p0.x / p0.n), y: Math.round(p0.y / p0.n) };
  const [a, b] = k.split(',').map(Number);
  let fa = 0, fb = 0;
  w.formations.forEach((id) => { if (w.isFleet(id) || w.isWing(id)) return; const d = Math.hypot(fc.x[id]! - p.x, fc.y[id]! - p.y); if (d > 10) return; if (fc.nation[id] === a) fa++; if (fc.nation[id] === b) fb++; });
  out.push({ a: nm(a!), b: nm(b!), borderEdges: p.n, at: [p.x, p.y], formationsWithin10: [fa, fb] });
}
console.log(JSON.stringify({ seed, tick: w.tick, wars: w.wars.list.length, borders: out }, null, 1));
writeFileSync(`critic/c12_border_${seed}.json`, JSON.stringify(out, null, 1));
