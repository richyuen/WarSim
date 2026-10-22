/**
 * PLAN 7.88b: a nation's land formations daily from a saved state: those aboard, the counts standing
 * (not aboard) on the given pile cells, and the cells those that started a march or went aboard that day
 * left (the six with most). Read only.
 *
 * Usage: npx tsx tools/diag/pileDaily.ts <seed> <state.bin> <days> <pile cell> [...] (the USA's)
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, daysS, ...pileS] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const n = TAGS_1938.indexOf('USA') + 1;
const W = w.cells.w;
const c = w.formations.cols;
const piles = pileS.map(Number);
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const snap = (): Map<number, { cell: number; moving: number; aboard: boolean }> => {
  const m = new Map<number, { cell: number; moving: number; aboard: boolean }>();
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id)) return;
    m.set(id, { cell: Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!), moving: c.moving[id]!, aboard: w.embarked.has(id) });
  });
  return m;
};
let before = snap();
for (let d = 0; d < Number(daysS); d++) {
  s.step(24, quiet);
  const now = snap();
  const left = new Map<number, number>();
  let aboardNow = 0;
  for (const [id, b] of before) {
    const a = now.get(id);
    if (a?.aboard) aboardNow++;
    if (!a || (b.moving === 0 && !b.aboard && (a.moving === 1 || a.aboard))) left.set(b.cell, (left.get(b.cell) ?? 0) + 1);
  }
  const counts = piles.map((p) => [...now.values()].filter((x) => x.cell === p && !x.aboard).length);
  const top = [...left].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}(${k % W},${Math.floor(k / W)})x${v}`);
  console.log(`day ${w.tick / 24} aboard ${aboardNow} piles ${counts.join('/')} started from: ${top.join(' ')}`);
  before = now;
}
