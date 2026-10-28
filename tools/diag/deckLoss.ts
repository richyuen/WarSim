/**
 * PLAN 7.151's read: how carriers' decks empty. From a save (`LOAD`) or 1938, for `years` years, each hour the wings
 * based on a carrier (`wingBase` < 0) are compared with the hour before. A deck wing gone is counted by cause:
 * - `fleetGone`: its fleet is gone (sunk whole);
 * - `carrierSunk`: its fleet afloat, the wings left aboard as many as its carriers afloat (none free);
 * - `inAir`: its fleet afloat with its carriers (shot down, or worn out by losses).
 * And `added`: deck wings that appeared (a fleet delivered with its carriers' wings, or a deck re-manned). At each
 * year's end: carriers afloat and those with a wing aboard.
 *
 * Usage: npx tsx tools/diag/deckLoss.ts <seed> [years = 10] [out = .cache/deckLoss_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { liveCarriers } from '../../src/sim/systems/air';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? `.cache/deckLoss_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
if (process.env.LOAD) sim.load(new Uint8Array(readFileSync(process.env.LOAD)));
const rows: Record<string, number>[] = [];
/** Deck wing → its fleet, as of the hour before. */
let decks = new Map<number, number>();
for (let year = 1; year <= years; year++) {
  const y = { year, fleetGone: 0, carrierSunk: 0, inAir: 0, added: 0, carriers: 0, manned: 0 };
  sim.step(24 * 365, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    const now = new Map<number, number>();
    for (const [id, b] of w.wingBase) if (b < 0 && w.formations.has(id)) now.set(id, -b);
    for (const [id, fl] of decks) {
      if (now.has(id)) continue;
      if (!w.formations.has(fl)) y.fleetGone++;
      // Its carrier sunk: the wings left aboard fill the carriers afloat (the wing goes an hour after its carrier).
      else if ([...now.values()].filter((v) => v === fl).length >= liveCarriers(w, fl)) y.carrierSunk++;
      else y.inAir++;
    }
    for (const id of now.keys()) if (!decks.has(id)) y.added++;
    decks = now;
  });
  const w = sim.world;
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const k = liveCarriers(w, id);
    if (k === 0) return;
    y.carriers += k;
    let aboard = 0;
    for (const [, b] of w.wingBase) if (b === -id) aboard++;
    y.manned += Math.min(k, aboard);
  });
  rows.push(y);
  process.stderr.write(`${JSON.stringify(y)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, load: process.env.LOAD ?? null, rows }, null, 1));
console.log(`done: ${out}`);
