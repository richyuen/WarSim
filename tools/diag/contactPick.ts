/**
 * PLAN 7.5 (check:review before critic run 15): the scene of `fallen1938.spec.ts` picked again on a
 * new history. Germany declares war on Poland by God Mode; from day `from` to day `to`, each day's
 * Polish formations in contact at its end, with what each loses in the day after and the hours of
 * it in contact. The spec watches one of them for that day.
 *
 * Usage: npx tsx tools/diag/contactPick.ts [seed] [from] [to] [top]
 */
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const seed = Number(process.argv[2] ?? 4242);
const from = Number(process.argv[3] ?? 21);
const to = Number(process.argv[4] ?? 32);
const top = Number(process.argv[5] ?? 4);
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
  const watched = new Map<number, { strength: number; hours: number }>();
  w.formations.forEach((f) => {
    if (fc.engaged[f] === 1 && fc.nation[f] === POL) watched.set(f, { strength: fc.strength[f]!, hours: 0 });
  });
  for (let h = 0; h < 24; h++) {
    s.step(1, clear);
    for (const [f, r] of watched) if (w.formations.has(f) && fc.engaged[f] === 1) r.hours++;
  }
  const rows = [...watched].map(([f, r]) => ({ f, lost: r.strength - (w.formations.has(f) ? fc.strength[f]! : 0), hours: r.hours, alive: w.formations.has(f) }));
  rows.sort((a, b) => b.lost - a.lost);
  console.log(`day ${d}: ${rows.length} Polish in contact; ${rows.slice(0, top).map((r) => `${r.f} loses ${r.lost} in ${r.hours} h${r.alive ? '' : ' (gone)'}`).join(', ')}`);
}
console.log('done:');
