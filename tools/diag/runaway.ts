/**
 * The late runaway (PLAN 7.143): from 1938, one nation's growth year by year and what stands
 * against it.
 * - Yearly: the nation's cells (controller) and share of the land cells; the cells it took and lost
 *   by `FlipCause`, and from (to) which nations, the five largest of each.
 * - Monthly, summed into the year: its share of world gross income (the coalition's bar,
 *   HEGEMON_SHARE); the coalition alliance and its members' `strengths` against its own; its wars
 *   (enemies, each side's men, score, exhaustion); its far provinces (overextension's: centre more
 *   than OVEREXT_CELLS cells from the capital): count, mean unrest, at or over REVOLT_FROM, core;
 *   its suppression; revolts on its land (`RevoltSpawned`, b = it) and land ceded (`LandCeded`).
 * - Saves at the years given (`--saves 10,15,20,25`) to `<out>_y<year>.bin`.
 *
 * Usage: npx tsx tools/diag/runaway.ts <seed> <years> <out base> [tag=USA] [--saves 10,15,20,25]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { HEGEMON_SHARE, strengths } from '../../src/sim/ai/strategic';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { OVEREXT_CELLS, REVOLT_FROM } from '../../src/sim/systems/revolts';
import { navOf, type FlipCauseId, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const LAND = 627843;
const CAUSES = ['other', 'battle', 'walkIn', 'peace', 'revolt', 'revival', 'capital', 'puppet', 'landing'];
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--saves');
const seed = Number(args[0]);
const years = Number(args[1] ?? 30);
const base = args[2] ?? `.cache/runaway_${seed}`;
const watchTag = args[3] ?? 'USA';
const si = process.argv.indexOf('--saves');
const saves = new Set(si >= 0 ? process.argv[si + 1]!.split(',').map(Number) : []);

const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const us = TAGS_1938.indexOf(watchTag) + 1;
if (us === 0) throw new Error(`no tag ${watchTag}`);

// Every change of a cell's controller to or from the nation, by cause and by the other nation.
type Tally = { byCause: number[]; byOther: Map<number, number> };
const fresh = (): Tally => ({ byCause: new Array<number>(9).fill(0), byOther: new Map() });
let gained = fresh();
let lost = fresh();
const orig = w.setController.bind(w);
w.setController = (i: number, nation: number, keepFrontier = false, cause: FlipCauseId = 0): void => {
  const from = w.cells.controller[i]!;
  if (from !== nation) {
    if (nation === us) {
      gained.byCause[cause]!++;
      gained.byOther.set(from, (gained.byOther.get(from) ?? 0) + 1);
    } else if (from === us) {
      lost.byCause[cause]!++;
      lost.byOther.set(nation, (lost.byOther.get(nation) ?? 0) + 1);
    }
  }
  orig(i, nation, keepFrontier, cause);
};

type Month = {
  incomeShare: number;
  coalition: string[];
  coalitionStr: number;
  ownStr: number;
  wars: { enemies: string[]; own: number; theirs: number; score: number; exh: [number, number] }[];
  far: number;
  farUnrest: number;
  farRestless: number;
  farCore: number;
  provinces: number;
  nonCore: number;
  suppression: number;
  gold: number;
};
const months: Month[] = [];
let revolts = 0;
let ceded = 0;

const menOf = (nations: number[]): number => {
  const set = new Set(nations);
  let men = 0;
  const fc = w.formations.cols;
  w.formations.forEach((f) => {
    if (set.has(fc.nation[f]!) && !w.offLand(f)) men += fc.strength[f]!;
  });
  return men;
};

const sample = (): void => {
  const nc = w.nations.cols;
  let total = 0;
  w.nations.forEach((n) => {
    if (nc.living[n] === 1) total += Math.max(0, nc.income[n]!);
  });
  const str = strengths(w);
  const co = w.alliances.list.find((a) => a.nameKey === 'alliance.coalition');
  const wars = w.wars.list
    .filter((x) => x.sides[0].includes(us) || x.sides[1].includes(us))
    .map((x) => {
      const s = x.sides[0].includes(us) ? 0 : 1;
      return { enemies: x.sides[1 - s]!.map(tag), own: menOf(x.sides[s]!), theirs: menOf(x.sides[1 - s]!), score: s === 0 ? x.score : -x.score, exh: [x.exhaustion[s]!, x.exhaustion[1 - s]!] as [number, number] };
    });
  const pv = w.provinces;
  const g = navOf(w).graph;
  const far = w.atSize(OVEREXT_CELLS);
  let nFar = 0;
  let uFar = 0;
  let rFar = 0;
  let cFar = 0;
  let nProv = 0;
  let nNon = 0;
  for (let p = 1; p < pv.count; p++) {
    const c = g.centre[p] ?? -1;
    if (c < 0 || w.cells.owner[c] !== us) continue;
    nProv++;
    if (pv.core[p] !== us) nNon++;
    const dx = Math.min(Math.abs((c % w.cells.w) + 0.5 - nc.capitalX[us]!), w.cells.w - Math.abs((c % w.cells.w) + 0.5 - nc.capitalX[us]!));
    const dy = Math.floor(c / w.cells.w) + 0.5 - nc.capitalY[us]!;
    if (dx * dx + dy * dy <= far * far) continue;
    nFar++;
    uFar += pv.unrest[p]!;
    if (pv.unrest[p]! >= REVOLT_FROM) rFar++;
    if (pv.core[p] === us) cFar++;
  }
  months.push({
    incomeShare: total > 0 ? Math.max(0, nc.income[us]!) / total : 0,
    coalition: co ? co.members.map(tag) : [],
    coalitionStr: co ? co.members.reduce((a, m) => a + str[m]!, 0) : 0,
    ownStr: str[us]!,
    wars,
    far: nFar,
    farUnrest: nFar > 0 ? uFar / nFar : 0,
    farRestless: rFar,
    farCore: cFar,
    provinces: nProv,
    nonCore: nNon,
    suppression: nc.suppression[us]!,
    gold: nc.gold[us]!,
  });
};

const top = (m: Map<number, number>, k = 5): string[] =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([n, c]) => `${n === 0 ? '-' : tag(n)} ${c}`);
const step = (ww: World): void => {
  // `out.events`: tick, kind, a, b, x, y per event.
  const ev = ww.out.events;
  for (let i = 0; i + 5 < ev.length; i += 6) {
    if (ev[i + 1] === EventKind.RevoltSpawned && ev[i + 3] === us) revolts++;
    if (ev[i + 1] === EventKind.LandCeded && ev[i + 3] === us) ceded++;
  }
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};

const rows: unknown[] = [];
const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  months.length = 0;
  revolts = 0;
  ceded = 0;
  gained = fresh();
  lost = fresh();
  for (let h = 0; h < 365 * 24; h++) {
    if (isMonthStart(w.startDay, w.tick)) sample();
    sim.step(1, step);
  }
  const heldBy = new Map<number, number>();
  for (const v of w.cells.controller) if (v !== 0) heldBy.set(v, (heldBy.get(v) ?? 0) + 1);
  const held = heldBy.get(us) ?? 0;
  const mean = (f: (m: Month) => number): number => +(months.reduce((a, m) => a + f(m), 0) / Math.max(1, months.length)).toFixed(3);
  const last = months[months.length - 1];
  const enemies = new Map<string, number>();
  for (const m of months) for (const x of m.wars) for (const e of x.enemies) enemies.set(e, (enemies.get(e) ?? 0) + 1);
  const row = {
    year: y,
    living: w.nations.cols.living[us] === 1,
    pct: +((100 * held) / LAND).toFixed(2),
    largest: [...heldBy].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${tag(n)} ${((100 * c) / LAND).toFixed(1)}`),
    gained: Object.fromEntries(gained.byCause.map((v, k) => [CAUSES[k], v]).filter((e) => e[1] !== 0)),
    gainedFrom: top(gained.byOther),
    lost: Object.fromEntries(lost.byCause.map((v, k) => [CAUSES[k], v]).filter((e) => e[1] !== 0)),
    lostTo: top(lost.byOther),
    incomeShare: mean((m) => m.incomeShare),
    hegemonMonths: months.filter((m) => m.incomeShare > HEGEMON_SHARE).length,
    coalitionMonths: months.filter((m) => m.coalition.length > 0).length,
    coalitionLast: last?.coalition ?? [],
    coalitionStrRatio: mean((m) => (m.ownStr > 0 ? m.coalitionStr / m.ownStr : 0)),
    warMonths: months.filter((m) => m.wars.length > 0).length,
    warsMean: mean((m) => m.wars.length),
    enemyMonths: [...enemies].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, c]) => `${e} ${c}`),
    menRatio: mean((m) => {
      const own = m.wars.reduce((a, x) => a + x.own, 0);
      const th = m.wars.reduce((a, x) => a + x.theirs, 0);
      return own > 0 && m.wars.length > 0 ? th / own : 0;
    }),
    exhOwn: mean((m) => (m.wars.length ? Math.max(...m.wars.map((x) => x.exh[0])) : 0)),
    provinces: last?.provinces ?? 0,
    nonCore: last?.nonCore ?? 0,
    far: last?.far ?? 0,
    farCore: last?.farCore ?? 0,
    farUnrest: mean((m) => m.farUnrest),
    farRestless: mean((m) => m.farRestless),
    suppression: mean((m) => m.suppression),
    gold: Math.round(last?.gold ?? 0),
    revolts,
    ceded,
  };
  rows.push(row);
  process.stderr.write(`seed ${seed} ${JSON.stringify(row)} ${Math.round((Date.now() - t0) / 1000)} s\n`);
  if (saves.has(y)) writeFileSync(`${base}_y${y}.bin`, sim.save());
}
writeFileSync(`${base}.json`, JSON.stringify(rows, null, 1));
process.stdout.write(`done: seed ${seed}\n`);
