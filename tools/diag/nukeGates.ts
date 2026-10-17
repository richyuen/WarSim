/**
 * PLAN 7.6 (critic R7-B1): which gate of the AI's nuclear decision stops each nuclear power's
 * war-day. For each nation that weighs strikes (`weighsStrikes`), each day, each war it weighs:
 * noAim (no enemy that can threaten it), noPlace (no fair place), low (the best place's utility
 * at most 0 with no MAD cap), mad (positive but for the MAD cap), noReach (positive but out of
 * reach of its missiles and bombers), strike (positive and in reach); split by losing
 * (desperation at least 0.5) and extreme. The day is weighed after its decisions (at 00:00): the
 * decisions themselves are counted from `NukeDecided`.
 *
 * Usage: npx tsx tools/diag/nukeGates.ts <seed> [years = 30] [out = .cache/nukeGates_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { reaches, avengingOf, dayIndustry, desperationOf, nuclearUtility, RETALIATION_WEIGHT, TABOO_WEIGHT, EXTREME_TABOO, warheadsOf, weighsStrikes, weighsWar, weighWar } from '../../src/sim/systems/nuclear';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
type Cat = 'noAim' | 'noPlace' | 'mad' | 'low' | 'strike' | 'noReach';
const counts: Record<'all' | 'losing' | 'extreme', Record<Cat, number>> = { all: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, losing: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, extreme: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 } };
const lowParts = { n: 0, gain: 0, retal: 0, alliance: 0, outrage: 0, taboo: 0, tv: 0, desp: 0, doctrine: 0 };
const byNation = new Map<number, Record<Cat, number> & { losingDays: number; warheads: number }>();
const decisions: { day: number; n: number | string; x: number; y: number; u: number }[] = [];
const examples: unknown[] = [];
let day = 0;
for (let y = 0; y < years; y++) {
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) decisions.push({ day, n: tag(ev[i + 2]!), u: ev[i + 3]! / 1000, x: ev[i + 4]!, y: ev[i + 5]! });
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    if (w.warheads.size === 0) continue;
    const industry = dayIndustry(w);
    for (const n of [...w.warheads.keys()].sort((a, b) => a - b)) {
      if (!weighsStrikes(w, n)) continue;
      const avenging = avengingOf(w, n);
      for (const war of w.wars.list) {
        const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
        if (!weighsWar(w, n, war, side, avenging)) continue;
        const { desperation, extreme } = desperationOf(w, n, war, side);
        const r = weighWar(w, n, war, side, industry);
        let cat: Cat;
        let best: { u: number; raw: number; value: number } | null = null;
        if (!r.shared) cat = 'noAim';
        else if (r.places.length === 0) cat = 'noPlace';
        else {
          let anyReach = false;
          for (const p of r.places) {
            const u = nuclearUtility({ targetValue: p.value, ...r.shared });
            if (u > 0 && reaches(w, n, p.x, p.y)) anyReach = true;
            const raw = nuclearUtility({ targetValue: p.value, ...r.shared, mad: false });
            if (!best || raw > best.raw) best = { u, raw, value: p.value };
          }
          cat = best!.u > 0 ? (anyReach ? 'strike' : 'noReach') : best!.raw > 0 ? 'mad' : 'low';
          if (cat === 'low' && desperation >= 0.5) {
            const i = r.shared;
            lowParts.n++;
            lowParts.gain += best!.value * i.desperation * i.doctrine;
            lowParts.retal += i.retaliating ? 0 : RETALIATION_WEIGHT * i.retaliation;
            lowParts.alliance += i.allianceCost;
            lowParts.outrage += i.outrage;
            lowParts.taboo += TABOO_WEIGHT * i.taboo * (i.extreme ? EXTREME_TABOO : 1);
            lowParts.tv += best!.value;
            lowParts.desp += i.desperation;
            lowParts.doctrine += i.doctrine;
          }
        }
        counts.all[cat]++;
        if (desperation >= 0.5) counts.losing[cat]++;
        if (extreme) counts.extreme[cat]++;
        let b = byNation.get(n);
        if (!b) byNation.set(n, (b = { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0, losingDays: 0, warheads: 0 }));
        b[cat]++;
        if (desperation >= 0.5) b.losingDays++;
        b.warheads = Math.max(b.warheads, warheadsOf(w, n));
        if ((cat === 'noReach' || (desperation >= 0.5 && day % 30 === 0)) && examples.length < 60) examples.push({ day, n: tag(n), enemies: war.sides[1 - side]!.map(tag), desperation: +desperation.toFixed(2), extreme, cat, best, shared: r.shared, aim: [...r.aim.at].map(tag), places: r.places.length });
      }
    }
  }
  process.stderr.write(`seed ${seed} year ${y + 1}: decisions ${decisions.length}\n`);
}
const out = { seed, years, counts, lowParts, byNation: Object.fromEntries([...byNation].map(([n, b]) => [tag(n), b])), decisions, examples };
writeFileSync(process.argv[4] ?? `.cache/nukeGates_${seed}.json`, JSON.stringify(out, null, 1));
console.log(`done: seed ${seed}`, JSON.stringify(counts), 'decisions', decisions.length);
