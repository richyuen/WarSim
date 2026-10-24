/**
 * PLAN 7.110b's A/B from one saved state: from each save, `days` days, sampled daily as
 * `armyAtWarAt.ts` samples (land formations of living nations at war, not off land, over the wars
 * running; engaged over wars), summed over the days and the saves (ratios of sums). Run once on each
 * rule's code from the same saves.
 *
 * Usage: npx tsx tools/diag/armyAtWarAb.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const rows: { seed: number; bin: string; atWar: number; engaged: number; wars: number; men: number }[] = [];
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const r = { seed: Number(seedS), bin: bin!, atWar: 0, engaged: 0, wars: 0, men: 0 };
  for (let d = 0; d < days; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const atWar = w.wars.nations();
    const c = w.formations.cols;
    r.wars += w.wars.list.length;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1 || !atWar.has(c.nation[id]!)) return;
      r.atWar++;
      r.men += c.strength[id]!;
      if (c.engaged[id] === 1) r.engaged++;
    });
  }
  rows.push(r);
  process.stderr.write(`${seedS} ${bin}: at war a war ${(r.atWar / r.wars).toFixed(2)}, engaged a war ${(r.engaged / r.wars).toFixed(3)}, men at war ${(r.men / days / 1e6).toFixed(2)} M\n`);
}
const sum = (k: 'atWar' | 'engaged' | 'wars' | 'men'): number => rows.reduce((x, r) => x + r[k], 0);
const summary = { days, saves: rows.length, atWarPerWar: sum('atWar') / sum('wars'), engagedPerWar: sum('engaged') / sum('wars'), menAtWar: sum('men') / days / rows.length };
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(`done: at war a war ${summary.atWarPerWar.toFixed(2)}, engaged a war ${summary.engagedPerWar.toFixed(3)}, men at war ${(summary.menAtWar / 1e6).toFixed(2)} M a save`);
