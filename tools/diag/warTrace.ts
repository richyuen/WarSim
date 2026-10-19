/**
 * PLAN 7.27b: one war traced from a checkpoint to its end, and the years after it. From `--load`,
 * day by day (after the day's 24 hours), the first war with `--a` leading one side and `--d` on
 * the other:
 * - its score, both exhaustions and the defender's split into 0.1·days, 80·lost and 60·share
 *   (`war.ts`'s terms), its age, `War.frontless`, both leaders' gold;
 * - the defender's land, the km² of it held by the attackers' side, and the day's change;
 * - weekly, the land formations of the attacker (the leader alone, and the rest of its side) by
 *   where they stand: pressing (within PRESS cells of this war's front, where the ground flips:
 *   `territory.ts`'s PRESSURE_RADIUS), engaged elsewhere, near this front (within
 *   DEPLOY_RANGE_CELLS, still or moving), on the retreat or a march home, at sea or aboard, on
 *   another nav component than every front cell, near another war's front, standing far (still,
 *   beyond the range), marching far; with men. And the defender's land formations and men.
 * - how it ended: the branch of `makePeace` read from the war's last values (capitulation, the
 *   five years, frontless, a leader broke, exhausted, crushed, stalemate), the land taken, the
 *   truce.
 * After the end, to `--until` (years from 1938): every declaration and peace that names the
 * defender, and monthly for the attacker and `--watch` nations: wars, `whyNotWar` on the defender.
 *
 * Usage: npx tsx tools/diag/warTrace.ts --load .cache/727/s732-y25.bin --a GER --d SOV
 *        [--seed 732] [--nth 1] [--until 32] [--watch JAP,POL] [--out .cache/727/trace732.json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../headless/assets';
import { EventKind } from '../../src/shared/events';
import { Refusal } from '../../src/shared/commands';
import { isMonthStart } from '../../src/shared/calendar';
import { neighbours4 } from '../../src/sim/nav/grid';
import { frontierOf, PRESSURE_RADIUS } from '../../src/sim/systems/territory';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { STALEMATE_DAYS, STALEMATE_EXHAUSTION, STALEMATE_SCORE } from '../../src/sim/ai/strategic';
import { forceMen } from '../../src/sim/systems/seaControl';
import { CRUSHED, EXHAUSTED, FRONTLESS_DAYS, MAX_WAR_DAYS, menLost, whyNotWar } from '../../src/sim/systems/war';
import { ATTACKERS, DEFENDERS, type War } from '../../src/sim/wars';
import { navOf } from '../../src/sim/world';

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1]! : d;
};
const load = arg('load', '');
if (!load || !existsSync(load)) throw new Error(`--load: no file '${load}'`);
const byTag = (t: string): number => {
  const i = TAGS_1938.indexOf(t);
  if (i >= 0) return i + 1;
  if (t.startsWith('#')) return Number(t.slice(1));
  throw new Error(`no nation '${t}'`);
};
const A0 = byTag(arg('a', 'GER'));
const D0 = byTag(arg('d', 'SOV'));
const until = Number(arg('until', '32'));
/** Which war of the two to trace: the first (1) or a later one. */
const nth = Number(arg('nth', '1'));
const skipped = new Set<number>();
const watch = arg('watch', 'JAP,POL').split(',').filter(Boolean).map(byTag);
const out = arg('out', `.cache/warTrace_${arg('a', 'GER')}_${arg('d', 'SOV')}.json`);
/** Pressing: within the pressure's reach of a front cell, and a cell of slack for where it stands in its cell. */
const PRESS = PRESSURE_RADIUS + 1;
const TICKS_PER_DAY = 24;
const TICKS_PER_YEAR = 365 * TICKS_PER_DAY;

