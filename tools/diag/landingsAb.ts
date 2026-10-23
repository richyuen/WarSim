/**
 * PLAN 7.90g: every nation's embarkations and landings over `days` days from a saved state, read
 * only, for an A/B of a rule of the transports (run once on each rule, from the same save). Hourly:
 * each formation that went aboard (`FormationEmbarked`) and its group, so a trip is a group and the
 * hour it took men on; each that landed (`FormationLanded`) and its men.
 *
 * Usage: npx tsx tools/diag/landingsAb.ts <days> <seed> <state.bin>
 */
import { readFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [daysS, seedS, bin] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const c = w.formations.cols;
const trips = new Map<string, { nation: number; count: number }>();
let embarked = 0;
let landed = 0;
let landedMen = 0;
const byNation = new Map<number, { landed: number; men: number }>();
s.step(Number(daysS) * 24, (ww) => {
  const e = ww.out.events;
  for (let i = 0; i < e.length; i += 6) {
    const kind = e[i + 1];
    const id = e[i + 2]!;
    if (kind === EventKind.FormationEmbarked) {
      embarked++;
      const fleet = ww.embarked.get(id)?.fleet ?? 0;
      const key = `${fleet}@${e[i]}`;
      const t = trips.get(key) ?? { nation: e[i + 3]!, count: 0 };
      t.count++;
      trips.set(key, t);
    } else if (kind === EventKind.FormationLanded) {
      landed++;
      const men = c.strength[id] ?? 0;
      landedMen += men;
      const b = byNation.get(e[i + 3]!) ?? { landed: 0, men: 0 };
      b.landed++;
      b.men += men;
      byNation.set(e[i + 3]!, b);
    }
  }
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
});
const ts = [...trips.values()];
const ones = ts.filter((t) => t.count === 1).length;
console.log(JSON.stringify({ seed: Number(seedS), embarked, trips: ts.length, tripsOfOne: ones, perTrip: Number((embarked / Math.max(1, ts.length)).toFixed(2)), landed, landedMen }));
console.log([...byNation].sort((a, b) => b[1].men - a[1].men).slice(0, 10).map(([n, b]) => `${TAGS_1938[n - 1] ?? n} ${b.landed}/${b.men}`).join(' '));
