// Critic run 14: the map's small pieces (2-400 cells of one holder, 4-connected, by controller) and of those
// the enclaves: pieces whose land rim (other held cells next to it) is one other holder alone; and of
// those the enclaves at peace (no war between the piece's holder and the rim's holder).
// Usage: npx tsx critic/scripts/c14_frag2.ts <seed:bin>...  (OUT env: the json file)
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
  const w = sim.world; const C = w.cells.controller; const W = w.cells.w; const N = C.length; const H = N / W;
  const atWar = new Set<string>();
  for (const wr of w.wars.list) { const [a, b] = wr.sides; for (const x of a!) for (const y of b!) { atWar.add(`${x},${y}`); atWar.add(`${y},${x}`); } }
  const seen = new Uint8Array(N); const stack = new Int32Array(N); const cellsOf: number[] = [];
  let mid = 0, encl = 0, enclPeace = 0, enclWar = 0, cellsMid = 0;
  for (let i = 0; i < N; i++) {
    const o = C[i]!; if (!o || seen[i]) continue;
    let sp = 0; cellsOf.length = 0; stack[sp++] = i; seen[i] = 1; const rim = new Set<number>();
    while (sp) { const c = stack[--sp]!; cellsOf.push(c); const x = c % W, y = (c - x) / W;
      const nb = [x > 0 ? c - 1 : c + W - 1, x < W - 1 ? c + 1 : c - W + 1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1];
      for (const n of nb) { if (n < 0) continue; const h = C[n]!; if (h === o) { if (!seen[n]) { seen[n] = 1; stack[sp++] = n; } } else if (h) rim.add(h); } }
    const size = cellsOf.length;
    if (size >= 2 && size <= 400) { mid++; cellsMid += size;
      if (rim.size === 1) { encl++; const r = [...rim][0]!; if (atWar.has(`${o},${r}`)) enclWar++; else enclPeace++; } }
  }
  const r = { seed: Number(seedS), bin, tick: w.tick, pieces2to400: mid, cellsInThem: cellsMid, enclaves: encl, enclavesAtPeace: enclPeace, enclavesAtWar: enclWar };
  res.push(r); console.log(JSON.stringify(r));
}
writeFileSync(process.env.OUT ?? 'critic/c14_frag2.json', JSON.stringify(res, null, 1));
