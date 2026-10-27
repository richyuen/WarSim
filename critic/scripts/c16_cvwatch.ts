// Critic run 16: from a save, step day by day until a carrier group is delivered (a fleet with a carrier element not
// in the save); report its day, nation, wings aboard, and then follow it 120 days: where it is, its wings' missions
// and sorties, sea battles it is in. Saves the world on its delivery day.
// Usage: npx tsx critic/scripts/c16_cvwatch.ts <seed> <in.bin> <maxDays> <out.bin>
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, inF, maxS, outF] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(inF!)));
const w = sim.world;
const cvFleets = (): Map<number, number> => {
  const idx = elementIndex(w); const ec = w.elements.cols; const units = w.rules!.units; const m = new Map<number, number>();
  w.formations.forEach((id) => { if (!w.isFleet(id)) return; let k = 0; for (const e of idx.get(id) ?? []) if (ec.strength[e]! > 0 && units[ec.unit[e]!]!.cls === 'cv') k++; if (k) m.set(id, k); });
  return m;
};
const before = cvFleets();
const res: Record<string, unknown> = { seed: Number(seedS), start: w.tick, before: [...before] };
const clear = () => { w.out.events.length = 0; w.out.fires.length = 0; };
let found = 0;
for (let d = 1; d <= Number(maxS) && !found; d++) {
  sim.step(24, () => clear());
  for (const [id, k] of cvFleets()) if (!before.has(id)) { found = id; res.delivered = { day: d, tick: w.tick, id, carriers: k, nation: w.formations.cols.nation[id], x: w.formations.cols.x[id], y: w.formations.cols.y[id] }; break; }
}
if (found) {
  writeFileSync(outF!, sim.save());
  const aboard = () => [...w.wingBase].filter(([o, b]) => b === -found && w.formations.has(o)).map(([o]) => o);
  const trail: unknown[] = [];
  let sortieHours = 0, missionDays = 0;
  for (let d = 1; d <= 120 && w.formations.has(found); d++) {
    for (let h = 0; h < 24; h++) { sim.step(1, () => clear()); for (const o of aboard()) if (w.sorties.has(o)) sortieHours++; }
    const ab = aboard(); for (const o of ab) if (w.wingMission.has(o)) missionDays++;
    if (d % 10 === 0) trail.push({ d, x: +w.formations.cols.x[found]!.toFixed(1), y: +w.formations.cols.y[found]!.toFixed(1), aboard: ab.length, missions: ab.map((o) => w.wingMission.get(o)?.kind ?? null), engaged: w.formations.cols.engaged[found] });
  }
  res.follow = { alive: w.formations.has(found), sortieHours, missionDays, trail };
}
console.log(JSON.stringify(res));
writeFileSync(`critic/c16_cvwatch_${seedS}.json`, JSON.stringify(res, null, 1));
