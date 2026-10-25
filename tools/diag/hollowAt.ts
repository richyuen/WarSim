/**
 * PLAN 7.116a's AT from `armyAtWarAt.ts` runs: for each seed, HEAD's run and the rule's (the
 * summary's engaged a war in years 2–N, `latePerWar`, and its `_y20.bin`), the land formations of
 * living nations on land under 500 men at year 20 and the engaged a war; then the sums and ratios.
 *
 * Usage: npx tsx tools/diag/hollowAt.ts <headDir/prefix> <ruleDir/prefix> <seed>...
 *   e.g. ../WarSim_chase/.cache/h116/head .cache/h116/rule 991 992
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [headP, ruleP, ...seeds] = process.argv.slice(2);
const assets = loadAssets1938(SIZE_1938.w);
const hollowOf = (bin: string): number => {
  const s = new Sim({ scenario: '1938', seed: 1, assets });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const c = w.formations.cols;
  let n = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
    if (c.strength[id]! < 500) n++;
  });
  return n;
};
type Sum = { latePerWar: number; lateEngaged: number; lateWars: number; year1PerWar: number };
const tot = { h: { hollow: 0, eng: 0, wars: 0 }, r: { hollow: 0, eng: 0, wars: 0 } };
for (const seed of seeds) {
  const hs = (JSON.parse(readFileSync(`${headP}_${seed}.json`, 'utf8')) as { summary: Sum }).summary;
  const rs = (JSON.parse(readFileSync(`${ruleP}_${seed}.json`, 'utf8')) as { summary: Sum }).summary;
  const hh = hollowOf(`${headP}_${seed}_y20.bin`);
  const rh = hollowOf(`${ruleP}_${seed}_y20.bin`);
  tot.h.hollow += hh;
  tot.r.hollow += rh;
  tot.h.eng += hs.lateEngaged;
  tot.r.eng += rs.lateEngaged;
  tot.h.wars += hs.lateWars;
  tot.r.wars += rs.lateWars;
  console.log(`${seed}: hollow y20 ${hh} -> ${rh}; engaged a war y2-20 ${hs.latePerWar.toFixed(3)} -> ${rs.latePerWar.toFixed(3)} (year 1 ${hs.year1PerWar.toFixed(3)} / ${rs.year1PerWar.toFixed(3)})`);
}
const he = tot.h.eng / tot.h.wars;
const re = tot.r.eng / tot.r.wars;
console.log(`all: hollow y20 ${tot.h.hollow} -> ${tot.r.hollow} (${(tot.r.hollow / tot.h.hollow).toFixed(3)} x, bar 0.5); engaged a war ${he.toFixed(3)} -> ${re.toFixed(3)} (${(re / he).toFixed(3)} x, bar 0.95)`);
