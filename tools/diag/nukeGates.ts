/**
 * PLAN 7.6 (critic R7-B1): which gate of the AI's nuclear decision stops each nuclear power's
 * war-day. For each nation that weighs strikes (`weighsStrikes`), each day, each war it weighs:
 * noAim (no enemy that can threaten it), noPlace (no fair place), low (the best place's utility
 * at most 0 with no MAD cap), mad (positive but for the MAD cap), noReach (positive but out of
 * reach of its missiles and bombers), strike (positive and in reach); split by losing
 * (desperation at least 0.5) and extreme. The day is weighed after its decisions (at 00:00): the
 * decisions themselves are counted from `NukeDecided`.
 *
 * PLAN 7.18i: `held`, the war-days whose best place is at most 0 (no MAD cap) while a place's
 * utility if its warhead got there (its value ÷ the chance through, the costs whole) is above 0:
 * the chance through is what keeps it under 0, the costs weighed whole and the gain × the chance.
 *
 * PLAN 7.28: `paused` split by what became of the launch that began the gap (`pausedBy`: burst,
 * short — shot down or its wing lost —, flight — still in the air), each held day weighed as if it
 * were not (its category); and of the gaps begun by a launch stopped short, how many the side
 * followed with another launch in that war (`shortGaps`).
 *
 * Usage: npx tsx tools/diag/nukeGates.ts <seed> [years = 30] [out = .cache/nukeGates_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { reaches, avengingOf, nukeTargets, dayIndustry, desperationOf, nuclearUtility, RETALIATION_WEIGHT, NUKE_FLOOR, TABOO_WEIGHT, EXTREME_TABOO, warheadsOf, strikePaused, weighsStrikes, weighsWar, weighWar } from '../../src/sim/systems/nuclear';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
type Cat = 'noAim' | 'noPlace' | 'mad' | 'low' | 'strike' | 'noReach';
const counts: Record<'all' | 'losing' | 'extreme', Record<Cat, number>> = { all: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, losing: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, extreme: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 } };
const lowParts = { n: 0, gain: 0, retal: 0, alliance: 0, outrage: 0, taboo: 0, tv: 0, desp: 0, doctrine: 0 };
const byNation = new Map<number, Record<Cat, number> & { losingDays: number; warheads: number }>();
const bursts: { day: number; n: number | string; struck: number | string; dead: number; x: number; y: number }[] = [];
const decisions: { day: number; n: number | string; x: number; y: number; u: number }[] = [];
const examples: unknown[] = [];
const held = { days: 0, low: 0, held: 0, losing: 0, extreme: 0, throughMin: 1, byNation: {} as Record<string, number>, examples: [] as unknown[] };
type WinBand = Record<Cat, number> & { days: number; scoreUp: number; retal0: number; value: number; capitalBest: number; gain: number; costs: number; nLow: number; anywherePlaces: number; enemyIncome: number };
const winning = new Map<string, WinBand>();
const examplesWin: unknown[] = [];
const firstWarhead = new Map<string, number>();
let day = 0;
/** War-days of nations held by the gap after their side's launch (PLAN 7.25b). */
let paused = 0;
type Outcome = 'burst' | 'short' | 'flight';
const pausedBy: Record<Outcome, Record<Cat, number>> = { burst: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, short: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 }, flight: { noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0 } };
/** Every launch by its id (ids are given in order: `world.nextLaunchId`), and those stopped short. */
const launches = new Map<number, { nation: number; tick: number; missile: number }>();
const shortIds = new Set<number>();
let nextId = w.nextLaunchId;
/** The gaps begun by a launch stopped short: war, side, the launch's tick; and whether the side launched again in the war. */
const shortGaps = new Map<string, { war: number; side: number; tick: number; day: number; n: string; warheads: number; strikeDays: number; relaunched: boolean; relaunchDay: number | null }>();
const outcomeOf = (war: { id: number; sides: [number[], number[]]; lastStrike?: [number, number] }, side: number): Outcome => {
  const t = war.lastStrike![side]!;
  for (const [id, l] of launches) {
    if (l.tick !== t || !war.sides[side]!.includes(l.nation)) continue;
    if (shortIds.has(id)) return 'short';
    return w.nukeLaunches.some((x) => x.id === id) ? 'flight' : 'burst';
  }
  // The launching nation has left the side (a peace of its own): judge by any launch of the tick.
  for (const [id, l] of launches) if (l.tick === t) return shortIds.has(id) ? 'short' : w.nukeLaunches.some((x) => x.id === id) ? 'flight' : 'burst';
  return 'burst';
};
const catOf = (r: ReturnType<typeof weighWar>, n: number): Cat => {
  if (!r.shared) return 'noAim';
  if (r.places.length === 0) return 'noPlace';
  let anyReach = false;
  let bu = -Infinity;
  let braw = -Infinity;
  for (const p of r.places) {
    const u = nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared });
    if (u > NUKE_FLOOR && reaches(w, n, p.x, p.y)) anyReach = true;
    const raw = nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared, mad: false });
    if (raw > braw) {
      braw = raw;
      bu = u;
    }
  }
  return bu > NUKE_FLOOR ? (anyReach ? 'strike' : 'noReach') : braw > NUKE_FLOOR ? 'mad' : 'low';
};
for (let y = 0; y < years; y++) {
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeCasualties) {
        const k = nukeStrike(ev[i + 3]!);
        bursts.push({ day, n: tag(ev[i + 2]!), struck: tag(k.nation), dead: k.dead, x: ev[i + 4]!, y: ev[i + 5]! });
      }
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.NukeLaunched) launches.set(nextId++, { nation: ev[i + 2]!, tick: ev[i]!, missile: ev[i + 3]! });
        if (ev[i + 1] === EventKind.NukeIntercepted) shortIds.add(ev[i + 3]!);
      }
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) decisions.push({ day, n: tag(ev[i + 2]!), u: ev[i + 3]! / 1000, x: ev[i + 4]!, y: ev[i + 5]! });
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    for (const n of w.warheads.keys()) if (warheadsOf(w, n) > 0 && !firstWarhead.has(tag(n))) firstWarhead.set(tag(n), +(day / 365).toFixed(2));
    for (const war of w.wars.list)
      for (const g of shortGaps.values()) if (g.war === war.id && !g.relaunched && (war.lastStrike?.[g.side] ?? -1) > g.tick) {
        g.relaunched = true;
        g.relaunchDay = day;
      }
    if (w.warheads.size === 0) continue;
    const industry = dayIndustry(w);
    for (const n of [...w.warheads.keys()].sort((a, b) => a - b)) {
      if (!weighsStrikes(w, n)) continue;
      const avenging = avengingOf(w, n);
      for (const war of w.wars.list) {
        const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
        if (!weighsWar(w, n, war, side, avenging)) continue;
        // PLAN 7.25b: a side that launched within STRIKE_GAP_DAYS weighs no first use.
        if (!avenging && strikePaused(w, war, side)) {
          paused++;
          // PLAN 7.28: what became of the launch that began the gap, and what the day would have been.
          const o = outcomeOf(war, side);
          const c = catOf(weighWar(w, n, war, side, industry), n);
          pausedBy[o][c]++;
          if (o === 'short') {
            const k = `${war.id}:${side}:${war.lastStrike![side as number]}`;
            let g = shortGaps.get(k);
            if (!g) shortGaps.set(k, (g = { war: war.id, side, tick: war.lastStrike![side as number]!, day, n: tag(n), warheads: warheadsOf(w, n), strikeDays: 0, relaunched: false, relaunchDay: null }));
            if (c === 'strike') g.strikeDays++;
          }
          continue;
        }
        const { desperation, extreme } = desperationOf(w, n, war, side);
        const r = weighWar(w, n, war, side, industry);
        let cat: Cat;
        let best: { u: number; raw: number; value: number } | null = null;
        if (!r.shared) cat = 'noAim';
        else if (r.places.length === 0) cat = 'noPlace';
        else {
          let anyReach = false;
          let burst: { u: number; through: number; value: number } | null = null;
          for (const p of r.places) {
            const u = nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared });
            if (u > NUKE_FLOOR && reaches(w, n, p.x, p.y)) anyReach = true;
            const raw = nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared, mad: false });
            if (!best || raw > best.raw) best = { u, raw, value: p.value };
            // PLAN 7.18i: the place's utility if its warhead got there.
            const through = p.through;
            const ub = through > 0 ? nuclearUtility({ targetValue: Math.min(1, p.value / through), through: 1, people: p.people, ...r.shared, mad: false }) : -Infinity;
            if (!burst || ub > burst.u) burst = { u: ub, through, value: p.value };
          }
          cat = best!.u > NUKE_FLOOR ? (anyReach ? 'strike' : 'noReach') : best!.raw > NUKE_FLOOR ? 'mad' : 'low';
          held.days++;
          if (cat === 'low') {
            held.low++;
            if (burst && burst.u > NUKE_FLOOR) {
              held.held++;
              if (desperation >= 0.5) held.losing++;
              if (extreme) held.extreme++;
              held.throughMin = Math.min(held.throughMin, burst.through);
              held.byNation[tag(n)] = (held.byNation[tag(n)] ?? 0) + 1;
              if (held.examples.length < 40 && (held.held % 25 === 1)) held.examples.push({ day, n: tag(n), enemies: war.sides[1 - side]!.map(tag), desperation: +desperation.toFixed(2), extreme, best: +best!.raw.toFixed(3), burstU: +burst.u.toFixed(3), through: +burst.through.toFixed(2), value: +burst.value.toFixed(3) });
            }
          }
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
        // PLAN 7.18e: the days of a holder not losing (desperation under 0.5), by the war's length:
        // which gate stops a winner's strike, and what its best place is worth.
        if (desperation < 0.5) {
          const warDays = Math.floor((w.tick - war.startTick) / 24);
          const band = warDays < 365 ? 'under1y' : warDays < 730 ? '1to2y' : 'over2y';
          const k = `${band}`;
          let wb = winning.get(k);
          if (!wb) winning.set(k, (wb = { days: 0, noAim: 0, noPlace: 0, mad: 0, low: 0, strike: 0, noReach: 0, scoreUp: 0, retal0: 0, value: 0, capitalBest: 0, gain: 0, costs: 0, nLow: 0, anywherePlaces: 0, enemyIncome: 0 }));
          wb.days++;
          wb[cat]++;
          const score = side === 0 ? war.score : -war.score;
          if (score >= 0) wb.scoreUp++;
          const nc = w.nations.cols;
          let ei = 0;
          for (const m of war.sides[1 - side]!) if (nc.living[m] === 1) ei = Math.max(ei, nc.income[m]! / Math.max(1, nc.income[n]!));
          wb.enemyIncome += ei;
          if (r.shared && r.shared.retaliation === 0) wb.retal0++;
          if (cat === 'noPlace' && r.shared) wb.anywherePlaces += nukeTargets(w, n, war, side, { at: r.aim.at, anywhere: true }).length > 0 ? 1 : 0;
          if (cat === 'low' && best && r.shared) {
            const i = r.shared;
            wb.nLow++;
            wb.value += best.value;
            const bp = r.places.find((p) => p.value === best!.value)!;
            if (war.sides[1 - side]!.some((m) => nc.capitalX[m] === bp.x && nc.capitalY[m] === bp.y)) wb.capitalBest++;
            wb.gain += best.value * i.desperation * i.doctrine;
            wb.costs += (i.retaliating ? 0 : RETALIATION_WEIGHT * i.retaliation) + i.allianceCost + i.outrage + TABOO_WEIGHT * i.taboo * (i.extreme ? EXTREME_TABOO : 1);
          }
          if (warDays >= 365 && score >= 0 && examplesWin.length < 40 && day % 60 === 0) examplesWin.push({ day, n: tag(n), enemies: war.sides[1 - side]!.map(tag), warDays, score, enemyIncome: +ei.toFixed(3), cat, best, retaliation: r.shared?.retaliation, aim: [...r.aim.at].map(tag), places: r.places.length });
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
const launchesShort = [...launches.keys()].filter((id) => shortIds.has(id)).length;
const out = { seed, years, bursts, counts, paused, pausedBy, launchCount: launches.size, launchesShort, shortGaps: [...shortGaps.values()], held, lowParts, winning: Object.fromEntries(winning), firstWarhead: Object.fromEntries(firstWarhead), examplesWin, byNation: Object.fromEntries([...byNation].map(([n, b]) => [tag(n), b])), decisions, examples };
writeFileSync(process.argv[4] ?? `.cache/nukeGates_${seed}.json`, JSON.stringify(out, null, 1));
console.log(`done: seed ${seed}`, JSON.stringify(counts), 'decisions', decisions.length, 'paused', JSON.stringify(pausedBy), 'launches', launches.size, 'short', launchesShort, 'held', JSON.stringify({ days: held.days, low: held.low, held: held.held, losing: held.losing, extreme: held.extreme }));
