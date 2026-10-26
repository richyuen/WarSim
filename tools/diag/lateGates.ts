/**
 * PLAN 7.118: why a late world stands still. From a saved state, for `days` days, at each day's start
 * (the state the strategic AI reads), every actor of that day (`strategicAi`'s: living, AI on, no
 * overlord, day + id ≡ 0 mod STAGGER) by the gate its war turn stops at: pacifist, broke, at its
 * MAX_WARS, no target it may declare on (with `whyNotWar`'s refusals over its land neighbours), the best
 * utility at most DECLARE_AT (with that target's terms, `warUtility`), or over the bar (then the draw).
 * The same for the largest holders of land alone; and the land held by nations in no war.
 *
 * Usage: npx tsx tools/diag/lateGates.ts <seed> <state.bin> [days = 365]
 */
import { readFileSync } from 'node:fs';
import { Refusal } from '../../src/shared/commands';
import { DECLARE_AT, MAX_WARS, neighbourMap, PACIFIST_BELOW, restlessOf, seaTargets, sides, STAGGER, strengths, warsOf, warUtility } from '../../src/sim/ai/strategic';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { whyNotWar } from '../../src/sim/systems/war';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 365);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const w = s.world;
const nc = w.nations.cols;
const tag = (n: number): string => ((nc.origin[n] ?? 0) === 0 ? (TAGS_1938[n - 1] ?? `#${n}`) : `f${n}`);
const refusalName = new Map(Object.entries(Refusal).map(([k, v]) => [v as number, k]));
type Tally = { turns: number; pacifist: number; broke: number; atMax: number; noTarget: number; low: number; over: number; why: Record<string, number>; parts: Record<string, number> };
const tally = (): Tally => ({ turns: 0, pacifist: 0, broke: 0, atMax: 0, noTarget: 0, low: 0, over: 0, why: {}, parts: {} });
const all = tally();
const big = new Map<number, Tally>();
let declared = 0;
let peaceLandDays = 0;
let landDays = 0;
const held = (): Map<number, number> => {
  const m = new Map<number, number>();
  const c = w.cells.controller;
  for (let i = 0; i < c.length; i++) if (c[i] !== 0) m.set(c[i]!, (m.get(c[i]!) ?? 0) + 1);
  return m;
};
let top = [...held()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const h = held();
  if (d % 30 === 0) top = [...h].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  for (const [n, k] of h) {
    landDays += k;
    if (warsOf(w, n) === 0) peaceLandDays += k;
  }
  const today = w.tick / 24;
  const actors: number[] = [];
  w.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.aiOff[n] !== 1 && nc.overlord[n] === 0 && (today + n) % STAGGER === 0) actors.push(n);
  });
  if (actors.length === 0) continue;
  const nb = neighbourMap(w);
  const str = strengths(w);
  const { withAllies, defence } = sides(w, str);
  for (const n of actors) {
    const ts = [all];
    if (top.includes(n)) {
      if (!big.has(n)) big.set(n, tally());
      ts.push(big.get(n)!);
    }
    const add = (f: (t: Tally) => void): void => ts.forEach(f);
    add((t) => t.turns++);
    const wars = warsOf(w, n);
    if (nc.aggression[n]! < PACIFIST_BELOW) {
      add((t) => t.pacifist++);
      continue;
    }
    if (nc.gold[n]! < 0 || nc.bankrupt[n] === 1) {
      add((t) => t.broke++);
      continue;
    }
    if (wars >= MAX_WARS) {
      add((t) => t.atMax++);
      continue;
    }
    const restless = wars === 0 ? restlessOf(w, n) : 0;
    const attack = withAllies(n);
    const neighbours = [...(nb.get(n) ?? [])].sort((a, b) => a - b);
    let best: ReturnType<typeof warUtility> | null = null;
    const weigh = (among: readonly number[], count: boolean): void => {
      for (const t of among) {
        const why = whyNotWar(w, n, t);
        if (why !== Refusal.None) {
          if (count) {
            const k = refusalName.get(why) ?? String(why);
            add((x) => (x.why[k] = (x.why[k] ?? 0) + 1));
          }
          continue;
        }
        const u = warUtility(w, n, t, attack, defence(t), wars, restless);
        if (!best || u.u > best.u) best = u;
      }
    };
    weigh(neighbours, true);
    if (!best || (best as ReturnType<typeof warUtility>).u <= DECLARE_AT) weigh(seaTargets(w, n).filter((t) => !neighbours.includes(t)), false);
    const b = best as ReturnType<typeof warUtility> | null;
    if (!b) {
      add((t) => t.noTarget++);
      continue;
    }
    if (b.u <= DECLARE_AT) {
      add((t) => {
        t.low++;
        for (const k of ['strength', 'opportunity', 'claim', 'exhaustion', 'wars', 'pariah', 'restless', 'u'] as const) t.parts[k] = (t.parts[k] ?? 0) + b[k];
      });
      continue;
    }
    add((t) => t.over++);
  }
  declared += w.wars.list.filter((x) => x.startTick > w.tick - 24).length;
}
const show = (name: string, t: Tally): string => {
  const parts = Object.entries(t.parts).map(([k, v]) => `${k} ${(v / Math.max(1, t.low)).toFixed(2)}`).join(', ');
  const why = Object.entries(t.why).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ');
  return `${name}: turns ${t.turns}, pacifist ${t.pacifist}, broke ${t.broke}, atMax ${t.atMax}, noTarget ${t.noTarget}, low ${t.low}, over ${t.over}\n    refusals: ${why}\n    low parts: ${parts}`;
};
console.log(`seed ${seed} ${src}, ${days} days: wars begun ${declared}, land at peace ${((100 * peaceLandDays) / landDays).toFixed(1)} %`);
console.log(show('all', all));
for (const [n, t] of big) console.log(show(`${tag(n)} (aggr ${nc.aggression[n]}, wars ${warsOf(w, n)})`, t));
console.log('done:');
