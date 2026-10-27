// Critic run 16: follow a fleet (an AI-built carrier group) from a save hour by hour: hours engaged, hours in a sea
// battle's record, carrier strikes drawn (carrierStrikes) by its wings, its nation's wars, where it is every 15 days.
// Usage: npx tsx critic/scripts/c16_cvfollow.ts <seed> <in.bin> <fleetId> <days>
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { carrierStrikes } from '../../src/sim/systems/navalCombat';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, inF, idS, daysS] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(inF!)));
const w = sim.world; const id = Number(idS); const c = w.formations.cols;
const n = c.nation[id]!;
const clear = () => { w.out.events.length = 0; w.out.fires.length = 0; };
let engagedH = 0, battleH = 0, strikeH = 0; const trail: unknown[] = []; let worldStrikeH = 0;
const wars = () => w.wars.list.filter((wr) => wr.sides.some((s) => s.includes(n))).length;
for (let d = 1; d <= Number(daysS) && w.formations.has(id); d++) {
  for (let h = 0; h < 24; h++) {
    sim.step(1, () => clear());
    if (!w.formations.has(id)) break;
    if (c.engaged[id]) engagedH++;
    if (w.seaBattles.some((r) => r.fleets.includes(id))) battleH++;
    const cs = carrierStrikes(w); if (cs.length) worldStrikeH++;
    if (cs.some((s) => w.wingBase.get(s.wing) === -id)) strikeH++;
  }
  if (d % 15 === 0) trail.push({ d, x: +c.x[id]!.toFixed(1), y: +c.y[id]!.toFixed(1), wars: wars() });
}
const res = { seed: Number(seedS), id, nation: n, alive: w.formations.has(id), engagedH, battleH, strikeH, worldStrikeH, trail };
console.log(JSON.stringify(res));
writeFileSync(`critic/c16_cvfollow_${seedS}_${id}.json`, JSON.stringify(res, null, 1));
