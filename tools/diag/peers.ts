/**
 * PLAN 7.53's measure: wars between peers. A 1938 run, weekly (after the day's 24 hours):
 * - the wars running, the armed ones (each side 5 or more land formations within
 *   DEPLOY_RANGE_CELLS of the war's front, as `warSides.ts`), and the engaged land formations of
 *   nations at war, worldwide;
 * - the great powers (the GREAT strongest living nations that are no puppet, by `strengths`) and
 *   their pairs: in one alliance, neighbours (`neighbourMap`), at war with each other; and of the
 *   pairs of neighbours that are neither allied nor at war, the better of the two declarations'
 *   utilities (`warUtility`; a refused one, `whyNotWar`, not counted) and its strength term, and
 *   of each declaration over DECLARE_AT what stops it (AI off, MAX_WARS, pacifist, broke, a better
 *   target of its neighbours, else the draw).
 * - of the great pairs at war: their war with no land front, a front with a side under ARMED near it,
 *   armed; the wars between great powers first seen in the year; the sixth great power's strength
 *   over the first's; the great powers by the sim's rule (`greatPowers`: those of GREAT_FLOOR of the
 *   first's strength, in `docs/evidence/7.53/c-candidate.diff`: on main, the 6 strongest).
 * Per year: the means of the weeks; the great powers of the year's last week, with their alliances.
 *
 * Usage: npx tsx tools/diag/peers.ts <seed> [years = 20] [out = .cache/peers_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Refusal } from '../../src/shared/commands';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { DECLARE_AT, greatPowers, MAX_WARS, neighbourMap, PACIFIST_BELOW, restlessOf, sides, strengths, warsOf, warUtility } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { whyNotWar } from '../../src/sim/systems/war';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

export const GREAT = 6;
const ARMED = 5;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/peers_${seed}.json`;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

/** The day's wars, armed wars and engaged land formations of nations at war. */
function armed(w: World): { wars: number; armed: number; engaged: number; byWar: Map<number, 'noFront' | 'thin' | 'armed'> } {
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const { w: cw, h: ch, controller: ctl } = w.cells;
  const loop = w.settings.loopingMap;
  const range = w.atSize(DEPLOY_RANGE_CELLS);
  const bs = Math.max(1, Math.ceil(range));
  const bw = Math.ceil(cw / bs);
  const frontier = [...frontierOf(w)];
  const land: number[] = [];
  w.formations.forEach((id) => {
    if (!w.isFleet(id) && !w.isWing(id) && !w.offLand(id)) land.push(id);
  });
  const fighting = w.wars.nations();
  let engaged = 0;
  for (const id of land) if (fighting.has(c.nation[id]!) && c.engaged[id] === 1) engaged++;
  const nb: number[] = [];
  let armedWars = 0;
  const byWar = new Map<number, 'noFront' | 'thin' | 'armed'>();
  for (const war of w.wars.list) {
    byWar.set(war.id, 'noFront');
    const A = new Set(war.sides[0].filter((n) => nat.living[n] === 1));
    const D = new Set(war.sides[1].filter((n) => nat.living[n] === 1));
    const buckets = new Map<number, number[]>();
    for (const cell of frontier) {
      const h = ctl[cell]!;
      const other = A.has(h) ? D : D.has(h) ? A : null;
      if (!other) continue;
      let touches = false;
      for (const k of neighbours4(cell, cw, ch, loop, nb)) if (other.has(ctl[k]!)) touches = true;
      if (!touches) continue;
      const key = Math.floor(Math.floor(cell / cw) / bs) * bw + Math.floor((cell % cw) / bs);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = []));
      b.push(cell);
    }
    if (buckets.size === 0) continue;
    const near = (x: number, y: number): boolean => {
      const bx = Math.floor(x / bs);
      const by = Math.floor(y / bs);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          let kx = bx + dx;
          if (kx < 0 || kx >= bw) {
            if (!loop) continue;
            kx = (kx + bw) % bw;
          }
          for (const cell of buckets.get((by + dy) * bw + kx) ?? []) {
            let ddx = Math.abs((cell % cw) + 0.5 - x);
            if (loop && ddx > cw / 2) ddx = cw - ddx;
            if (Math.max(ddx, Math.abs(Math.floor(cell / cw) + 0.5 - y)) <= range) return true;
          }
        }
      return false;
    };
    let a = 0;
    let d = 0;
    for (const id of land) {
      const n = c.nation[id]!;
      const side = A.has(n) ? 0 : D.has(n) ? 1 : -1;
      if (side < 0 || !near(c.x[id]!, c.y[id]!)) continue;
      if (side === 0) a++;
      else d++;
    }
    byWar.set(war.id, a >= ARMED && d >= ARMED ? 'armed' : 'thin');
    if (a >= ARMED && d >= ARMED) armedWars++;
  }
  return { wars: w.wars.list.length, armed: armedWars, engaged, byWar };
}

