/**
 * PLAN 7.108b's A/B from one save: steps a checkpoint `days` days and counts the air battles
 * (`EventKind.AirBattle`), the sortie-hours aloft and battles per thousand of them, and the land
 * formations engaged a day, the wings of living nations before and after, wings built, and the land formations (and men) of
 * nations at war a day. Run once per rule on
 * the same save.
 *
 * Usage: npx tsx tools/diag/airAb.ts <save.bin> [days = 90] [out = .cache/airAb.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';

const save = process.argv[2]!;
const days = Number(process.argv[3] ?? 90);
const out = process.argv[4] ?? '.cache/airAb.json';
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(save)));
const w = s.world;
const wingCount = (): number => {
  let n = 0;
  w.formations.forEach((id) => {
    if (w.isWing(id) && w.nations.cols.living[w.formations.cols.nation[id]!] === 1) n++;
  });
  return n;
};
const wingsBefore = wingCount();
let battles = 0;
let built = 0;
let landAtWar = 0;
let menAtWar = 0;
let aloft = 0;
let engaged = 0;
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.AirBattle) battles++;
      if (ev[i + 1] === EventKind.FormationSpawned && ww.formations.has(ev[i + 2]!) && ww.isWing(ev[i + 2]!)) built++;
    }
    ev.length = 0;
    ww.out.fires.length = 0;
    aloft += ww.sorties.size;
  });
  const c = w.formations.cols;
  const atWar = w.wars.nations();
  w.formations.forEach((id) => {
    if (w.nations.cols.living[c.nation[id]!] !== 1 || w.isWing(id) || w.isFleet(id) || w.offLand(id)) return;
    if (c.engaged[id] === 1) engaged++;
    if (atWar.has(c.nation[id]!)) {
      landAtWar++;
      menAtWar += c.strength[id]!;
    }
  });
}
const r = { save, days, battles, aloftHours: aloft, perK: +((1000 * battles) / Math.max(1, aloft)).toFixed(2), engagedDay: +(engaged / days).toFixed(2), wingsBefore, wingsAfter: wingCount(), built, landAtWarDay: +(landAtWar / days).toFixed(1), menAtWarDay: Math.round(menAtWar / days) };
writeFileSync(out, JSON.stringify(r, null, 1));
console.log(`done: ${JSON.stringify(r)}`);
