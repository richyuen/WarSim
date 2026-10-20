/**
 * PLAN 7.39b: how a war of two navies begins, in year 1 and later (critic R10-B2; 7.39a's measure,
 * `docs/evidence/7.39/measure-a.md` §5: the hunts fell × 7.8 after year 1, the sorties from port
 * × 3.8, the battles × 8.3).
 *
 * From 1938, for `years` years:
 * - daily at 01:00 (an hour after the naval AI), each war on the first day its two sides both have
 *   an armed fleet (`fleetPower` over 0; `late`: the days since its start): each side's armed
 *   fleets by state (`moving`, `engaged`, `home` at its bloc's port, `stThis` on station at a port
 *   of this war's enemy side, `stOther` at a port of a nation at war with it in another war,
 *   `stPeace` at a port of a nation not at war with it, `sea` away and by no port), what `plan`
 *   does with each (`sortieWhy`), and the km between the two sides' nearest armed fleets (and of
 *   the same waters, `waterKeys`). The 1938 world's wars of day 1 are marked `initial`.
 * - each war so recorded: the sea battles between its sides in its first 30 and 90 days.
 * - each sea battle at its first hour: its war's age in days, where it began (by a port of side
 *   a's bloc, of side b's bloc, of another's, or at sea), and each side's fleets that were under
 *   way the hour before (the hunter) or stood (the prey).
 *
 * Usage: npx tsx tools/diag/seaStart.ts <seed> [years = 30] [out = .cache/seaStart_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { blocOf } from '../../src/sim/systems/supply';
import { keyAt, waterKeys } from '../../src/sim/ai/naval';
import { portSeaOf, type SeaBattle, type World } from '../../src/sim/world';
import { sortieWhy, whyCtx } from './seaWhy';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/seaStart_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const DAY = 24;

type State = 'moving' | 'engaged' | 'home' | 'stThis' | 'stOther' | 'stPeace' | 'sea';
interface Side {
  nations: string[];
  fleets: number;
  state: Partial<Record<State, number>>;
  why: Record<string, number>;
}
interface WarStart {
  id: number;
  day: number;
  year: number;
  initial: boolean;
  /** Days from the war's start to the day it was first a war of two navies (a navy joined, or was built). */
  late: number;
  sides: [Side, Side];
  /** km between the two sides' nearest armed fleets; of the same waters (-1: none). */
  km: number;
  kmSame: number;
  b30: number;
  b90: number;
}
interface Battle {
  day: number;
  year: number;
  war: number;
  warAge: number;
  place: 'portA' | 'portB' | 'portOther' | 'sea';
  movedA: number;
  stoodA: number;
  movedB: number;
  stoodB: number;
  /** Ships each side lost in the battle, read when its record ends. */
  lostA: number;
  lostB: number;
}
const wars: WarStart[] = [];
const battles: Battle[] = [];
const seenWar = new Set<number>();
const seenBattle = new WeakSet<SeaBattle>();
const live = new Map<SeaBattle, Battle>();
const t0 = Date.now();
let fleets: number[] = [];
let moving = new Map<number, number>();

const cellOf = (w: World, g: number): number => Math.floor(w.formations.cols.y[g]!) * w.cells.w + Math.floor(w.formations.cols.x[g]!);
/** The holder of the port whose water is within `AT_PORT_CELLS` of cell `cell` (the nearest by rows and columns), or 0. */
const portHolder = (w: World, cell: number): number => {
  const water = portSeaOf(w);
  const ww = w.cells.w;
  const r = w.atSize(AT_PORT_CELLS);
  let best = Infinity;
  let h = 0;
  w.ports.forEach((p, i) => {
    const at = water[i]!;
    if (at < 0) return;
    let dx = Math.abs((at % ww) - (cell % ww));
    if (w.settings.loopingMap && dx > ww / 2) dx = ww - dx;
    const dy = Math.abs(Math.floor(at / ww) - Math.floor(cell / ww));
    if (dx > r || dy > r) return;
    const holder = w.cells.controller[p.cell]!;
    if (holder !== 0 && dx + dy < best) [best, h] = [dx + dy, holder];
  });
  return h;
};

const armedOf = (w: World): Map<number, number[]> => {
  const m = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id) || fleetPower(w, id) <= 0) return;
    const n = w.formations.cols.nation[id]!;
    let l = m.get(n);
    if (!l) m.set(n, (l = []));
    l.push(id);
  });
  return m;
};

