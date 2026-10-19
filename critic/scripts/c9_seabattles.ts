// Critic run 9: sea battles from a headless save, each with the ships each side lost, for N years.
// Usage: npx tsx critic/scripts/c9_seabattles.ts <seed> <save.bin> <years> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIDE_SHIPS } from '../../src/shared/history';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };

const seed = Number(process.argv[2]);
const bin = process.argv[3]!;
const years = Number(process.argv[4] ?? 1);
const out = process.argv[5]!;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
sim.load(new Uint8Array(readFileSync(bin)));
const world = sim.world;
const nm = (id: number): string => {
  const d = NATIONS_1938[id - 1];
  if (d && (world.nations.cols.origin[id] ?? 0) === 0) return (en as Record<string, string>)[d.nameKey] ?? d.tag;
  return `founded#${id}`;
};
const rows: { tick: number; a: string; lostA: number; b: string; lostB: number; x: number; y: number }[] = [];
for (let t = 0; t < years * 8760; t++) {
  sim.step(1, (w) => {
    const e = w.out.events;
    for (let i = 0; i < e.length; i += 6) {
      if (e[i + 1] === EventKind.SeaBattle) {
        const A = e[i + 2]!, B = e[i + 3]!;
        rows.push({ tick: w.tick, a: nm(A % SIDE_SHIPS), lostA: Math.floor(A / SIDE_SHIPS), b: nm(B % SIDE_SHIPS), lostB: Math.floor(B / SIDE_SHIPS), x: e[i + 4]!, y: e[i + 5]! });
      }
    }
    e.length = 0;
    w.out.fires.length = 0;
  });
}
const zero = rows.filter((r) => r.lostA + r.lostB === 0).length;
const pairs: Record<string, number> = {};
for (const r of rows) pairs[`${r.a}/${r.b}${r.lostA + r.lostB === 0 ? ' (0 lost)' : ''}`] = (pairs[`${r.a}/${r.b}${r.lostA + r.lostB === 0 ? ' (0 lost)' : ''}`] ?? 0) + 1;
writeFileSync(out, JSON.stringify({ seed, bin, years, n: rows.length, zero, pairs, rows: rows.slice(0, 400) }, null, 1));
console.log(JSON.stringify({ seed, n: rows.length, zero, pairs }));
