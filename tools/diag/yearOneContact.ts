/**
 * PLAN 7.147's read: which of year 1's fights hold fewer land formations under ADR-737's strike
 * falloff. A fresh 1938 world of `seed` stepped `days` days; each day at hour 12, per nation at war:
 * its land formations engaged (`eng`), on land (`land`), men, those moving to enemy-held land
 * (`att`), and the day's strikes that hit its land formations (`hit`) and of those in contact
 * (`hitIn`). Summed over the run per nation, and per day the world's engaged.
 *
 * The arm: `FLAT=1` zeroes `formations.struck` after every tick, so each strike fires as the day's
 * first (`strikeShare(0)`, the rule before ADR-737) with no change to the sim; strikes that arrive in
 * the same hour still dim each other, so it is near the rule off, not it (the exact arm reads
 * `strikeShare` at 1; PLAN 7.147's read used a temporary switch there).
 *
 * Usage: npx tsx tools/diag/yearOneContact.ts <seed> <days> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const days = Number(process.argv[3] ?? 365);
const out = process.argv[4]!;
const flat = process.env.FLAT === '1';
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const c = w.formations.cols;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type Tally = { eng: number; land: number; men: number; att: number; hit: number; hitIn: number; atWarDays: number };
const byNation = new Map<number, Tally>();
const tally = (n: number): Tally => {
  let t = byNation.get(n);
  if (!t) byNation.set(n, (t = { eng: 0, land: 0, men: 0, att: 0, hit: 0, hitIn: 0, atWarDays: 0 }));
  return t;
};
const onTick = (ww: World): void => {
  if (flat) ww.formations.cols.struck.fill(0);
  const ev = ww.out.events;
  for (let i = 0; i < ev.length; i += 6) {
    if (ev[i + 1] !== EventKind.StrikeHit) continue;
    const g = ev[i + 2]!;
    if (!ww.formations.has(g) || ww.isFleet(g) || ww.isWing(g)) continue;
    const t = tally(ww.formations.cols.nation[g]!);
    t.hit++;
    if (ww.formations.cols.engaged[g] === 1) t.hitIn++;
  }
  ev.length = 0;
  ww.out.fires.length = 0;
};
const ctl = w.cells.controller;
const engagedDay: number[] = [];
for (let d = 0; d < days; d++) {
  s.step(12, onTick);
  const atWar = new Set(w.wars.nations());
  for (const n of atWar) tally(n).atWarDays++;
  let eng = 0;
  w.formations.forEach((id) => {
    const n = c.nation[id]!;
    if (w.nations.cols.living[n] !== 1 || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    if (c.engaged[id] === 1) eng++;
    if (!atWar.has(n)) return;
    const t = tally(n);
    t.land++;
    t.men += c.strength[id]!;
    if (c.engaged[id] === 1) t.eng++;
    if (c.moving[id] === 1 && w.wars.atWar(n, ctl[c.targetCell[id]!]!)) t.att++;
  });
  engagedDay.push(eng);
  s.step(12, onTick);
}
const nations = Object.fromEntries([...byNation].sort((a, b) => b[1].eng - a[1].eng).map(([n, t]) => [tag(n), t]));
writeFileSync(out, JSON.stringify({ seed, days, flat, engaged: engagedDay.reduce((a, b) => a + b, 0) / days, engagedDay, nations }));
process.stdout.write(`done: ${seed} flat=${flat} engaged ${(engagedDay.reduce((a, b) => a + b, 0) / days).toFixed(2)}\n`);