const sim = new Sim({ scenario: '1938', seed: Number(arg('seed', '0')), assets: loadAssets1938(SIZE_1938.w) });
sim.load(new Uint8Array(readFileSync(load)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const refusalName = new Map<number, string>(Object.entries(Refusal).map(([k, v]) => [v as number, k]));
const cw = w.cells.w;
const ch = w.cells.h;
const wrap = w.settings.loopingMap;
const cellOf = (id: number): number => Math.floor(w.formations.cols.y[id]!) * cw + Math.floor(w.formations.cols.x[id]!);
const isLand = (id: number): boolean => !w.isFleet(id) && !w.isWing(id);
const dist = (id: number, k: number): number => {
  const c = w.formations.cols;
  let dx = Math.abs(c.x[id]! - ((k % cw) + 0.5));
  if (wrap && dx > cw / 2) dx = cw - dx;
  return Math.max(dx, Math.abs(c.y[id]! - (Math.floor(k / cw) + 0.5)));
};
const nearest = (id: number, cells: readonly number[]): number => {
  let best = Infinity;
  for (const k of cells) best = Math.min(best, dist(id, k));
  return best;
};

/** The cells held by side `s` of `war` that touch a cell held by the other side. */
function frontCells(war: War, s: number): number[] {
  const mine = new Set(war.sides[s]);
  const theirs = new Set(war.sides[1 - s]);
  const ctl = w.cells.controller;
  const nb: number[] = [];
  const outCells: number[] = [];
  for (const c of frontierOf(w)) {
    if (!mine.has(ctl[c]!)) continue;
    if (neighbours4(c, cw, ch, wrap, nb).some((k) => theirs.has(ctl[k]!))) outCells.push(c);
  }
  return outCells;
}

const KINDS = ['pressing', 'engagedElsewhere', 'nearStill', 'nearMoving', 'retreatOrHome', 'sea', 'otherComponent', 'otherFront', 'farStill', 'farMoving'] as const;
type Kind = (typeof KINDS)[number];
type Tally = Record<Kind, { n: number; men: number }>;
const tally = (): Tally => Object.fromEntries(KINDS.map((k) => [k, { n: 0, men: 0 }])) as Tally;

function standing(war: War, s: number): { leader: Tally; rest: Tally; frontLen: number; enemy: { n: number; men: number; engaged: number } } {
  const front = frontCells(war, s);
  const others = w.wars.list.filter((x) => x !== war);
  const comp = navOf(w).grid.component;
  const frontComps = new Set(front.map((k) => comp[k]!));
  const side = new Set(war.sides[s]);
  const enemySide = new Set(war.sides[1 - s]);
  const leader = tally();
  const rest = tally();
  const enemy = { n: 0, men: 0, engaged: 0 };
  const otherFront = new Map<number, number[]>();
  const c = w.formations.cols;
  const range = w.atSize(DEPLOY_RANGE_CELLS);
  w.formations.forEach((id) => {
    if (!isLand(id)) return;
    const n = c.nation[id]!;
    const men = forceMen(w, id);
    if (enemySide.has(n)) {
      if (w.offLand(id) || w.embarked.has(id)) return;
      enemy.n++;
      enemy.men += men;
      if (c.engaged[id] === 1) enemy.engaged++;
      return;
    }
    if (!side.has(n)) return;
    const t = n === war.sides[s]![0] ? leader : rest;
    const put = (k: Kind): void => {
      t[k].n++;
      t[k].men += men;
    };
    if (w.offLand(id) || w.embarked.has(id)) return put('sea');
    const d = front.length > 0 ? nearest(id, front) : Infinity;
    if (d <= w.atSize(PRESS)) return put('pressing');
    if (c.engaged[id] === 1) return put('engagedElsewhere');
    if (c.retreat[id]! > 0 || c.home[id]! > 0) return put('retreatOrHome');
    if (d <= range) return put(c.moving[id] === 1 ? 'nearMoving' : 'nearStill');
    if (!frontComps.has(comp[cellOf(id)]!)) return put('otherComponent');
    for (const o of others) {
      const os = o.sides[0].includes(n) ? 0 : o.sides[1].includes(n) ? 1 : -1;
      if (os < 0) continue;
      let f = otherFront.get(o.id * 2 + os);
      if (!f) otherFront.set(o.id * 2 + os, (f = frontCells(o, os)));
      if (f.length > 0 && nearest(id, f) <= range) return put('otherFront');
    }
    put(c.moving[id] === 1 ? 'farMoving' : 'farStill');
  });
  return { leader, rest, frontLen: front.length, enemy };
}

const landOf = (n: readonly number[]): number => n.reduce((s, x) => s + (w.landCounts().owned[x] ?? 0), 0);
const held = (occupiers: readonly number[], victims: readonly number[]): number => {
  const lc = w.landCounts();
  let k = 0;
  for (const v of victims) for (const o of occupiers) k += lc.occupied.get(v * 65536 + o) ?? 0;
  return k;
};

let war: War | null = null;
let side = ATTACKERS;
const days: unknown[] = [];
const weeks: unknown[] = [];
const after: unknown[] = [];
const events: string[] = [];
let ended: Record<string, unknown> | null = null;
let lastHeld = 0;
const startTick = w.tick;
const year = (): number => w.tick / TICKS_PER_YEAR;
const t0 = Date.now();
process.stderr.write(`loaded year ${year().toFixed(2)} (tick ${w.tick})\n`);

while (year() < until) {
  const fresh: { kind: number; a: number; b: number }[] = [];
  sim.step(TICKS_PER_DAY, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1]!;
      if (kind === EventKind.WarDeclared || kind === EventKind.PeaceSigned) fresh.push({ kind, a: ev[i + 2]!, b: ev[i + 3]! });
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const day = (w.tick - startTick) / TICKS_PER_DAY;
  const when = `y${year().toFixed(2)} d${day}`;
  for (const e of fresh) {
    const named = [e.a, e.b].some((x) => x === D0 || x === A0 || watch.includes(x));
    if (!named) continue;
    events.push(`${when} ${e.kind === EventKind.WarDeclared ? 'war' : 'peace'} ${tag(e.a)} ${e.kind === EventKind.WarDeclared ? '→' : '/'} ${tag(e.b)}`);
  }
  if (!war && !ended) {
    war = w.wars.list.find((x) => !skipped.has(x.id) && ((x.sides[0][0] === A0 && x.sides[1].includes(D0)) || (x.sides[1][0] === A0 && x.sides[0].includes(D0)))) ?? null;
    if (war && skipped.size < nth - 1) {
      skipped.add(war.id);
      war = null;
    }
    if (war) {
      side = war.sides[0][0] === A0 ? ATTACKERS : DEFENDERS;
      lastHeld = held(war.sides[side]!, war.sides[1 - side]!);
      process.stderr.write(`${when}: war ${war.id} found, ${(w.tick - war.startTick) / 24} days old, sides ${war.sides[0].map(tag).join(' ')} v ${war.sides[1].map(tag).join(' ')}\n`);
    }
    continue;
  }
  if (war && !w.wars.list.includes(war)) {
    // The war's last values are those of the day it ended (`warSystem` sets them before `makePeace`).
    const age = (w.tick - TICKS_PER_DAY - war.startTick) / 24;
    const nc = w.nations.cols;
    const own = side === ATTACKERS ? war.score : -war.score;
    const leaders = war.sides.map((x) => x[0]!);
    const why: string[] = [];
    if (Math.abs(war.score) === 100) why.push('capitulation (±100)');
    if (age >= MAX_WAR_DAYS) why.push('MAX_WAR_DAYS');
    if ((war.frontless ?? 0) >= FRONTLESS_DAYS) why.push('FRONTLESS_DAYS');
    for (const s of [ATTACKERS, DEFENDERS]) {
      const l = leaders[s]!;
      if (nc.gold[l]! < 0 || nc.bankrupt[l] === 1) why.push(`${tag(l)} broke`);
      if (war.exhaustion[s]! >= EXHAUSTED) why.push(`${tag(l)} exhausted (${war.exhaustion[s]!.toFixed(1)})`);
      if ((s === ATTACKERS ? war.score : -war.score) <= -CRUSHED) why.push(`${tag(l)} crushed`);
    }
    if (age >= STALEMATE_DAYS && Math.abs(war.score) < STALEMATE_SCORE && war.exhaustion[0]! > STALEMATE_EXHAUSTION && war.exhaustion[1]! > STALEMATE_EXHAUSTION) why.push('stalemate');
    const truce = w.wars.truces.find((t) => (t.a === A0 && t.b === D0) || (t.a === D0 && t.b === A0));
    ended = {
      day, year: +year().toFixed(2), age, score: war.score, ownScore: own, exhaustion: war.exhaustion.map((x) => +x.toFixed(1)), frontless: war.frontless ?? 0,
      why, truceDays: truce ? (truce.untilTick - w.tick) / 24 : null, landA: landOf([A0]), landD: landOf([D0]),
    };
    process.stderr.write(`${when}: war ended ${JSON.stringify(ended)}\n`);
    war = null;
    continue;
  }
  if (war) {
    const age = (w.tick - war.startTick) / 24;
    const victims = war.sides[1 - side]!;
    const h = held(war.sides[side]!, victims);
    const dLand = landOf(victims);
    const ds = 1 - side;
    const lost = menLost(w, war, ds);
    days.push({
      day, age, score: war.score, ownScore: side === ATTACKERS ? war.score : -war.score, exA: +war.exhaustion[side]!.toFixed(1), exD: +war.exhaustion[ds]!.toFixed(1),
      exDdays: +(0.1 * age).toFixed(1), exDlost: +(80 * lost).toFixed(1), exDshare: +(60 * (dLand > 0 ? h / dLand : 0)).toFixed(1),
      frontless: war.frontless ?? 0, heldKm2: h, dHeldKm2: h - lastHeld, landD: dLand, landA: landOf([A0]), goldA: Math.round(w.nations.cols.gold[A0]!), goldD: Math.round(w.nations.cols.gold[D0]!),
      sideA: war.sides[side]!.length, sideD: victims.length,
    });
    lastHeld = h;
    if (day % 7 === 0) weeks.push({ day, age, ...standing(war, side) });
    if (day % 30 === 0) process.stderr.write(`${when}: age ${age}, score ${war.score}, ex ${war.exhaustion.map((x) => x.toFixed(0)).join('/')}, held ${(h / 1e6).toFixed(2)} M km², ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
    continue;
  }
  if (ended && isMonthStart(w.startDay, w.tick)) {
    const row: Record<string, unknown> = { day, year: +year().toFixed(2), landD: landOf([D0]) };
    for (const n of [A0, ...watch]) {
      const wars = w.wars.list.filter((x) => x.sides[0].includes(n) || x.sides[1].includes(n));
      row[tag(n)] = { wars: wars.map((x) => `${tag(x.sides[0][0]!)}v${tag(x.sides[1][0]!)}`), onD: refusalName.get(whyNotWar(w, n, D0)) ?? String(whyNotWar(w, n, D0)), gold: Math.round(w.nations.cols.gold[n]!) };
    }
    after.push(row);
  }
}
writeFileSync(out, JSON.stringify({ load, a: tag(A0), d: tag(D0), ended, events, days, weeks, after }, null, 1));
process.stderr.write(`done: ${out}, ${days.length} war days, ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
