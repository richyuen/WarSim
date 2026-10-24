/**
 * PLAN 7.110's measure and AT, from 1938: the land army of nations at war, a war. Daily after each
 * day's 24 hours, as `contactAt.ts` (PLAN 7.104's) samples: the land formations of living nations
 * (not fleets or wings, not off land), those of nations at war (`wars.nations()`) and their men,
 * those engaged, the wars running, the nations at war and the sum of their monthly income. Per year,
 * means of the daily samples; `atWarPerWar` = land formations of nations at war over wars (the AT's
 * figure, years 2–N against HEAD's on the same seeds; a ratio of sums, not a mean of daily ratios)
 * and `perWar` = engaged over wars (the AT's second clause). And per year, from the events: land
 * formations raised (`FormationSpawned`), destroyed (every `FormationDestroyed`, the disbanded
 * among them), and disbanded (`FormationsDisbanded`), all and of nations at war (at war on the day
 * before).
 * Saves the state at year 10 and at the end beside the output (`<out>_y10.bin`, `<out>_yN.bin`).
 *
 * Usage: npx tsx tools/diag/armyAtWarAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/armyAtWarAt_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const landIds = new Set<number>();
const isLand = (id: number): boolean => w.formations.has(id) && !w.isFleet(id) && !w.isWing(id);
w.formations.forEach((id) => {
  if (isLand(id)) landIds.add(id);
});
let atWar = w.wars.nations();
const ev0 = { raised: 0, raisedW: 0, destroyed: 0, destroyedW: 0, disbanded: 0, disbandedW: 0 };
let ev = { ...ev0 };
const quiet = (ww: World): void => {
  const e = ww.out.events;
  for (let i = 0; i < e.length; i += 6) {
    const k = e[i + 1];
    const a = e[i + 2]!;
    const b = e[i + 3]!;
    if (k === EventKind.FormationSpawned && isLand(a)) {
      landIds.add(a);
      ev.raised++;
      if (atWar.has(b)) ev.raisedW++;
    } else if (k === EventKind.FormationDestroyed && landIds.has(a)) {
      landIds.delete(a);
      ev.destroyed++;
      if (atWar.has(b)) ev.destroyedW++;
    } else if (k === EventKind.FormationsDisbanded) {
      ev.disbanded += b;
      if (atWar.has(a)) ev.disbandedW += b;
    }
  }
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
type Row = { year: number; wars: number; nationsAtWar: number; land: number; atWar: number; menAtWar: number; engaged: number; incomeAtWar: number; atWarPerWar: number; perWar: number } & typeof ev0;
const rows: Row[] = [];
for (let y = 1; y <= years; y++) {
  let wars = 0;
  let nationsAtWar = 0;
  let land = 0;
  let fw = 0;
  let menW = 0;
  let engaged = 0;
  let incomeW = 0;
  for (let d = 0; d < 365; d++) {
    s.step(24, quiet);
    atWar = w.wars.nations();
    const c = w.formations.cols;
    const nat = w.nations.cols;
    wars += w.wars.list.length;
    for (const n of atWar) {
      if (nat.living[n] !== 1) continue;
      nationsAtWar++;
      incomeW += nat.income[n]!;
    }
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id)) return;
      landIds.add(id);
      const n = c.nation[id]!;
      if (w.offLand(id) || nat.living[n] !== 1) return;
      land++;
      if (!atWar.has(n)) return;
      fw++;
      menW += c.strength[id]!;
      if (c.engaged[id] === 1) engaged++;
    });
  }
  const r: Row = {
    year: y,
    wars: wars / 365,
    nationsAtWar: nationsAtWar / 365,
    land: land / 365,
    atWar: fw / 365,
    menAtWar: menW / 365,
    engaged: engaged / 365,
    incomeAtWar: incomeW / 365,
    atWarPerWar: wars > 0 ? fw / wars : 0,
    perWar: wars > 0 ? engaged / wars : 0,
    ...ev,
  };
  ev = { ...ev0 };
  rows.push(r);
  process.stderr.write(
    `${seed} year ${y}: wars ${r.wars.toFixed(2)} at war ${r.nationsAtWar.toFixed(1)} nations, land ${r.land.toFixed(0)}, at war ${r.atWar.toFixed(0)} (${(r.menAtWar / 1e6).toFixed(2)} M), per war ${r.atWarPerWar.toFixed(1)}, engaged per war ${r.perWar.toFixed(3)}; raised ${r.raised}/${r.raisedW} destroyed ${r.destroyed}/${r.destroyedW} disbanded ${r.disbanded}/${r.disbandedW}\n`,
  );
  if (y === 10 || y === years) writeFileSync(out.replace(/\.json$/, `_y${y}.bin`), s.save());
}
const late = rows.filter((r) => r.year >= 2);
const wr = late.reduce((a, r) => a + r.wars, 0);
const summary = {
  seed,
  years,
  year1AtWarPerWar: rows[0]!.atWarPerWar,
  lateAtWarPerWar: wr > 0 ? late.reduce((a, r) => a + r.atWar, 0) / wr : 0,
  year1PerWar: rows[0]!.perWar,
  latePerWar: wr > 0 ? late.reduce((a, r) => a + r.engaged, 0) / wr : 0,
  lateAtWar: late.reduce((a, r) => a + r.atWar, 0),
  lateEngaged: late.reduce((a, r) => a + r.engaged, 0),
  lateWars: wr,
};
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(
  `done: ${seed} land at war a war year 1 ${summary.year1AtWarPerWar.toFixed(1)}, years 2-${years} ${summary.lateAtWarPerWar.toFixed(1)}; engaged a war ${summary.year1PerWar.toFixed(3)} / ${summary.latePerWar.toFixed(3)}`,
);