const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
type Week = { peers: number; wars: number; armed: number; engaged: number; peerNoFront: number; peerThin: number; peerArmed: number; sixthShare: number; allied: number; neighbours: number; atWar: number; open: number; bestU: number[]; bestStrength: number[]; gates: string[] };
const byYear: { year: number; weeks: Week[]; greats: string[] }[] = [];
/** The wars between two great powers, by the year first seen. */
const peerWars = new Map<number, number>();
const days = years * 365;
const t0 = Date.now();
for (let d = 1; d <= days; d++) {
  s.step(24, quiet);
  if (d % 7 !== 0) continue;
  const year = Math.floor((d - 1) / 365) + 1;
  let rec = byYear[year - 1];
  if (!rec) byYear[year - 1] = rec = { year, weeks: [], greats: [] };
  const nc = w.nations.cols;
  const str = strengths(w);
  const living: number[] = [];
  w.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.overlord[n] === 0) living.push(n);
  });
  const greats = living.sort((a, b) => str[b]! - str[a]! || a - b).slice(0, GREAT);
  const nbm = neighbourMap(w);
  const { withAllies, defence } = sides(w, str);
  const al = w.alliances;
  const ar = armed(w);
  const week: Week = { peers: greatPowers(w, str).size, wars: ar.wars, armed: ar.armed, engaged: ar.engaged, peerNoFront: 0, peerThin: 0, peerArmed: 0, sixthShare: greats.length === GREAT ? str[greats[GREAT - 1]!]! / Math.max(1, str[greats[0]!]!) : 0, allied: 0, neighbours: 0, atWar: 0, open: 0, bestU: [], bestStrength: [], gates: [] };
  for (let i = 0; i < greats.length; i++)
    for (let j = i + 1; j < greats.length; j++) {
      const a = greats[i]!;
      const b = greats[j]!;
      if (al.allied(a, b)) week.allied++;
      const neighbours = nbm.get(a)?.has(b) ?? false;
      if (neighbours) week.neighbours++;
      if (w.wars.atWar(a, b)) {
        week.atWar++;
        const war = w.wars.between(a, b)!.war;
        const k = ar.byWar.get(war.id)!;
        if (k === 'noFront') week.peerNoFront++;
        else if (k === 'thin') week.peerThin++;
        else week.peerArmed++;
        if (!peerWars.has(war.id)) peerWars.set(war.id, year);
        continue;
      }
      if (!neighbours || al.allied(a, b)) continue;
      week.open++;
      let best = -Infinity;
      let bestS = 0;
      for (const [n, t] of [
        [a, b],
        [b, a],
      ] as const) {
        if (whyNotWar(w, n, t) !== Refusal.None) continue;
        const wars = warsOf(w, n);
        const u = warUtility(w, n, t, withAllies(n), defence(t), wars, wars === 0 ? restlessOf(w, n) : 0);
        if (u.u > best) {
          best = u.u;
          bestS = u.strength;
        }
        // What stops a declaration that scores over DECLARE_AT (`strategicAi`'s gates before the score, then its best target).
        if (u.u > DECLARE_AT) {
          let gate = 'draw';
          if (nc.aiOff[n] === 1) gate = 'aiOff';
          else if (wars >= MAX_WARS) gate = 'maxWars';
          else if (nc.aggression[n]! < PACIFIST_BELOW) gate = 'pacifist';
          else if (nc.gold[n]! < 0 || nc.bankrupt[n] === 1) gate = 'broke';
          else {
            for (const o of nbm.get(n) ?? []) {
              if (o === t || whyNotWar(w, n, o) !== Refusal.None) continue;
              const v = warUtility(w, n, o, withAllies(n), defence(o), wars, wars === 0 ? restlessOf(w, n) : 0).u;
              if (v > u.u) gate = 'otherBest';
            }
          }
          week.gates.push(gate);
        }
      }
      if (Number.isFinite(best)) {
        week.bestU.push(best);
        week.bestStrength.push(bestS);
      }
    }
  rec.weeks.push(week);
  rec.greats = greats.map((n) => `${tag(n)}${al.allianceOf(n) ? `/a${al.allianceOf(n)!.id}` : ''}`);
  if (d % 365 === 0) process.stderr.write(`year ${year}: ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
}
const mean = (a: number[]): number => (a.length ? Math.round((a.reduce((k, x) => k + x, 0) / a.length) * 100) / 100 : 0);
const med = (a: number[]): number | null => (a.length ? Math.round([...a].sort((x, y) => x - y)[a.length >> 1]! * 100) / 100 : null);
const yearsOut = byYear.map((r) => ({
  year: r.year,
  wars: mean(r.weeks.map((x) => x.wars)),
  armed: mean(r.weeks.map((x) => x.armed)),
  engaged: mean(r.weeks.map((x) => x.engaged)),
  greatPairsAllied: mean(r.weeks.map((x) => x.allied)),
  greatPairsNeighbours: mean(r.weeks.map((x) => x.neighbours)),
  greatPairsAtWar: mean(r.weeks.map((x) => x.atWar)),
  greatPairsOpen: mean(r.weeks.map((x) => x.open)),
  peerNoFront: mean(r.weeks.map((x) => x.peerNoFront)),
  peerThin: mean(r.weeks.map((x) => x.peerThin)),
  peerArmed: mean(r.weeks.map((x) => x.peerArmed)),
  peerWarsNew: [...peerWars.values()].filter((y) => y === r.year).length,
  sixthShare: mean(r.weeks.map((x) => x.sixthShare)),
  peers: mean(r.weeks.map((x) => x.peers)),
  openBestU: med(r.weeks.flatMap((x) => x.bestU)),
  openBestUMax: r.weeks.flatMap((x) => x.bestU).reduce((k, x) => Math.max(k, x), -Infinity),
  openStrength: med(r.weeks.flatMap((x) => x.bestStrength)),
  openGates: r.weeks.flatMap((x) => x.gates).reduce<Record<string, number>>((k, g) => ((k[g] = (k[g] ?? 0) + 1), k), {}),
  greats: r.greats,
}));
const later = byYear.slice(1).flatMap((r) => r.weeks);
const summary = { seed, years, armedYear1: yearsOut[0]?.armed ?? 0, armedLater: mean(later.map((x) => x.armed)), engagedLater: mean(later.map((x) => x.engaged)), warsLater: mean(later.map((x) => x.wars)), alliedLater: mean(later.map((x) => x.allied)), atWarLater: mean(later.map((x) => x.atWar)) };
writeFileSync(out, JSON.stringify({ summary, years: yearsOut }, null, 1));
console.log(`done: ${JSON.stringify(summary)}`);
