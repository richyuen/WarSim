/**
 * PLAN 7.46a: why a navy the chase sinks (PLAN 7.39b, `docs/evidence/7.39/b-chase.diff`) is not
 * built again at the pace it was sunk. Run with the chase applied to `src/`, and on HEAD for the
 * "before".
 *
 * From 1938, for `years` years:
 * - Each day at 01:00 (an hour after the naval AI): per nation its armed power (`fleetPower`, the
 *   standing and the moving fleets) and its peak since 1938. The world's power lost (an armed
 *   fleet's power fallen since yesterday while it was in a sea battle) and built (the power of an
 *   armed fleet new since yesterday and not handed over).
 * - On each month's start, per living nation that has had an armed fleet and whose armed power is
 *   under DEPLETED of its peak (a "depleted" navy; 0 is a lost one): the first test of the
 *   economic AI's fleet step (`economic.ts` 3b) that stops a warship's order, in the code's order
 *   (`navyLoss.ts`'s), weighted by its power short of the peak; read against the orders placed in
 *   the tick after (`spentArmy`, `spentOther` for a month that passed every test). For
 *   `navyShare`, the navy's upkeep over income (the share it stands at); for `warshipInTraining`,
 *   the days left to the warship in training.
 * - Per depleted spell (from the month a nation goes under DEPLETED to the month it is back over
 *   it, or the run's end): the days from its start to its first warship ordered.
 *
 * Usage: npx tsx tools/diag/navyRebuild.ts <seed> <years> [out = .cache/navyRebuild_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { budgetOf, NAVY_SHARE, pickFleet, POOR_INCOME, wantsTransport } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { shipyard } from '../../src/sim/systems/production';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { Domain, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? `.cache/navyRebuild_${seed}.json`;
const DEPLETED = 0.75;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const kinds = BUILD_MIX_1938.fleets!;
const warships = new Set([kinds.battle, kinds.cruiser, kinds.destroyer]);
const upkeepOf = (t: number): number => UPKEEP_SCALE * (ECONOMY_TABLES_1938.templateUpkeep[t] ?? 0);

const REASONS = ['aiOff', 'noShipyard', 'poor', 'warshipInTraining', 'transportInTraining', 'transportWanted', 'navyShare', 'gold', 'men', 'balance', 'spentArmy', 'spentOther', 'ordered'] as const;
type Reason = (typeof REASONS)[number];
const zero = <K extends string>(ks: readonly K[]): Record<K, number> => Object.fromEntries(ks.map((k) => [k, 0])) as Record<K, number>;

type Year = {
  year: number;
  /** Mean of the days: the world's armed power, and of it the depleted navies' shortfall from their peaks. */
  power: number;
  shortfall: number;
  /** Power lost in sea battles and built (new armed fleets), summed over the year. */
  lostInBattle: number;
  built: number;
  builtFleets: number;
  /** Depleted nation-months by the first test that stops a warship, and the same weighted by the power short (k). */
  months: Record<Reason, number>;
  weighted: Record<Reason, number>;
  /** Of them, lost navies (power 0). */
  lostMonths: Record<Reason, number>;
  /** `navyShare` months by the navy's upkeep over income, in hundredths ('12'..). */
  share: Record<string, number>;
  /** `warshipInTraining` months by the days left to it, in bands. */
  inTraining: Record<string, number>;
};
const rows: Year[] = [];
type Spell = { from: number; to?: number; firstOrder?: number; peak: number; low: number };
type Nat = { tag: string; peak: number; spells: Spell[]; months: Record<Reason, number>; weighted: Record<Reason, number> };
const nations = new Map<number, Nat>();
const nat = (n: number): Nat => {
  let x = nations.get(n);
  if (!x) nations.set(n, (x = { tag: tag(n), peak: 0, spells: [], months: zero(REASONS), weighted: zero(REASONS) }));
  return x;
};

