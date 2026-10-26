/**
 * PLAN 7.116b's measure: how the land formations of nations at war come into contact and out of it.
 * From a saved state (or from 1938 after `@days`), hour by hour for `days` days: per hour the land
 * formations (not fleets or wings, not aboard) of living nations at war, those engaged, those on the
 * retreat. Per formation its spells in contact (consecutive engaged hours), each ended by a retreat
 * (on the retreat the next hour), by its end (destroyed or aboard), or by the two parting (neither);
 * and the hours from a retreat's end to the next engaged hour (re-entry; censored at the window's
 * end, counted apart). Wars a day and `FormationRetreated` events a war-day.
 *
 * Usage: npx tsx tools/diag/contactSpells.ts <out.json> <days> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 30);
const rows: unknown[] = [];
const quant = (a: number[]): Record<string, number> => {
  if (a.length === 0) return { n: 0 };
  const s = [...a].sort((p, q) => p - q);
  const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { n: s.length, mean: Math.round((s.reduce((t, x) => t + x, 0) / s.length) * 10) / 10, p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) };
};
for (const a of process.argv.slice(4)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  let retreats = 0;
  const quiet = (ww: typeof w): void => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) if (e[i + 1] === EventKind.FormationRetreated) retreats++;
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src!.startsWith('1938@')) for (let d = Number(src!.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src!)));
  retreats = 0;
  const spell = new Map<number, number>();
  const retreatEnd = new Map<number, number>();
  const wasRetreat = new Set<number>();
  const ends = { retreat: 0, gone: 0, parted: 0 };
  const lengths: number[] = [];
  const reentry: number[] = [];
  let hours = 0;
  let engagedH = 0;
  let retreatH = 0;
  let landH = 0;
  let warHours = 0;
  for (let h = 0; h < days * 24; h++) {
    s.step(1, quiet);
    hours++;
    const c = w.formations.cols;
    const nat = w.nations.cols;
    const atWar = w.wars.nations();
    warHours += w.wars.list.length;
    const seen = new Set<number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = c.nation[id]!;
      if (nat.living[n] !== 1 || !atWar.has(n)) return;
      seen.add(id);
      landH++;
      const eng = c.engaged[id] === 1;
      const ret = c.retreat[id]! > 0;
      if (eng) engagedH++;
      if (ret) retreatH++;
      const run = spell.get(id);
      if (eng) spell.set(id, (run ?? 0) + 1);
      else if (run !== undefined) {
        lengths.push(run);
        spell.delete(id);
        if (ret) ends.retreat++;
        else ends.parted++;
      }
      if (wasRetreat.has(id) && !ret) retreatEnd.set(id, h);
      if (ret) wasRetreat.add(id);
      else wasRetreat.delete(id);
      const r = retreatEnd.get(id);
      if (r !== undefined && eng) {
        reentry.push(h - r);
        retreatEnd.delete(id);
      }
    });
    for (const [id, run] of spell)
      if (!seen.has(id)) {
        lengths.push(run);
        spell.delete(id);
        ends.gone++;
      }
  }
  const row = {
    seed: Number(seedS), src, day: Math.floor(w.tick / 24), days,
    warsADay: Math.round((warHours / hours) * 100) / 100,
    landAtWarAnHour: Math.round(landH / hours), engagedAnHour: Math.round((engagedH / hours) * 10) / 10, retreatAnHour: Math.round((retreatH / hours) * 10) / 10,
    retreatsAWarDay: Math.round((retreats / (warHours / 24)) * 100) / 100,
    spellHours: quant(lengths), spellEnds: ends,
    reentryHours: quant(reentry), retreatsNotReentered: retreatEnd.size,
  };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
