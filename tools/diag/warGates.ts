/**
 * PLAN 7.14 (critic run 7: "give the late game new causes of war"): which gate of the strategic
 * AI's declaration (`strategicAi`) stops each actor's turn, by decade. The turn is weighed after
 * the day's AI has acted (at 00:00, the actors of the day): pacifist, broke, at its MAX_WARS, no
 * neighbour it may declare on (and why not: `whyNotWar`'s refusals over its neighbours), the best
 * utility at most DECLARE_AT (with the best target's parts), or passed (then the draw).
 *
 * Usage: npx tsx tools/diag/warGates.ts <seed> [years = 50] [out = .cache/warGates_<seed>.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { Refusal } from '../../src/shared/commands';
import { ALLY_WEIGHT, CLAIM, DECLARE_AT, MAX_WARS, neighbourMap, OPPORTUNITY, PACIFIST_BELOW, RATIO_CAP, STAGGER, strengths, WARS_PENALTY } from '../../src/sim/ai/strategic';
import { whyNotWar } from '../../src/sim/systems/war';
import { relationHit } from '../../src/sim/systems/nuclear';
import { navOf } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 50);
const out = process.argv[4] ?? `.cache/warGates_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const refusalName = new Map(Object.entries(Refusal).map(([k, v]) => [v as number, k]));
type Decade = { actors: number; pacifist: number; broke: number; atMax: number; noTarget: number; low: number; passed: number; why: Record<string, number>; neighbours: number; lowParts: { n: number; ratio: number; opp: number; claim: number; exh: number; wars: number; u: number }; alliances: number; largestAlliance: number; aggression: number };
const decades: Decade[] = [];
const newDecade = (): Decade => ({ actors: 0, pacifist: 0, broke: 0, atMax: 0, noTarget: 0, low: 0, passed: 0, why: {}, neighbours: 0, lowParts: { n: 0, ratio: 0, opp: 0, claim: 0, exh: 0, wars: 0, u: 0 }, alliances: 0, largestAlliance: 0, aggression: 0 });
const warsOf = (n: number): number => w.wars.list.filter((x) => x.sides[0].includes(n) || x.sides[1].includes(n)).length;
const exhaustionOf = (n: number): number => {
  let e = 0;
  for (const x of w.wars.list) {
    if (x.sides[0].includes(n)) e = Math.max(e, x.exhaustion[0]);
    if (x.sides[1].includes(n)) e = Math.max(e, x.exhaustion[1]);
  }
  return e;
};
const claimsOn = (n: number, t: number): boolean => {
  const g = navOf(w).graph;
  for (const p of w.provinces.provincesOf(n)) {
    const c = g.centre[p] ?? -1;
    if (c >= 0 && w.cells.owner[c] === t) return true;
  }
  return false;
};
let day = 0;
for (let y = 0; y < years; y++) {
  if (y % 10 === 0) decades.push(newDecade());
  const dec = decades.at(-1)!;
  for (let d = 0; d < 365; d++, day++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const today = w.tick / 24;
    const nc = w.nations.cols;
    const actors: number[] = [];
    w.nations.forEach((n) => {
      if (nc.living[n] === 1 && nc.aiOff[n] !== 1 && nc.overlord[n] === 0 && (today + n) % STAGGER === 0) actors.push(n);
    });
    if (actors.length === 0) continue;
    const nb = neighbourMap(w);
    const str = strengths(w);
    const al = w.alliances;
    const withAllies = (n: number): number => {
      let v = str[n]!;
      for (const m of al.allianceOf(n)?.members ?? []) if (m !== n) v += ALLY_WEIGHT * str[m]!;
      return v;
    };
    const defence = (t: number): number => {
      const o = nc.overlord[t]!;
      let v = 0;
      for (const x of o !== 0 ? [o, t] : [t]) {
        v += withAllies(x);
        for (const g of al.guarantorsOf(x)) v += ALLY_WEIGHT * str[g]!;
      }
      return Math.max(1, v);
    };
    for (const n of actors) {
      dec.actors++;
      dec.aggression += nc.aggression[n]!;
      const neighbours = [...(nb.get(n) ?? [])];
      dec.neighbours += neighbours.length;
      const wars = warsOf(n);
      if (nc.aggression[n]! < PACIFIST_BELOW) {
        dec.pacifist++;
        continue;
      }
      if (nc.gold[n]! < 0 || nc.bankrupt[n] === 1) {
        dec.broke++;
        continue;
      }
      if (wars >= MAX_WARS) {
        dec.atMax++;
        continue;
      }
      const attack = withAllies(n);
      let best: { u: number; ratio: number; opp: number; claim: number; exh: number; wars: number } | null = null;
      for (const t of neighbours) {
        const why = whyNotWar(w, n, t);
        if (why !== Refusal.None) {
          const k = refusalName.get(why) ?? String(why);
          dec.why[k] = (dec.why[k] ?? 0) + 1;
          continue;
        }
        const ratio = (nc.aggression[n]! / 100) * (Math.min(RATIO_CAP, attack / defence(t)) - 1);
        const opp = warsOf(t) > 0 ? OPPORTUNITY : 0;
        const claim = claimsOn(n, t) ? CLAIM : 0;
        const exh = exhaustionOf(n) / 100;
        const u = ratio + opp + claim - exh - WARS_PENALTY * wars + 0.5 * relationHit(w, n, t);
        if (!best || u > best.u) best = { u, ratio, opp, claim, exh, wars: WARS_PENALTY * wars };
      }
      if (!best) {
        dec.noTarget++;
        continue;
      }
      if (best.u <= DECLARE_AT) {
        dec.low++;
        const p = dec.lowParts;
        p.n++;
        p.ratio += best.ratio;
        p.opp += best.opp;
        p.claim += best.claim;
        p.exh += best.exh;
        p.wars += best.wars;
        p.u += best.u;
        continue;
      }
      dec.passed++;
    }
  }
  dec.alliances = w.alliances.list.length;
  dec.largestAlliance = Math.max(0, ...w.alliances.list.map((a) => a.members.length));
  process.stderr.write(`seed ${seed} year ${y + 1}\n`);
}
for (const d of decades) {
  const p = d.lowParts;
  if (p.n > 0) for (const k of ['ratio', 'opp', 'claim', 'exh', 'wars', 'u'] as const) p[k] = Math.round((p[k] / p.n) * 1000) / 1000;
  d.aggression = Math.round(d.aggression / Math.max(1, d.actors));
  d.neighbours = Math.round((d.neighbours / Math.max(1, d.actors)) * 10) / 10;
}
mkdirSync('.cache', { recursive: true });
writeFileSync(out, JSON.stringify({ seed, years, decades }, null, 1));
process.stderr.write(`done: seed ${seed}\n`);
