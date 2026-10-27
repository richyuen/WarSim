// Critic run 16: navy census of saves (carriers, wings aboard, ships by class, fleets in training by class).
// Usage: OUT=<json> npx tsx critic/scripts/c16_navy.ts <seed>:<save.bin> ...
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { loadAssets1938 } from '../../tools/headless/assets';
const assets = loadAssets1938(size1938(undefined).w);
const res: unknown[] = [];
for (const arg of process.argv.slice(2)) {
  const [seedS, file] = arg.split(':');
  const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets });
  sim.load(new Uint8Array(readFileSync(file!)));
  const w = sim.world;
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const fc = w.formations.cols;
  const idx = elementIndex(w);
  const ships: Record<string, number> = {};
  let fleets = 0, carriers = 0, carriersManned = 0;
  const aboard = new Map<number, number>();
  for (const [id, base] of w.wingBase) if (base < 0 && w.formations.has(id)) aboard.set(-base, (aboard.get(-base) ?? 0) + 1);
  const cvNations = new Map<number, number>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    let live = 0, cv = 0;
    for (const e of idx.get(id) ?? []) if (ec.strength[e]! > 0) { live++; const cls = units[ec.unit[e]!]!.cls; ships[cls] = (ships[cls] ?? 0) + 1; if (cls === 'cv') cv++; }
    if (live > 0) fleets++;
    carriers += cv;
    if (cv > 0) cvNations.set(fc.nation[id]!, (cvNations.get(fc.nation[id]!) ?? 0) + cv);
    if (cv > 0) carriersManned += Math.min(cv, aboard.get(id) ?? 0);
  });
  const training: Record<string, number> = {};
  const pc = w.production.cols;
  w.production.forEach((p) => {
    const t = w.rules!.templates[pc.template[p]!]!;
    if (t.domain !== 1) return;
    const cls = [...new Set((t as unknown as { elements: { unit: number }[] }).elements.map((e) => units[e.unit]!.cls))].sort().join('+');
    training[cls] = (training[cls] ?? 0) + 1;
  });
  const row = { seed: Number(seedS), file, tick: w.tick, fleets, ships, carriers, carriersManned, cvNations: cvNations.size, training };
  res.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(process.env.OUT ?? 'critic/c16_navy.json', JSON.stringify(res, null, 1));
