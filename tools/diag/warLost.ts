/**
 * PLAN 7.27c's measures (1) and (2), from a checkpoint to `--until` (years from 1938):
 * (1) for every war with `--a` leading one side and `--d` on the other, daily: the defender side's
 *     `startMen`, its men by kind (`menOf`'s terms: land formations on land, land formations off
 *     land, i.e. at sea or aboard, fleets' and wings' weight), `lost` as `war.ts` reads it, and
 *     who joined or left the side that day (and whether the one who left still lives). The men a
 *     nation that left took with it are the day before's of that nation.
 * (2) monthly, for `--d` (and `--watch`), the first gate of the economic AI's army orders
 *     (`ai/economic.ts` step 3, as `tools/diag/armies.ts` reads it) with income, balance, need,
 *     army upkeep against its cap, gold, manpower, orders in training and the land army.
 *
 * Usage: npx tsx tools/diag/warLost.ts --load .cache/727/s732-y25.bin --seed 732 --a GER --d SOV
 *        [--until 31.6] [--out .cache/727/lost732.json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../headless/assets';
import { isMonthStart } from '../../src/shared/calendar';
import { DAYS_PER_MONTH } from '../../src/sim/systems/research';
import { ARMY_SHARE_WAR, budgetOf, MAX_PARALLEL, PARALLEL_INCOME, peaceShare, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { forceMen } from '../../src/sim/systems/seaControl';
import { menLost } from '../../src/sim/systems/war';
import { ATTACKERS, DEFENDERS, type War } from '../../src/sim/wars';
import { Domain } from '../../src/sim/world';

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
const watch = [D0, ...arg('watch', '').split(',').filter(Boolean).map(byTag)];
const until = Number(arg('until', '31.6'));
const out = arg('out', '.cache/warLost.json');
const TICKS_PER_YEAR = 365 * 24;

const sim = new Sim({ scenario: '1938', seed: Number(arg('seed', '0')), assets: loadAssets1938(SIZE_1938.w) });
sim.load(new Uint8Array(readFileSync(load)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const T = ECONOMY_TABLES_1938;
const upkeepOfTemplate = (t: number): number => UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) || 0;
const isLandTemplate = (t: number): boolean => w.rules?.templates[t]?.domain === Domain.land;
const year = (): number => w.tick / TICKS_PER_YEAR;

/** Per nation: men of land formations on land, off land, and of fleets and wings (`forceMen`). */
function menByKind(): Map<number, { land: number; off: number; navy: number }> {
  const m = new Map<number, { land: number; off: number; navy: number }>();
  w.formations.forEach((id) => {
    const men = forceMen(w, id);
    if (!(men > 0)) return;
    const n = w.formations.cols.nation[id]!;
    const e = m.get(n) ?? { land: 0, off: 0, navy: 0 };
    if (w.isFleet(id) || w.isWing(id)) e.navy += men;
    else if (w.offLand(id)) e.off += men;
    else e.land += men;
    m.set(n, e);
  });
  return m;
}
const total = (e: { land: number; off: number; navy: number } | undefined): number => (e ? e.land + e.off + e.navy : 0);

const traced = (war: War): number => (war.sides[ATTACKERS][0] === A0 && war.sides[DEFENDERS].includes(D0) ? DEFENDERS : war.sides[DEFENDERS][0] === A0 && war.sides[ATTACKERS].includes(D0) ? ATTACKERS : -1);

type DayRow = Record<string, unknown>;
const wars = new Map<number, { id: number; from: number; side0: string[]; days: DayRow[]; prevSide: number[]; prevMen: Map<number, number>; end?: Record<string, unknown> }>();
const months: Record<string, unknown>[] = [];
const t0 = Date.now();

