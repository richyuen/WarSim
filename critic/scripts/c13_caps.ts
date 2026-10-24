// Critic run 12: capitals captured and moved through one year after a checkpoint: how often the same
// nation's capital is taken again, and how many times one nation's capital moves.
// Usage: npx tsx critic/scripts/c13_caps.ts <seed> <bin> [years]
import { readFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
const seed = Number(process.argv[2]);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
if (process.argv[3] && process.argv[3] !== 'start') sim.load(new Uint8Array(readFileSync(process.argv[3])));
const years = Number(process.argv[4] ?? 1);
const w = sim.world;
const nm = (id: number): string => { const d = NATIONS_1938[id - 1]; return d && (w.nations.cols.origin[id] ?? 0) === 0 ? (en as Record<string, string>)[d.nameKey] ?? d.tag : `founded#${id}`; };
const caps: { t: number; a: number; b: number; x: number; y: number }[] = [];
const moves = new Map<number, number>();
for (let h = 0; h < 8760 * years; h++) {
  sim.step(1, (ww) => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) {
      const k = e[i + 1]!;
      if (k === EventKind.CapitalCaptured) caps.push({ t: ww.tick, a: e[i + 2]!, b: e[i + 3]!, x: e[i + 4]!, y: e[i + 5]! });
      if (k === EventKind.CapitalMoved) moves.set(e[i + 2]!, (moves.get(e[i + 2]!) ?? 0) + 1);
    }
    e.length = 0; ww.out.fires.length = 0;
  });
}
// the victim is whichever of a, b is not the captor; print raw a/b with names
const byPair = new Map<string, number[]>();
for (const c of caps) { const k = `${nm(c.b)} took ${nm(c.a)}`; byPair.set(k, [...(byPair.get(k) ?? []), Math.round(c.t / 24)]); }
const repeated = [...byPair].filter(([, d]) => d.length > 1).sort((a, b) => b[1].length - a[1].length);
const out = { seed, bin: process.argv[3], years, captures: caps.length, pairs: byPair.size, pairsRepeated: repeated.length, capturesInRepeats: repeated.reduce((s, [, d]) => s + d.length, 0), top: repeated.slice(0, 8).map(([k, d]) => ({ k, n: d.length, days: d.slice(0, 10) })), movesTotal: [...moves.values()].reduce((a, b) => a + b, 0), movesTop: [...moves].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${nm(n)} ${c}`) };
console.log(JSON.stringify(out));
