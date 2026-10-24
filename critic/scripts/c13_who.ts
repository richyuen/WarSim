// Critic run 13: who a founded nation is in a save: its name, origin, land, capital, warheads.
// Usage: npx tsx critic/scripts/c13_who.ts <seed> <bin> <id>...
import { readFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, bin, ...ids] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(bin!)));
const w = sim.world as any;
for (const s of ids) {
  const id = Number(s);
  let land = 0; const C = w.cells.controller; for (let i = 0; i < C.length; i++) if (C[i] === id) land++;
  const cols = w.nations.cols; const row: Record<string, unknown> = { id, land, name: w.names?.get?.(id) ?? null, warheads: w.warheads.get(id) ?? null };
  for (const k of Object.keys(cols)) { const v = cols[k][id]; if (typeof v === 'number') row[k] = v; }
  console.log(JSON.stringify(row));
}