while (year() < until) {
  sim.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  // (1) The traced wars, after the day's war pass (it ran at the day's first tick).
  const byKind = menByKind();
  const seen = new Set<number>();
  for (const war of w.wars.list) {
    const s = traced(war);
    if (s < 0) continue;
    seen.add(war.id);
    let t = wars.get(war.id);
    const side = war.sides[s]!;
    if (!t) {
      t = { id: war.id, from: +year().toFixed(3), side0: side.map(tag), days: [], prevSide: [...side], prevMen: new Map() };
      wars.set(war.id, t);
    }
    const joined = side.filter((n) => !t!.prevSide.includes(n));
    const left = t.prevSide.filter((n) => !side.includes(n)).map((n) => ({ n: tag(n), living: w.nations.cols.living[n] === 1, menBefore: Math.round(t!.prevMen.get(n) ?? 0) }));
    let land = 0, off = 0, navy = 0;
    for (const n of side) {
      const e = byKind.get(n);
      if (!e) continue;
      land += e.land;
      off += e.off;
      navy += e.navy;
    }
    const day = Math.round((w.tick - war.startTick) / 24);
    t.days.push({
      day,
      startMen: Math.round(war.startMen[s]!),
      land: Math.round(land),
      off: Math.round(off),
      navy: Math.round(navy),
      lost: +menLost(w, war, s).toFixed(3),
      exh: +war.exhaustion[s]!.toFixed(1),
      score: war.score,
      members: side.length,
      ...(joined.length > 0 ? { joined: joined.map(tag) } : {}),
      ...(left.length > 0 ? { left } : {}),
      d0: { land: Math.round(byKind.get(D0)?.land ?? 0), off: Math.round(byKind.get(D0)?.off ?? 0), navy: Math.round(byKind.get(D0)?.navy ?? 0) },
    });
    t.prevSide = [...side];
    t.prevMen = new Map(side.map((n) => [n, total(byKind.get(n))]));
  }
  for (const t of wars.values()) {
    if (t.end || seen.has(t.id)) continue;
    t.end = { year: +year().toFixed(3), lastDay: t.days.at(-1) };
    process.stderr.write(`war ${t.id} ended ${t.end.year}\n`);
  }
  // (2) The month's AI runs at this tick: its gates for the watched nations.
  if (!isMonthStart(w.startDay, w.tick) || !w.rules) continue;
  const f = w.formations.cols;
  const nc = w.nations.cols;
  const army = new Map<number, number>();
  const men = new Map<number, number>();
  const count = new Map<number, number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const n = f.nation[id]!;
    const tt = f.template[id]!;
    const full = T.templateStrength[tt] ?? 0;
    if (full > 0) army.set(n, (army.get(n) ?? 0) + (UPKEEP_SCALE * (T.templateUpkeep[tt] ?? 0) * f.strength[id]!) / full);
    men.set(n, (men.get(n) ?? 0) + f.strength[id]!);
    count.set(n, (count.get(n) ?? 0) + 1);
  });
  const pending = new Map<number, number>();
  const training = new Map<number, number>();
  w.production.forEach((id) => {
    const tt = w.production.cols.template[id]!;
    if (!isLandTemplate(tt)) return;
    const n = w.production.cols.nation[id]!;
    pending.set(n, (pending.get(n) ?? 0) + 1);
    training.set(n, (training.get(n) ?? 0) + upkeepOfTemplate(tt));
  });
  const acc = monthlyAccounts(w, T);
  const inf = w.rules.templates[BUILD_MIX_1938.infantry]!;
  const infUpkeep = upkeepOfTemplate(BUILD_MIX_1938.infantry);
  const atWar = w.wars.nations();
  for (const n of watch) {
    if (nc.living[n] !== 1) continue;
    const { income, need } = budgetOf(w, n, acc);
    let { balance } = budgetOf(w, n, acc);
    const raw = balance;
    balance -= nc.research[n]! * DAYS_PER_MONTH + (training.get(n) ?? 0);
    const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
    const upkeep = (army.get(n) ?? 0) + (training.get(n) ?? 0);
    const cap = atWar.has(n) ? ARMY_SHARE_WAR * income : peaceShare(nc.aggression[n]!) * income;
    const gate =
      (pending.get(n) ?? 0) >= slots ? 'slots'
      : upkeep >= cap ? 'cap'
      : balance - infUpkeep <= need ? 'balance'
      : nc.gold[n]! < inf.gold + RESERVE_MONTHS * income ? 'gold'
      : nc.manpower[n]! < inf.manpower ? 'manpower'
      : 'orders';
    months.push({
      year: +year().toFixed(2),
      n: tag(n),
      war: atWar.has(n),
      gate,
      income: Math.round(income),
      balance: Math.round(raw),
      research: Math.round(nc.research[n]! * DAYS_PER_MONTH),
      need: Math.round(need),
      upkeep: Math.round(upkeep),
      cap: Math.round(cap),
      gold: Math.round(nc.gold[n]!),
      manpower: Math.round(nc.manpower[n]!),
      pending: pending.get(n) ?? 0,
      slots,
      formations: count.get(n) ?? 0,
      men: Math.round(men.get(n) ?? 0),
      infGold: inf.gold,
      infUpkeep: +infUpkeep.toFixed(1),
    });
  }
}
writeFileSync(out, JSON.stringify({ load, until, wars: [...wars.values()].map(({ prevSide: _p, prevMen: _m, ...t }) => t), months }, null, 1));
process.stderr.write(`done: ${((Date.now() - t0) / 60000).toFixed(1)} min, ${wars.size} wars, ${months.length} month rows -> ${out}\n`);
