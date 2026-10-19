/**
 * PLAN 7.33: the history by type. From a checkpoint, for `days`, the rows the history log gains,
 * counted by kind, and a few rows of `kinds` in words (the en strings), to see what the late
 * history reads as.
 *
 * Usage: npx tsx tools/diag/historyKinds.ts <seed> <save.bin | new> [days = 1095] [out = .cache/historyKinds_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { kindName } from '../../src/shared/history';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const bin = process.argv[3]!;
const days = Number(process.argv[4] ?? 1095);
const out = process.argv[5] ?? `.cache/historyKinds_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const h = sim.world.history!;
const from = h.length;
const t0 = Date.now();
for (let d = 0; d < days; d++) {
  sim.step(24);
  if ((d + 1) % 365 === 0) process.stderr.write(`year ${(d + 1) / 365}: ${h.length - from} rows, ${Math.round((Date.now() - t0) / 1000)} s\n`);
}
const byKind: Record<string, number> = {};
const samples: Record<string, number[][]> = {};
for (let i = from; i < h.length; i++) {
  const r = h.rows.slice(i * HISTORY_STRIDE, (i + 1) * HISTORY_STRIDE);
  const k = kindName(r[1]!);
  byKind[k] = (byKind[k] ?? 0) + 1;
  const s = (samples[k] ??= []);
  if (s.length < 8) s.push(r);
}
const total = h.length - from;
const sorted = Object.fromEntries(Object.entries(byKind).sort((p, q) => q[1] - p[1]));
writeFileSync(out, JSON.stringify({ seed, bin, days, total, byKind: sorted, samples }, null, 1));
process.stderr.write(`done: ${total} rows; ${JSON.stringify(sorted)}\n`);
