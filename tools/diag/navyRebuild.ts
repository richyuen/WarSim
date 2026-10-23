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
 * - PLAN 7.46b3, the gold: per `gold` month, its kind (`<lost|armed>/<peace|navalFoe|landFoe>/
 *   <overPeace|underPeace>`, the last the army with its orders in training against its peacetime
 *   share, which gates ADR-557's saving at war), the armed navy's share of income, and a row:
 *   the treasury against the line (the cheapest warship of its income's kinds and RESERVE_MONTHS
 *   of income), and what the month's AI spent (the economic AI wrapped, as in `navyLoss.ts`).
 *
 * Usage: npx tsx tools/diag/navyRebuild.ts <seed> <years> [out = .cache/navyRebuild_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { budgetOf, fleetPrice, NAVY_SHARE, peaceShare, pickFleet, POOR_INCOME, RESERVE_MONTHS, wantsFerry, wantsTransport } from '../../src/sim/ai/economic';
import type { System } from '../../src/sim/tick';
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
// PLAN 7.46b3: the economic AI wrapped (tool only), as `navyLoss.ts` does: per nation each month the
// treasury before and after the AI, the land orders' gold, the other orders', the refills as the rest.
let aiMonth = new Map<number, { before: number; after: number; army: number; other: number; refill: number }>();
{
  const s = sim as unknown as { systems: readonly System[] };
  const i = s.systems.findIndex((f) => f.name === 'economicAiSystem');
  if (i < 0) throw new Error('economicAiSystem not found');
  const inner = s.systems[i]!;
  s.systems = s.systems.map((f, k) =>
    k !== i
      ? f
      : (w: World): void => {
          if (!isMonthStart(w.startDay, w.tick)) return inner(w);
          const nc = w.nations.cols;
          const before = new Map<number, number>();
          w.nations.forEach((n) => before.set(n, nc.gold[n]!));
          const rows0 = new Map<number, number>();
          w.production.forEach((id) => rows0.set(id, w.production.cols.template[id]!));
          inner(w);
          aiMonth = new Map();
          const orders = new Map<number, { army: number; other: number }>();
          const p = w.production.cols;
          w.production.forEach((id) => {
            if (rows0.get(id) === p.template[id]) return;
            const rule = w.rules!.templates[p.template[id]!]!;
            const o = orders.get(p.nation[id]!) ?? { army: 0, other: 0 };
            if (rule.domain === Domain.land) o.army += rule.gold;
            else o.other += rule.gold;
            orders.set(p.nation[id]!, o);
          });
          for (const [n, g0] of before) {
            const after = nc.gold[n]!;
            const o = orders.get(n) ?? { army: 0, other: 0 };
            aiMonth.set(n, { before: g0, after, army: o.army, other: o.other, refill: Math.max(0, g0 - after - o.army - o.other) });
          }
        },
  );
}
/** Per traced `gold` month: [day, kind, treasury, line (cheapest warship + reserve), income, balance, army's orders, refills, other orders, treasury after, army's upkeep with its orders in training, its peacetime share of income]. */
type GoldRow = [number, string, number, number, number, number, number, number, number, number, number, number];
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
/** `spent`: the `spentArmy` months by `<lost|armed>/<peace|navalFoe|landFoe>` (lost: no armed fleet). */
type Nat = { tag: string; peak: number; spells: Spell[]; months: Record<Reason, number>; weighted: Record<Reason, number>; spent: Record<string, number>; goldKind: Record<string, number>; goldNavyPct: number[]; gold: GoldRow[] };
const nations = new Map<number, Nat>();
const nat = (n: number): Nat => {
  let x = nations.get(n);
  if (!x) nations.set(n, (x = { tag: tag(n), peak: 0, spells: [], months: zero(REASONS), weighted: zero(REASONS), spent: {}, goldKind: {}, goldNavyPct: [], gold: [] }));
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
let pendingMonth: { n: number; reason: Reason; short: number; lost: boolean; foe: string; rows: Set<string>; g?: { gold: number; line: number; income: number; balance: number; overPeace: boolean; navyPct: number; army: number; peace: number } | undefined }[] | null = null;
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
  const armyUp = new Map<number, number>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) {
      if (w.isWing(id) || w.offLand(id)) return;
      const t = f.template[id]!;
      const full = ECONOMY_TABLES_1938.templateStrength[t] ?? 0;
      armyUp.set(f.nation[id]!, (armyUp.get(f.nation[id]!) ?? 0) + (full > 0 ? (upkeepOf(t) * f.strength[id]!) / full : 0));
      return;
    }
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
    } else if (atWar && wantsTransport(w, n, kinds.transport, fleets.get(n) ?? [], ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry] ?? 0)) reason = 'transportWanted';
    // PLAN 7.84d: the ferry's transports in training stop no warship while it wants them (ADR-614).
    else if (transportPending.has(n) && !(atWar && wantsFerry(w, n, fleets.get(n) ?? []))) reason = 'transportInTraining';
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
    // The wars' kind, for a month the army spends (PLAN 7.46b2, ADR-575: the saving at war with an enemy that has an armed fleet).
    const navalFoe = w.wars.list.some((war) => {
      const other = war.sides[0].includes(n) ? war.sides[1] : war.sides[1].includes(n) ? war.sides[0] : undefined;
      return other !== undefined && other.some((m) => (power.get(m) ?? 0) > 0);
    });
    // The army (with its orders in training) over its peacetime share: ADR-557's saving at war holds then; and the armed navy's share of income.
    const overPeace = (armyUp.get(n) ?? 0) + (training.get(n) ?? 0) >= peaceShare(nc.aggression[n]!) * income;
    const g = reason === 'gold' ? { gold: nc.gold[n]!, line: fleetPrice(w, income, kinds) + RESERVE_MONTHS * income, income, balance, overPeace, navyPct: Math.round((100 * (navy.get(n) ?? 0)) / Math.max(1, income)), army: (armyUp.get(n) ?? 0) + (training.get(n) ?? 0), peace: peaceShare(nc.aggression[n]!) * income } : undefined;
    pendingMonth.push({ n, reason: reason ?? 'ordered', short: x.peak - now, lost: now === 0, foe: !atWar ? 'peace' : navalFoe ? 'navalFoe' : 'landFoe', rows: rowsOf(w, n), g });
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
    if (reason === 'spentArmy') {
      const k = `${m.lost ? 'lost' : 'armed'}/${m.foe}`;
      x.spent[k] = (x.spent[k] ?? 0) + 1;
    }
    if (reason === 'gold' && m.g) {
      const k = `${m.lost ? 'lost' : 'armed'}/${m.foe}/${m.g.overPeace ? 'overPeace' : 'underPeace'}`;
      x.goldKind[k] = (x.goldKind[k] ?? 0) + 1;
      x.goldNavyPct.push(m.g.navyPct);
      const ai = aiMonth.get(m.n);
      x.gold.push([day, k, Math.round(m.g.gold), Math.round(m.g.line), Math.round(m.g.income), Math.round(m.g.balance), ai?.army ?? -1, Math.round(ai?.refill ?? -1), ai?.other ?? -1, Math.round(ai?.after ?? -1), Math.round(m.g.army), Math.round(m.g.peace)]);
    }
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
