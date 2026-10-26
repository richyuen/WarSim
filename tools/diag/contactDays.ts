/**
 * PLAN 7.5 (check:review before critic run 15): the critic's game of the T3 fight specs (seed 4242,
 * Germany declares war on Poland by God Mode), read day by day: the German and Polish land formations
 * in contact (a fleet in a sea battle is in contact too, ADR-712), those of armour among them, and whether chosen formations are in contact. Tells a
 * history re-pick (the event a few days later) from a lost one (never).
 *
 * Usage: npx tsx tools/diag/contactDays.ts [seed] [days] [ids,comma,separated]
 */
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { symbolOf } from '../../src/shared/unitLooks';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const seed = Number(process.argv[2] ?? 4242);
const days = Number(process.argv[3] ?? 40);
const ids = (process.argv[4] ?? '558').split(',').map(Number);
const GER = nationId('GER');
const POL = nationId('POL');
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
for (let d = 1; d <= days; d++) {
  s.step(24, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  const w = s.world;
  const fc = w.formations.cols;
  let ger = 0;
  let pol = 0;
  let armour = 0;
  w.formations.forEach((f) => {
    if (fc.engaged[f] !== 1) return;
    const n = fc.nation[f];
    if ((n !== GER && n !== POL) || w.isFleet(f) || w.isWing(f)) return;
    if (n === GER) ger++;
    else pol++;
    const t = TEMPLATES_1938[fc.template[f]!];
    if (t !== undefined && symbolOf(t) === 'armour') armour++;
  });
  const chosen = ids.map((id) => `${id}:${w.formations.has(id) ? fc.engaged[id] : 'gone'}`).join(' ');
  console.log(`day ${d}: GER ${ger} POL ${pol} total ${ger + pol} armour ${armour} | ${chosen}`);
}
console.log('done:');
