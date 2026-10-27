/**
 * PLAN 7.141's read: why the AI's carriers wait in port. From a checkpoint, for `days` days:
 * - daily at 01:00 (an hour after the naval AI), every fleet with a carrier afloat (`liveCarriers`) of
 *   a nation at war: under way, in a sea battle, or what the naval AI's `plan` does with it
 *   (`sortieWhy`, `tools/diag/seaWhy.ts`), with the reason's text for the first sample of each bucket;
 *   and the same for the nation's other armed fleets (power over 0, no carrier), to compare;
 * - hourly, the hours with a carrier strike in the air (`carrierStrikes`), and the carrier fleets in a sea battle.
 * Counts are fleet-days.
 *
 * Usage: npx tsx tools/diag/carrierWhy.ts <seed> <state.bin> [days = 120] [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { liveCarriers } from '../../src/sim/systems/air';
import { carrierStrikes } from '../../src/sim/systems/navalCombat';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { farBase, preyWhy, sortieWhy, whyCtx } from './seaWhy';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 120);
const out = process.argv[5];
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
sim.load(new Uint8Array(readFileSync(src)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const cv: Record<string, number> = {};
const other: Record<string, number> = {};
const texts: Record<string, string[]> = {};
const who: Record<string, number> = {};
/** Carrier fleet-days on station (`awayStation`), by why the nearest armed enemy fleet is not hunted (`preyWhy`). */
const prey: Record<string, number> = {};
let strikeH = 0;
let cvBattleH = 0;
let cvDays = 0;
sim.step(24 * days, (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
  const c = w.formations.cols;
  if (w.seaBattles.length > 0) {
    if (carrierStrikes(w).length > 0) strikeH++;
    if (w.seaBattles.some((r) => r.fleets.some((f) => liveCarriers(w, f) > 0))) cvBattleH++;
  }
  if (w.tick % 24 !== 1) return;
  const atWar = w.wars.nations();
  const ctx = whyCtx(w);
  w.formations.forEach((f) => {
    if (!w.isFleet(f) || !atWar.has(c.nation[f]!) || fleetPower(w, f) <= 0) return;
    const isCv = liveCarriers(w, f) > 0;
    let b: string;
    let text = '';
    if (c.engaged[f] === 1) b = 'engaged';
    else if (c.moving[f] === 1) b = 'moving';
    else {
      const r = sortieWhy(ctx, f);
      [b, text] = [r.why, r.text];
      if (isCv && b === 'awayStation') {
        const p = preyWhy(ctx, f);
        prey[p] = (prey[p] ?? 0) + 1;
        if (p === 'far') {
          const k = `far:${farBase(ctx, f)}`;
          prey[k] = (prey[k] ?? 0) + 1;
        }
      }
    }
    const into = isCv ? cv : other;
    into[b] = (into[b] ?? 0) + 1;
    if (isCv) {
      cvDays++;
      who[tag(c.nation[f]!)] = (who[tag(c.nation[f]!)] ?? 0) + 1;
      const l = (texts[b] ??= []);
      if (text && l.length < 6) l.push(`d${Math.floor(w.tick / 24)} ${tag(c.nation[f]!)} f${f}: ${text}`);
    }
  });
});
const res = { seed, src, days, cvDays, cv, other, who, prey, strikeH, cvBattleH, texts };
console.log(JSON.stringify(res, null, 1));
if (out) writeFileSync(out, JSON.stringify(res, null, 1));
console.log('done:');
