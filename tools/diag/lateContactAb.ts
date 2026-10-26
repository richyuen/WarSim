/**
 * PLAN 7.128b's bisect: land contact late, the same saved worlds stepped by the rules of the tree
 * this runs in. Per save, loaded and stepped `days` days: engaged land formations (not fleets,
 * wings or aboard, as `contactYears.ts` and the critic count them) at hour 12 of each day, the
 * mean, and of them those under 500 men; and the land formations then. One line per save and a mean.
 *
 * Usage: npx tsx tools/diag/lateContactAb.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 90);
const rows: { seed: number; src: string; engaged: number; hollow: number; land: number }[] = [];
const assets = loadAssets1938(SIZE_1938.w);
for (const a of process.argv.slice(4)) {
  const at = a.indexOf(':');
  const seedS = a.slice(0, at);
  const src = a.slice(at + 1);
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  s.load(new Uint8Array(readFileSync(src!)));
  const count = (): { e: number; h: number; n: number } => {
    let e = 0;
    let h = 0;
    let n = 0;
    const c = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      n++;
      if (c.engaged[id] !== 1) return;
      e++;
      if (c.strength[id]! < 500) h++;
    });
    return { e, h, n };
  };
  let sum = 0;
  let hollow = 0;
  let land = 0;
  for (let d = 0; d < days; d++) {
    s.step(12, quiet);
    const r = count();
    sum += r.e;
    hollow += r.h;
    land = r.n;
    s.step(12, quiet);
  }
  const row = { seed: Number(seedS), src: src!, engaged: Math.round((sum / days) * 100) / 100, hollow: Math.round((hollow / days) * 100) / 100, land };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
const mean = rows.reduce((t, r) => t + r.engaged, 0) / Math.max(1, rows.length);
writeFileSync(out, JSON.stringify({ days, mean, rows }, null, 1));
console.log(`done: mean ${mean.toFixed(3)} over ${rows.length} -> ${out}`);
