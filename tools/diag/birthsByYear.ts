/**
 * PLAN 7.173: what adds the living nations late in the game. From a new 1938 world (or a save),
 * for `years`, each year's living count, the nations that came alive and died that year, and the
 * history rows of that year by kind (the en names), to see which mechanism the births come from.
 *
 * Usage: npx tsx tools/diag/birthsByYear.ts <seed> <years> [out = .cache/birthsByYear_<seed>.json] [save.bin]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { kindName } from '../../src/shared/history';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 50);
const out = process.argv[4] ?? `.cache/birthsByYear_${seed}.json`;
const bin = process.argv[5];
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
if (bin) sim.load(new Uint8Array(readFileSync(bin)));
const w = sim.world;
const h = w.history!;
const nc = () => w.nations.cols;
const livingSet = (): Set<number> => {
  const s = new Set<number>();
  w.nations.forEach((n) => {
    if (nc().living[n] === 1) s.add(n);
  });
  return s;
};
let prev = livingSet();
let from = h.length;
const rows: { year: number; living: number; born: number; died: number; kinds: Record<string, number> }[] = [];
const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  sim.step(365 * 24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const now = livingSet();
  let born = 0;
  let died = 0;
  for (const n of now) if (!prev.has(n)) born++;
  for (const n of prev) if (!now.has(n)) died++;
  const kinds: Record<string, number> = {};
  for (let i = from; i < h.length; i++) {
    const k = kindName(h.rows[i * HISTORY_STRIDE + 1]!);
    kinds[k] = (kinds[k] ?? 0) + 1;
  }
  from = h.length;
  prev = now;
  rows.push({ year: y, living: now.size, born, died, kinds });
  process.stderr.write(`year ${y}: living ${now.size} born ${born} died ${died} ${Math.round((Date.now() - t0) / 1000)} s\n`);
  writeFileSync(out, JSON.stringify({ seed, years: y, rows }, null, 1));
}
process.stderr.write(`done: ${seed}\n`);