/** Per nation, its armed power now; and per armed fleet its nation and power. */
const armedNow = (w: World): { byNation: Map<number, number>; fleets: Map<number, { n: number; p: number }> } => {
  const c = w.formations.cols;
  const byNation = new Map<number, number>();
  const fleets = new Map<number, { n: number; p: number }>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const p = fleetPower(w, id);
    if (p <= 0) return;
    const n = c.nation[id]!;
    fleets.set(id, { n, p });
    byNation.set(n, (byNation.get(n) ?? 0) + p);
  });
  return { byNation, fleets };
};

let prev = new Map<number, { n: number; p: number }>();
let battled = new Set<number>();
let power = new Map<number, number>();
let pendingMonth: { n: number; reason: Reason; short: number; lost: boolean; rows: Set<string> }[] | null = null;
const rowsOf = (w: World, n: number): Set<string> => {
  const p = w.production.cols;
  const s = new Set<string>();
  w.production.forEach((id) => {
    if (p.nation[id] === n) s.add(`${id}:${p.template[id]}:${p.readyDay[id]}`);
  });
  return s;
};

const daily = (w: World, y: Year, day: number): void => {
  const { byNation, fleets } = armedNow(w);
  for (const [id, f] of fleets) {
    const was = prev.get(id);
    if (!was && day > 0) {
      y.built += f.p;
      y.builtFleets++;
    } else if (was && battled.has(id) && f.p < was.p) y.lostInBattle += was.p - f.p;
  }
  for (const [id, was] of prev) if (!fleets.has(id) && battled.has(id)) y.lostInBattle += was.p;
  battled = new Set();
  prev = fleets;
  power = byNation;
  let world = 0;
  let short = 0;
  for (const [n, p] of byNation) {
    world += p;
    const x = nat(n);
    if (p > x.peak) x.peak = p;
  }
  for (const [n, x] of nations) {
    const p = byNation.get(n) ?? 0;
    if (w.nations.cols.living[n] === 1 && p < DEPLETED * x.peak) short += x.peak - p;
  }
  y.power += world;
  y.shortfall += short;
};

const monthRead = (w: World, y: Year, day: number): void => {
  const nc = w.nations.cols;
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const f = w.formations.cols;
  const fleets = new Map<number, number[]>();
  const navy = new Map<number, number>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const n = f.nation[id]!;
    (fleets.get(n) ?? fleets.set(n, []).get(n)!).push(id);
    const t = f.template[id]!;
    const full = ECONOMY_TABLES_1938.templateStrength[t] ?? 0;
    // The share's build test reads the armed fleets' upkeep (PLAN 7.46b1, ADR-574).
    if (fleetPower(w, id) > 0) navy.set(n, (navy.get(n) ?? 0) + (full > 0 ? (upkeepOf(t) * f.strength[id]!) / full : 0));
  });
  const warshipLeft = new Map<number, number>();
  const transportPending = new Set<number>();
  const training = new Map<number, number>();
  const p = w.production.cols;
  w.production.forEach((id) => {
    const n = p.nation[id]!;
    const t = p.template[id]!;
    const dom = w.rules?.templates[t]?.domain;
    if (dom === Domain.sea) {
      if (t === kinds.transport) transportPending.add(n);
      else warshipLeft.set(n, Math.max(warshipLeft.get(n) ?? 0, p.readyDay[id]! - day));
    } else if (dom !== Domain.air) training.set(n, (training.get(n) ?? 0) + upkeepOf(t));
  });
  pendingMonth = [];
  for (const [n, x] of nations) {
    if (nc.living[n] !== 1) continue;
    const now = power.get(n) ?? 0;
    const spell = x.spells.at(-1);
    const open = spell !== undefined && spell.to === undefined;
    if (now >= DEPLETED * x.peak) {
      if (open) spell.to = day;
      continue;
    }
    if (!open) x.spells.push({ from: day, peak: Math.round(x.peak), low: Math.round(now) });
    else spell.low = Math.min(spell.low, Math.round(now));
    const { income, balance, need } = budgetOf(w, n, acc);
    const atWar = w.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
    let reason: Reason | undefined;
    if (!w.settings.aiEnabled || nc.aiOff[n] === 1) reason = 'aiOff';
    else if (shipyard(w, n) < 0) reason = 'noShipyard';
    else if (income < POOR_INCOME) reason = 'poor';
    else if (warshipLeft.has(n)) {
      reason = 'warshipInTraining';
      const d = warshipLeft.get(n)!;
      const b = d <= 90 ? 'le90' : d <= 180 ? 'le180' : d <= 365 ? 'le365' : 'more';
      y.inTraining[b] = (y.inTraining[b] ?? 0) + 1;
    } else if (transportPending.has(n)) reason = 'transportInTraining';
    else if (atWar && wantsTransport(w, n, kinds.transport, fleets.get(n) ?? [])) reason = 'transportWanted';
    else if ((navy.get(n) ?? 0) >= NAVY_SHARE * income) {
      reason = 'navyShare';
      const k = String(Math.min(50, Math.round((100 * (navy.get(n) ?? 0)) / Math.max(1, income))));
      y.share[k] = (y.share[k] ?? 0) + 1;
    } else {
      const t = pickFleet(w, n, income, kinds);
      if (t < 0) reason = 'gold';
      else if (nc.manpower[n]! < w.rules!.templates[t]!.manpower) reason = 'men';
      else if (balance - (training.get(n) ?? 0) - upkeepOf(t) <= need) reason = 'balance';
    }
    pendingMonth.push({ n, reason: reason ?? 'ordered', short: x.peak - now, lost: now === 0, rows: rowsOf(w, n) });
  }
};

