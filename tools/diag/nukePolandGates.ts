/**
 * `nukePoland1938.test.ts`'s set-up (a strategic bomber group at Warsaw, 10 warheads, Germany's war on
 * Poland), read only: each day, Poland's desperation and extreme flag in that war, its men on land
 * against Germany's side's, the places it weighs and the best utility, and whether it can deliver.
 * Found at PLAN 7.116a (ADR-701 a): seeds 7127 and 3929 decided no strike with the fold.
 *
 * With `summary`, one line: Poland's first decision day, its first burst (day, on, men), the last day it
 * could deliver, and the chance through (`through`) of the best place in reach on the day before the decision.
 *
 * Usage: npx tsx tools/diag/nukePolandGates.ts <seed> [days = 120] [summary]
 */
import { EventKind } from '../../src/shared/events';
import { nukeStrike, nukeToll } from '../../src/shared/history';
import { BUILD_MIX_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { canDeliver, dayIndustry, desperationOf, nuclearUtility, reaches, weighWar } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const [POL, GER] = ['POL', 'GER'].map(nationId) as [number, number];
const seed = Number(process.argv[2]);
const days = Number(process.argv[3] ?? 120);
const summary = process.argv[4] === 'summary';
let decided = -1;
let burst = '';
let deliverUntil = -1;
let lastThrough = NaN;
let throughAtDecision = NaN;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === POL)!;
const [x, y] = w.cellPoint(warsaw.cell);
s.command({ kind: 'spawnWing', nation: POL, x, y, template: BUILD_MIX_1938.wings.strategic });
s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
s.step(1);
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 2] !== POL) continue;
      if (ev[i + 1] === EventKind.NukeDecided && decided < 0) {
        decided = d;
        throughAtDecision = lastThrough;
      }
      if (ev[i + 1] === EventKind.NukeCasualties && !burst) burst = `day ${d} on ${nukeStrike(ev[i + 3]!).nation}`;
      if (ev[i + 1] === EventKind.NukeToll && burst && !burst.includes('men')) burst += ` ${nukeToll(ev[i + 3]!).men} men`;
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const war = w.wars.list.find((x) => x.sides[1].includes(POL) && x.sides[0].includes(GER));
  if (!war) {
    if (!summary) console.log(`day ${d}: no war`);
    break;
  }
  const { desperation, extreme } = desperationOf(w, POL, war, 1);
  const r = weighWar(w, POL, war, 1, dayIndustry(w));
  let best = -Infinity;
  let bestReach = -Infinity;
  for (const p of r.places) {
    if (!r.shared) break;
    const u = nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared });
    if (u > best) best = u;
    if (reaches(w, POL, p.x, p.y) && u > bestReach) {
      bestReach = u;
      lastThrough = p.through;
    }
  }
  let pol = 0;
  let pf = 0;
  w.formations.forEach((id) => {
    if (w.offLand(id) || w.formations.cols.nation[id] !== POL) return;
    pol += w.formations.cols.strength[id]!;
    pf++;
  });
  if (canDeliver(w, POL)) deliverUntil = d;
  if (!summary && (d % 5 === 0 || d > 30))
    console.log(`day ${d}: desp ${desperation.toFixed(2)} extreme ${extreme} POL ${pf} formations ${pol} men; places ${r.places.length} best u ${best.toFixed(3)} in reach ${bestReach.toFixed(3)}; deliver ${canDeliver(w, POL)}`);
  if (!canDeliver(w, POL)) break;
}
if (summary) console.log(`seed ${seed}: decided day ${decided}, burst ${burst || 'none'}, could deliver to day ${deliverUntil}, through at the decision ${throughAtDecision.toFixed(3)}`);
