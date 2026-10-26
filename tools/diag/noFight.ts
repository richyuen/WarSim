/**
 * PLAN 7.5 (check:review before critic run 15): formations in contact with no enemy for their
 * panel's fight (`enemyOf` in worker/server.ts gives 0). Germany declares war on Poland by God
 * Mode; from day `from` to `to`, at each day's end, the formations of the two in contact whose
 * paired enemy (`contactsOf`) is missing or gone, with the nearest live enemy on land and its distance.
 *
 * Usage: npx tsx tools/diag/noFight.ts [seed] [from] [to]
 */
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CONTACT_CELLS, cellDist, contactsOf } from '../../src/sim/systems/elements';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const seed = Number(process.argv[2] ?? 5381);
const from = Number(process.argv[3] ?? 21);
const to = Number(process.argv[4] ?? 23);
const GER = nationId('GER');
const POL = nationId('POL');
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
const clear = (w: typeof s.world): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};
s.step(24 * from, clear);
for (let d = from; d <= to; d++) {
  const w = s.world;
  const fc = w.formations.cols;
  const contacts = contactsOf(w);
  const reach = w.atSize(CONTACT_CELLS);
  let n = 0;
  w.formations.forEach((f) => {
    if (fc.engaged[f] !== 1 || (fc.nation[f] !== GER && fc.nation[f] !== POL)) return;
    n++;
    const held = contacts.get(f);
    if (held !== undefined && w.formations.has(held)) return;
    let best = 0;
    let bestD = Infinity;
    w.formations.forEach((o) => {
      if (o === f || w.offLand(o) || w.isWing(o) || w.isFleet(o) || !w.wars.atWar(fc.nation[f]!, fc.nation[o]!)) return;
      const dd = cellDist(w, fc.x[f]!, fc.y[f]!, fc.x[o]!, fc.y[o]!);
      if (dd < bestD) {
        best = o;
        bestD = dd;
      }
    });
    console.log(`day ${d}: ${f} (nation ${fc.nation[f]}, strength ${fc.strength[f]}) held ${held ?? 'none'}${held !== undefined ? (w.formations.has(held) ? '' : ' (gone)') : ''}; nearest enemy ${best} at ${bestD.toFixed(2)} cells (reach ${reach.toFixed(2)})`);
  });
  console.log(`day ${d}: ${n} in contact`);
  s.step(24, clear);
}
console.log('done:');
