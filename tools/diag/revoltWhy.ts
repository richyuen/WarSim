/**
 * PLAN 7.106's measure: under what each revolt that founds a nation rose, and whether that nation
 * lives. From a saved state: each nation founded by a revolt (`RevoltSpawned` on a nation not seen
 * living before), on its tick: its land of the holder's core or not (its people), the holder at
 * war with others, worn (`wornNations` at OVEREXT_EXHAUSTION), overextended (above OVEREXT_SHARE
 * of the owned land), bankrupt; and at the end whether it lives, free or a puppet.
 *
 * Usage: npx tsx tools/diag/revoltWhy.ts <seed> <in.bin> <days> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';
import { OVEREXT_EXHAUSTION, OVEREXT_SHARE } from '../../src/sim/systems/revolts';
import { wornNations } from '../../src/sim/systems/war';

const [seedS, bin, daysS, out] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const rows: Record<string, number | boolean | string>[] = [];
const seen = new Set<number>();
w.nations.forEach((n) => {
  if (w.nations.cols.living[n] === 1) seen.add(n);
});
for (let t = 0; t < Number(daysS) * 24; t++) {
  const born: [number, number][] = [];
  s.step(1, (ww) => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) if (e[i + 1] === EventKind.RevoltSpawned && !seen.has(e[i + 2]!)) born.push([e[i + 2]!, e[i + 3]!]);
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  if (born.length === 0) {
    if (t % 24 === 0) {
      seen.clear();
      w.nations.forEach((n) => {
        if (w.nations.cols.living[n] === 1) seen.add(n);
      });
    }
    continue;
  }
  const nc = w.nations.cols;
  const km2 = w.landCounts().owned;
  let owned = 0;
  w.nations.forEach((n) => {
    if (nc.living[n] === 1) owned += km2[n]!;
  });
  const worn = wornNations(w, OVEREXT_EXHAUSTION);
  for (const [id, holder] of born) {
    seen.add(id);
    const otherWars = w.wars.list.filter((war) => (war.sides[0].includes(holder) || war.sides[1].includes(holder)) && !war.sides[0].includes(id) && !war.sides[1].includes(id)).length;
    rows.push({ id, holder, day: Math.floor(w.tick / 24), cells: nc.cells[id]!, nonCore: nc.people[id] !== holder, holderOtherWars: otherWars, holderWorn: worn.has(holder), holderOverext: owned > 0 && km2[holder]! / owned > OVEREXT_SHARE, holderBankrupt: nc.bankrupt[holder] === 1, holderShare: owned > 0 ? km2[holder]! / owned : 0, ...peopleOf(nc.people[id]!), holderNear: nearest(holder, nc.capitalX[id]!, nc.capitalY[id]!) });
  }
}
const nc = w.nations.cols;
for (const r of rows) {
  const id = r.id as number;
  r.end = nc.living[id] !== 1 || nc.origin[id] === 0 ? 'gone' : nc.overlord[id] !== 0 ? 'puppet' : 'free';
}
writeFileSync(out!, JSON.stringify(rows, null, 1));

/** The area's people (its core nation before the revolt): living, its revivals left, whether founded in play. */
function peopleOf(p: number): Record<string, number | boolean> {
  const c = w.nations.cols;
  const has = p !== 0 && w.nations.has(p);
  return { people: p, peopleAlive: has && c.living[p] === 1, peopleRevivals: has ? c.revivalsLeft[p]! : -1, peopleRevivalAt: has ? Math.round((c.revivalAt[p]! - w.tick) / 24) : 0, peopleFounded: has && c.origin[p] !== 0 };
}

/** Cells from (x, y) to the holder's nearest land formation. */
function nearest(n: number, x: number, y: number): number {
  const fc = w.formations.cols;
  let best = Infinity;
  w.formations.forEach((f) => {
    if (fc.nation[f] !== n || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return;
    best = Math.min(best, Math.hypot(fc.x[f]! - x, fc.y[f]! - y));
  });
  return Math.round(best);
}
console.log(`done: ${seedS} ${rows.length} revolts founded a nation`);