const startWar = (w: World, war: World['wars']['list'][number], armed: Map<number, number[]>, initial: boolean): void => {
  const c = w.formations.cols;
  const ctx = whyCtx(w);
  const sides: Side[] = [];
  const lists: number[][] = [];
  for (const s of [0, 1] as const) {
    const enemies = new Set(war.sides[1 - s]);
    const side: Side = { nations: war.sides[s].filter((n) => armed.has(n)).map(tag), fleets: 0, state: {}, why: {} };
    const list: number[] = [];
    for (const n of war.sides[s]) {
      const bloc = blocOf(w, n);
      for (const f of armed.get(n) ?? []) {
        list.push(f);
        side.fleets++;
        let st: State;
        if (c.engaged[f] === 1) st = 'engaged';
        else if (c.moving[f] === 1) st = 'moving';
        else {
          const h = portHolder(w, cellOf(w, f));
          if (h === 0) st = 'sea';
          else if (blocOf(w, h) === bloc) st = 'home';
          else if (enemies.has(h)) st = 'stThis';
          else if (w.wars.atWar(n, h)) st = 'stOther';
          else st = 'stPeace';
        }
        side.state[st] = (side.state[st] ?? 0) + 1;
        if (st !== 'moving' && st !== 'engaged') {
          const why = sortieWhy(ctx, f).why;
          side.why[why] = (side.why[why] ?? 0) + 1;
        }
      }
    }
    sides.push(side);
    lists.push(list);
  }
  let km = Infinity;
  let kmSame = Infinity;
  for (const f of lists[0]!) {
    const keys = waterKeys(w, c.nation[f]!);
    const mine = keyAt(w, keys, c.x[f]!, c.y[f]!);
    for (const g of lists[1]!) {
      const d = seaKm(w, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!);
      km = Math.min(km, d);
      if (keyAt(w, keys, c.x[g]!, c.y[g]!) === mine) kmSame = Math.min(kmSame, d);
    }
  }
  const day = Math.floor(w.tick / DAY);
  wars.push({ id: war.id, day, year: Math.floor(day / 365) + 1, initial, late: day - Math.floor(war.startTick / DAY), sides: sides as [Side, Side], km: Math.round(km), kmSame: kmSame === Infinity ? -1 : Math.round(kmSame), b30: 0, b90: 0 });
};

const onBattle = (w: World, rec: SeaBattle): void => {
  const c = w.formations.cols;
  const day = Math.floor(w.tick / DAY);
  const war = w.wars.list.find((x) => (x.sides[0].includes(rec.a) && x.sides[1].includes(rec.b)) || (x.sides[1].includes(rec.a) && x.sides[0].includes(rec.b)));
  const cell = Math.floor(rec.y) * w.cells.w + Math.floor(rec.x);
  const h = portHolder(w, cell);
  const place = h === 0 ? 'sea' : blocOf(w, h) === blocOf(w, rec.a) ? 'portA' : blocOf(w, h) === blocOf(w, rec.b) ? 'portB' : 'portOther';
  const b: Battle = { day, year: Math.floor(day / 365) + 1, war: war?.id ?? -1, warAge: war ? day - Math.floor(war.startTick / DAY) : -1, place, movedA: 0, stoodA: 0, movedB: 0, stoodB: 0, lostA: -1, lostB: -1 };
  for (const f of rec.fleets) {
    const n = c.nation[f]!;
    const a = blocOf(w, n) === blocOf(w, rec.a);
    const m = moving.get(f) === 1;
    if (a && m) b.movedA++;
    else if (a) b.stoodA++;
    else if (m) b.movedB++;
    else b.stoodB++;
  }
  battles.push(b);
  live.set(rec, b);
  if (war) {
    const ws = wars.find((x) => x.id === war.id);
    if (ws) {
      if (day - ws.day <= 30) ws.b30++;
      if (day - ws.day <= 90) ws.b90++;
    }
  }
};

for (let year = 1; year <= years; year++) {
  sim.step(24 * 365, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    for (const [rec, b] of live) {
      if (w.seaBattles.includes(rec)) continue;
      [b.lostA, b.lostB] = [rec.lostA, rec.lostB];
      live.delete(rec);
    }
    for (const rec of w.seaBattles) {
      if (seenBattle.has(rec)) continue;
      seenBattle.add(rec);
      onBattle(w, rec);
    }
    if (w.tick % DAY === 1) {
      const armed = armedOf(w);
      fleets = [...armed.values()].flat();
      for (const war of w.wars.list) {
        if (seenWar.has(war.id)) continue;
        if (!war.sides[0].some((n) => armed.has(n)) || !war.sides[1].some((n) => armed.has(n))) continue;
        seenWar.add(war.id);
        startWar(w, war, armed, w.tick < DAY * 2);
      }
    }
    const m = new Map<number, number>();
    for (const f of fleets) if (w.formations.has(f)) m.set(f, w.formations.cols.moving[f]!);
    moving = m;
  });
  const ws = wars.filter((x) => x.year === year);
  const bs = battles.filter((x) => x.year === year);
  console.log(`year ${year}: wars of two navies begun ${ws.length}, battles ${bs.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
writeFileSync(out, JSON.stringify({ seed, years, wallS: Math.round((Date.now() - t0) / 1000), wars, battles }, null, 1));
console.log(`done: ${out}`);
