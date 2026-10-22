// Critic run 12: how broken up the map is in each checkpoint: the 4-connected pieces of land of one
// holder (controller), all nations; pieces of 2 to 400 cells; and the most-broken nation.
// Usage: npx tsx critic/scripts/c12_frag.ts <seed:bin>...  (OUT env: the json file)
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
  if (bin !== 'start') sim.load(new Uint8Array(readFileSync(bin!)));
  const w = sim.world; const C = w.cells.controller; const W = w.cells.w; const N = C.length; const H = N / W;
  const nm = (id: number) => { const d = NATIONS_1938[id - 1]; return d && (w.nations.cols.origin[id] ?? 0) === 0 ? (en as Record<string, string>)[d.nameKey] ?? d.tag : `founded#${id}`; };
  const seen = new Uint8Array(N); const stack = new Int32Array(N);
  let pieces = 0, mid = 0; const per = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    const o = C[i]!; if (!o || seen[i]) continue;
    let sp = 0, size = 0; stack[sp++] = i; seen[i] = 1;
    while (sp) { const c = stack[--sp]!; size++; const x = c % W, y = (c - x) / W;
      const nb = [x > 0 ? c - 1 : c + W - 1, x < W - 1 ? c + 1 : c - W + 1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1];
      for (const n of nb) if (n >= 0 && !seen[n] && C[n] === o) { seen[n] = 1; stack[sp++] = n; } }
    pieces++; if (size >= 2 && size <= 400) { mid++; per.set(o, (per.get(o) ?? 0) + 1); }
  }
  const worst = [...per].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o, n]) => `${nm(o)} ${n}`);
  const r = { seed: Number(seedS), bin, pieces, pieces2to400: mid, worst };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync(process.env.OUT ?? 'critic/c12_frag.json', JSON.stringify(res, null, 1));
