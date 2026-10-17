/**
 * PLAN 7.14 (critic run 7, diplomacy 6: "in the late game wars are few and endless"): for each war
 * of a run, its days with and without a land front (`warsWithFront`), its longest run of days with
 * none, whether it ended in such a run, how it ended; and each year's declarations and wars.
 *
 * Usage: npx tsx tools/diag/warFronts.ts <seed> [years = 50] [out = .cache/warFronts_<seed>.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { warsWithFront } from '../../src/sim/systems/warFront';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 50);
const out = process.argv[4] ?? `.cache/warFronts_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
type Row = { id: number; a: string; d: string; nA: number; nD: number; start: number; end: number | null; front: number; frontless: number; longest: number; run: number; endedFrontless: boolean; score: number; ftd: boolean; seenFront: boolean };
const wars = new Map<number, Row>();
const perYear: { year: number; declared: number; peaces: number; warsAtEnd: number; frontlessAtEnd: number; warDays: number; frontlessWarDays: number }[] = [];
let day = 0;
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  const yr = { year: y + 1, declared: 0, peaces: 0, warsAtEnd: 0, frontlessAtEnd: 0, warDays: 0, frontlessWarDays: 0 };
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.WarDeclared) yr.declared++;
        else if (ev[i + 1] === EventKind.PeaceSigned) yr.peaces++;
      }
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const fronts = warsWithFront(w);
    const live = new Set<number>();
    for (const war of w.wars.list) {
      live.add(war.id);
      let r = wars.get(war.id);
      if (!r) {
        r = { id: war.id, a: tag(war.sides[0][0]!), d: tag(war.sides[1][0]!), nA: war.sides[0].length, nD: war.sides[1].length, start: day, end: null, front: 0, frontless: 0, longest: 0, run: 0, endedFrontless: false, score: 0, ftd: false, seenFront: false };
        wars.set(war.id, r);
      }
      r.nA = Math.max(r.nA, war.sides[0].length);
      r.nD = Math.max(r.nD, war.sides[1].length);
      r.score = war.score;
      r.ftd = war.fightToDeath[0] || war.fightToDeath[1];
      yr.warDays++;
      if (fronts.has(war.id)) {
        r.front++;
        r.run = 0;
        r.seenFront = true;
      } else {
        r.frontless++;
        r.run++;
        r.longest = Math.max(r.longest, r.run);
        yr.frontlessWarDays++;
      }
    }
    for (const r of wars.values()) {
      if (r.end === null && !live.has(r.id)) {
        r.end = day;
        r.endedFrontless = r.run > 0;
      }
    }
  }
  yr.warsAtEnd = w.wars.list.length;
  yr.frontlessAtEnd = w.wars.list.filter((x) => !warsWithFront(w).has(x.id)).length;
  perYear.push(yr);
  process.stderr.write(`seed ${seed} year ${y + 1}: declared ${yr.declared}, wars ${yr.warsAtEnd} (${yr.frontlessAtEnd} frontless), ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
}
const rows = [...wars.values()];
const longest = rows.reduce((m, r) => Math.max(m, r.longest), 0);
mkdirSync('.cache', { recursive: true });
writeFileSync(out, JSON.stringify({ seed, years, longestFrontless: longest, wars: rows, perYear }, null, 1));
process.stderr.write(`done: seed ${seed}, ${rows.length} wars, longest frontless ${longest} days\n`);
