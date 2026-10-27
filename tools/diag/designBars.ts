/**
 * The bars of ADR-731 and ADR-732 (the user's design of the late war and the long run's shape),
 * from 1938, one run for all:
 * - ADR-731: land changing hands each year (net cells whose controller changed, the critic's
 *   `flipped`); cells taken in front battles each year (`FlipCause.battle`); engaged land formations
 *   (not a fleet, a wing nor embarked; hour 12 daily) per war with a land front, the wars with a
 *   land front that day being those with a cell of one side's next to a cell of the other's
 *   (`frontierOf`), and the same per war with a front of at least 10, 30, 100 cells (the engaged
 *   formations of its members); year 1's and the mean of years 2–N;
 * - ADR-732: at each year's end the five largest by cells in order, and the five strongest by
 *   `strengths` (an overlord with its puppets) as a set; the longest run of each; the largest
 *   nation's share of the land cells at the last year.
 *
 * Usage: npx tsx tools/diag/designBars.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { strengths } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { FlipCause, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const LAND = 627843;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/designBars_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};

/** A front's length thresholds, in cells: a war counts at FRONTS[k] when that many of its cells face the other side. */
const FRONTS = [1, 10, 30, 100] as const;
/**
 * Each war's front today, in cells: the cells of either side next to a cell of the other's. Per
 * threshold of FRONTS: how many wars have that much front, and the nations fighting in one of them.
 */
const fronts = (): { wars: number[]; members: Set<number>[] } => {
  const { w: W, h, controller } = w.cells;
  const nb: number[] = [];
  const list = w.wars.list;
  const len = new Array<number>(list.length).fill(0);
  for (const c of frontierOf(w)) {
    const a = controller[c]!;
    if (a === 0) continue;
    const hit = new Set<number>();
    for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b === 0 || b === a || !w.wars.atWar(a, b)) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!.sides;
        if ((s[0].includes(a) && s[1].includes(b)) || (s[1].includes(a) && s[0].includes(b))) hit.add(i);
      }
    }
    for (const i of hit) len[i]!++;
  }
  const wars = FRONTS.map(() => 0);
  const members = FRONTS.map(() => new Set<number>());
  FRONTS.forEach((min, k) => {
    for (let i = 0; i < list.length; i++) {
      if (len[i]! < min) continue;
      wars[k]!++;
      for (const side of list[i]!.sides) for (const n of side) members[k]!.add(n);
    }
  });
  return { wars, members };
};

/** Per FRONTS threshold: wars with that much front a day, and engaged formations a day per such war (those of their members). */
type Front = { min: number; wars: number; per: number };
type Row = { year: number; net: number; battle: number; engaged: number; fronted: number; perFronted: number; fronts: Front[]; area5: string[]; strong5: string[] };
const rows: Row[] = [];
let prev = w.cells.controller.slice();
let lastBattle = w.flipsBy[FlipCause.battle]!;
const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  let eng = 0;
  let fr = 0;
  let per = 0;
  const fw = FRONTS.map(() => 0);
  const fp = FRONTS.map(() => 0);
  for (let d = 0; d < 365; d++) {
    sim.step(12, clear);
    const { wars, members } = fronts();
    let e = 0;
    const ek = FRONTS.map(() => 0);
    const c = w.formations.cols;
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || !c.engaged[id]) return;
      e++;
      for (let k = 0; k < FRONTS.length; k++) if (members[k]!.has(c.nation[id]!)) ek[k]!++;
    });
    const f = wars[0]!;
    eng += e;
    fr += f;
    per += f > 0 ? e / f : 0;
    for (let k = 0; k < FRONTS.length; k++) {
      fw[k]! += wars[k]!;
      fp[k]! += wars[k]! > 0 ? ek[k]! / wars[k]! : 0;
    }
    sim.step(12, clear);
  }
  const frontRow: Front[] = FRONTS.map((min, k) => ({ min, wars: +(fw[k]! / 365).toFixed(2), per: +(fp[k]! / 365).toFixed(3) }));
  const ctl = w.cells.controller;
  const held = new Map<number, number>();
  let net = 0;
  for (let i = 0; i < ctl.length; i++) {
    if (ctl[i] !== prev[i]) net++;
    if (ctl[i] !== 0) held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + 1);
  }
  prev = ctl.slice();
  const battle = w.flipsBy[FlipCause.battle]! - lastBattle;
  lastBattle = w.flipsBy[FlipCause.battle]!;
  const area5 = [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map((e) => tag(e[0]));
  const str = strengths(w);
  const strong: number[] = [];
  for (let n = 1; n < str.length; n++) if (str[n]! > 0 && w.nations.has(n) && w.nations.cols.living[n] === 1) strong.push(n);
  const strong5 = strong.sort((a, b) => str[b]! - str[a]! || a - b).slice(0, 5).map(tag);
  rows.push({ year: y, net, battle, engaged: eng / 365, fronted: fr / 365, perFronted: per / 365, fronts: frontRow, area5, strong5 });
  process.stderr.write(`seed ${seed} year ${y} net ${(100 * net / LAND).toFixed(1)}% battle ${battle} perFronted ${(per / 365).toFixed(2)} ${Math.round((Date.now() - t0) / 1000)} s\n`);
}
const longest = (key: (r: Row) => string): number => {
  let best = 0;
  let run = 0;
  for (let i = 0; i < rows.length; i++) {
    run = i > 0 && key(rows[i]!) === key(rows[i - 1]!) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};
const late = rows.filter((r) => r.year >= 2);
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const lastHeld = new Map<number, number>();
for (const v of w.cells.controller) if (v !== 0) lastHeld.set(v, (lastHeld.get(v) ?? 0) + 1);
const summary = {
  seed,
  years,
  leastNetPct: +((100 * Math.min(...late.map((r) => r.net))) / LAND).toFixed(2),
  leastBattle: Math.min(...late.map((r) => r.battle)),
  perFrontedY1: +rows[0]!.perFronted.toFixed(3),
  perFrontedLate: +mean(late.map((r) => r.perFronted)).toFixed(3),
  // Per front threshold: wars a day and engaged a day per war, year 1 and years 2–N.
  fronts: FRONTS.map((min, k) => ({
    min,
    warsY1: rows[0]!.fronts[k]!.wars,
    warsLate: +mean(late.map((r) => r.fronts[k]!.wars)).toFixed(2),
    perY1: rows[0]!.fronts[k]!.per,
    perLate: +mean(late.map((r) => r.fronts[k]!.per)).toFixed(3),
  })),
  ordered5Longest: longest((r) => r.area5.join()),
  set5Longest: longest((r) => [...r.area5].sort().join()),
  strong5Longest: longest((r) => [...r.strong5].sort().join()),
  largestPctLast: +((100 * Math.max(...lastHeld.values())) / LAND).toFixed(1),
};
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
process.stdout.write(`done: ${JSON.stringify(summary)}\n`);