const monthDone = (w: World, y: Year, day: number): void => {
  const p = w.production.cols;
  for (const m of pendingMonth ?? []) {
    let warship = false;
    let land = 0;
    w.production.forEach((id) => {
      if (p.nation[id] !== m.n || m.rows.has(`${id}:${p.template[id]}:${p.readyDay[id]}`)) return;
      const t = p.template[id]!;
      if (warships.has(t)) warship = true;
      else if (w.rules?.templates[t]?.domain === Domain.land) land++;
    });
    let reason = m.reason;
    if (reason === 'ordered' && !warship) reason = land > 0 ? 'spentArmy' : 'spentOther';
    const x = nat(m.n);
    if (warship) {
      const s = x.spells.at(-1);
      if (s && s.firstOrder === undefined) s.firstOrder = day - s.from;
    }
    y.months[reason]++;
    y.weighted[reason] += m.short / 1000;
    if (m.lost) y.lostMonths[reason]++;
    x.months[reason]++;
    x.weighted[reason] += m.short / 1000;
  }
  pendingMonth = null;
};

const t0 = Date.now();
let day = 0;
for (let year = 1; year <= years; year++) {
  const y: Year = { year, power: 0, shortfall: 0, lostInBattle: 0, built: 0, builtFleets: 0, months: zero(REASONS), weighted: zero(REASONS), lostMonths: zero(REASONS), share: {}, inTraining: {} };
  let days = 0;
  sim.step(24 * 365, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    for (const id of prev.keys()) if (seaRangeOf(w, id) !== undefined) battled.add(id);
    if (pendingMonth) monthDone(w, y, day);
    if (isMonthStart(w.startDay, w.tick)) monthRead(w, y, day);
    if (w.tick % 24 === 1) {
      daily(w, y, day);
      day++;
      days++;
    }
  });
  y.power = Math.round(y.power / Math.max(1, days));
  y.shortfall = Math.round(y.shortfall / Math.max(1, days));
  y.lostInBattle = Math.round(y.lostInBattle);
  y.built = Math.round(y.built);
  for (const k of REASONS) y.weighted[k] = Math.round(y.weighted[k] * 10) / 10;
  rows.push(y);
  console.log(JSON.stringify({ year, power: y.power, shortfall: y.shortfall, lost: y.lostInBattle, built: y.built, months: y.months }));
}
for (const x of nations.values()) for (const k of REASONS) x.weighted[k] = Math.round(x.weighted[k] * 10) / 10;
writeFileSync(out, JSON.stringify({ seed, years, depleted: DEPLETED, wallS: Math.round((Date.now() - t0) / 1000), rows, nations: Object.fromEntries([...nations].filter(([, x]) => x.spells.length > 0)) }, null, 1));
console.log(`done: ${out}`);
