// Critic run 14: armed fleets (fleetPower > 0) and nations with one, at 1938 and in each year-10/20 save.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { loadAssets1938 } from '../../tools/headless/assets';
const seeds = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437];
const assets = loadAssets1938(size1938(undefined).w);
const out: unknown[] = [];
for (const seed of seeds) {
  const row: Record<string, unknown> = { seed };
  for (const y of [0, 10, 20]) {
    const sim = new Sim({ scenario: '1938', seed, assets });
    if (y) { const f = `critic/c14_seed${seed}_y${y}.bin`; if (!existsSync(f)) continue; sim.load(new Uint8Array(readFileSync(f))); }
    const w = sim.world;
    let fleets = 0; const navies = new Set<number>();
    w.formations.forEach((id) => { if (w.isFleet(id) && fleetPower(w, id) > 0) { fleets++; navies.add(w.formations.cols.nation[id]!); } });
    let navalWars = 0;
    for (const war of w.wars.list) { const a = war.sides[0]!.some((n) => navies.has(n)); const b = war.sides[1]!.some((n) => navies.has(n)); if (a && b) navalWars++; }
    row[`y${y}`] = { fleets, navies: navies.size, wars: w.wars.list.length, navalWars };
  }
  out.push(row); console.log(JSON.stringify(row));
}
writeFileSync('critic/c14_fleets.json', JSON.stringify(out, null, 1));
