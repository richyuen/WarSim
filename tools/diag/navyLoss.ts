/**
 * PLAN 7.35d3a: why the navies the first year sinks are not built again in number (`measure-d.md`
 * §10: armed fleets 99 → 77 by year 4, nations with a navy 16.3 → 10–12, sea pairs 7.7 → 1.3 a day).
 *
 * From 1938, for `years` years:
 * - How the armed fleets (`fleetPower` > 0) go, each day at 01:00 (an hour after the naval AI):
 *   a fleet armed yesterday and not today is laid up (a `FleetsLaidUp` of its nation since), its
 *   nation dead, sunk (a `SeaBattle` that sank a ship of its nation since), gone otherwise (bombs,
 *   a nuke, a port taken), handed over (another nation's now), or disarmed (there, power 0). And
 *   the armed fleets that come (built, or handed over).
 * - Per nation that had an armed fleet and has none (a "lost" navy), on each month's start (the
 *   state the economic AI reads in the coming tick): the first test of its fleet step that stops a
 *   warship's order (`economic.ts` 3b, in the code's order with the lasting ones first): dead, its
 *   AI off, no `shipyard`, poor (income < POOR_INCOME), a warship in training, a transport in
 *   training, a transport wanted (2c's `wantsTransport` stops every other fleet), its navy's upkeep
 *   (transports, submarines) at NAVY_SHARE of income, no gold for a warship of its income's kinds
 *   with RESERVE_MONTHS of income (`pickFleet`), short of men, the balance (before research and the
 *   army: B − the training's upkeep − the fleet's ≤ need); else `open`. In the tick after, the
 *   orders it placed: an `open` month with no warship ordered was spent first (the army's orders, or
 *   research, before 3b), and `check` counts months whose reading and the order disagree.
 * - Each day, the pairs at war with an armed fleet each (`navyPairs`) against those with one each in
 *   one basin (`seaPairs`), and the sea pair-days by pair (does a pair of year 1 still have a navy
 *   each later?).
 *
 * - PLAN 7.35d3b, the gold: the economic AI is wrapped (tool only, the sim unchanged), so each
 *   month's spend of every nation is read exactly: the treasury before and after the AI, the gold
 *   of the orders it placed by kind (the army's, the fleet's and wings', 2b's and 2c's among them),
 *   and the refills as the rest (the AI spends gold on nothing else; research is spent by its own
 *   system, day by day). Per `gold` month (the test reads the treasury before the month's AI, so
 *   this month's spend cannot be what stops it): the shortfall (the line − the treasury), the
 *   months the balance takes to cover it, the treasury the AI leaves over RESERVE_MONTHS of income
 *   (in tenths of the warship's price), and whether the army's orders and refills of the last
 *   month, the last 12 and since the navy was lost would have covered the shortfall.
 *
 * Usage: npx tsx tools/diag/navyLoss.ts <seed> <years> [out = .cache/navyLoss_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { BATTLE_FLEET_INCOME, budgetOf, NAVY_SHARE, pickFleet, POOR_INCOME, RESERVE_MONTHS, RICH_INCOME, wantsTransport } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { basinAt } from '../../src/sim/systems/navalCombat';
import { shipyard } from '../../src/sim/systems/production';
import { DAYS_PER_MONTH } from '../../src/sim/systems/research';
import { fleetPower } from '../../src/sim/systems/seaControl';
import type { System } from '../../src/sim/tick';
import { Domain, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/navyLoss_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const kinds = BUILD_MIX_1938.fleets!;
const warships = new Set([kinds.battle, kinds.cruiser, kinds.destroyer]);
const upkeepOf = (t: number): number => UPKEEP_SCALE * (ECONOMY_TABLES_1938.templateUpkeep[t] ?? 0);

const REASONS = ['dead', 'aiOff', 'noShipyard', 'poor', 'warshipInTraining', 'transportInTraining', 'transportWanted', 'navyShare', 'gold', 'men', 'balance', 'spentArmy', 'spentOther', 'ordered'] as const;
type Reason = (typeof REASONS)[number];
const GONE = ['laidUp', 'died', 'sunk', 'otherGone', 'handedOver', 'disarmed'] as const;
type Gone = (typeof GONE)[number];
const band = (income: number): string => (income < POOR_INCOME ? 'poor' : income < RICH_INCOME ? 'destroyer' : income < BATTLE_FLEET_INCOME ? 'cruiser' : 'battle');

type Year = {
  year: number;
  /** Nation-months of lost navies, by the first test that stops a warship. */
  months: Record<Reason, number>;
  /** The same, of nations at war. */
  monthsAtWar: Record<Reason, number>;
  /** Of the `gold` months: gold / (the cheapest warship of its kinds + RESERVE_MONTHS of income), in tenths. */
  goldRatio: Record<string, number>;
  /** Lost navies' months by income band (living nations). */
  bands: Record<string, number>;
  /** PLAN 7.35d3b: the `gold` months traced, by `<band>/<war|peace>`. */
  gold: Record<string, GoldTrace>;
  gone: Record<Gone, number>;
  built: number;
  handedIn: number;
  shipsSunk: number;
  laidUpEvents: number;
  navies: number;
  lostNavies: number;
  navyPairs: number;
  seaPairs: number;
  /** Sea pair-days by pair (tags). */
  seaPairDays: Record<string, number>;
  /** Navy-days by nation (tags). */
  navyDays: Record<string, number>;
};
const zero = <K extends string>(ks: readonly K[]): Record<K, number> => Object.fromEntries(ks.map((k) => [k, 0])) as Record<K, number>;
type GoldTrace = {
  months: number;
  /** Sums over the months: the shortfall, the month's balance, the AI's spend by kind. */
  shortfall: number;
  balance: number;
  army: number;
  refill: number;
  otherOrders: number;
  /** The month's research budget (gold a month), spent by its system day by day. */
  research: number;
  /** The army's orders and refills (land) would have covered the shortfall: last month's, the last 12 months', since the navy was lost. */
  coverLast: number;
  cover12: number;
  coverLost: number;
  /** Months the balance takes to the line: balance ≤ 0, ≤ 3, ≤ 12, more. */
  toLine: Record<string, number>;
  /** The treasury after the month's AI over RESERVE_MONTHS of income, in tenths of the warship's price ('neg' under the reserve, 10 for a price or more). */
  leftOver: Record<string, number>;
};
const goldTrace = (): GoldTrace => ({ months: 0, shortfall: 0, balance: 0, army: 0, refill: 0, otherOrders: 0, research: 0, coverLast: 0, cover12: 0, coverLost: 0, toLine: {}, leftOver: {} });
/** Per nation: the land spend (army's orders and refills) of each month since its navy was lost, newest last. */
const landSpend = new Map<number, number[]>();
/** The month's AI read by the wrapper: per nation the treasury before and after, and its spend by kind. */
let aiMonth = new Map<number, { before: number; after: number; army: number; refill: number; other: number; research: number }>();
const orderedRows = (w: World): Map<number, number> => {
  const m = new Map<number, number>();
  w.production.forEach((id) => m.set(id, w.production.cols.template[id]!));
  return m;
};
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
          const rows0 = orderedRows(w);
          inner(w);
          aiMonth = new Map();
          const orders = new Map<number, { army: number; other: number }>();
          const p = w.production.cols;
          w.production.forEach((id) => {
            if (rows0.get(id) === p.template[id]) return;
            const t = p.template[id]!;
            const rule = w.rules!.templates[t]!;
            const o = orders.get(p.nation[id]!) ?? { army: 0, other: 0 };
            if (rule.domain === Domain.land) o.army += rule.gold;
            else o.other += rule.gold;
            orders.set(p.nation[id]!, o);
          });
          for (const [n, g0] of before) {
            const after = nc.gold[n]!;
            const o = orders.get(n) ?? { army: 0, other: 0 };
            aiMonth.set(n, { before: g0, after, army: o.army, other: o.other, refill: Math.max(0, g0 - after - o.army - o.other), research: nc.research[n]! * DAYS_PER_MONTH });
          }
        },
  );
}
const rows: Year[] = [];
/** `gold`: per traced gold month, [tick, treasury before the AI, shortfall, balance, army's orders, refills, treasury after the AI, at war]. */
type Nat = { tag: string; atStart: boolean; lost: number[]; regained: number[]; months: Record<Reason, number>; incomes: number[]; warMonths: number; diedDay?: number; gold: number[][] };
const nations = new Map<number, Nat>();
const nat = (n: number): Nat => {
  let x = nations.get(n);
  if (!x) nations.set(n, (x = { tag: tag(n), atStart: false, lost: [], regained: [], months: zero(REASONS), incomes: [], warMonths: 0, gold: [] }));
  return x;
};
const check = { months: 0, predictedOrder: 0, ordered: 0, disagree: 0 };
const t0 = Date.now();

/** Armed fleets now: id → nation, and per nation their basins. */
const armedNow = (w: World): { ids: Map<number, number>; basins: Map<number, Set<number>> } => {
  const c = w.formations.cols;
  const ids = new Map<number, number>();
  const basins = new Map<number, Set<number>>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id) || fleetPower(w, id) <= 0) return;
    const n = c.nation[id]!;
    ids.set(id, n);
    let s = basins.get(n);
    if (!s) basins.set(n, (s = new Set()));
    s.add(basinAt(w, c.x[id]!, c.y[id]!));
  });
  return { ids, basins };
};

let prevArmed = new Map<number, number>();
const hadNavy = new Set<number>();
/** Events since the last daily sample, per nation. */
let laidSince = new Map<number, number>();
let sunkSince = new Set<number>();
/** The armed fleets in a sea battle at some hour since the last daily sample (a battle's row comes at its end). */
let battled = new Set<number>();
/** A month's reading, finished in the tick after: per nation its reason so far and its orders before. */
let pendingMonth: { n: number; reason: Reason; atWar: boolean; rows: Set<string>; g?: { shortfall: number; balance: number; price: number; income: number; band: string } | undefined }[] | null = null;
const rowsOf = (w: World, n: number): Set<string> => {
  const p = w.production.cols;
  const s = new Set<string>();
  w.production.forEach((id) => {
    if (p.nation[id] === n) s.add(`${id}:${p.template[id]}:${p.readyDay[id]}`);
  });
  return s;
};

const daily = (w: World, y: Year, day: number): void => {
  const nc = w.nations.cols;
  const c = w.formations.cols;
  const { ids, basins } = armedNow(w);
  // The fleets gone since yesterday.
  for (const [id, n] of prevArmed) {
    if (ids.has(id)) continue;
    let why: Gone;
    if (w.formations.has(id) && w.isFleet(id) && c.nation[id] !== n) why = 'handedOver';
    else if (w.formations.has(id) && w.isFleet(id)) why = 'disarmed';
    else if ((laidSince.get(n) ?? 0) > 0) {
      why = 'laidUp';
      laidSince.set(n, laidSince.get(n)! - 1);
    } else if (nc.living[n] !== 1) why = 'died';
    else if (sunkSince.has(n) || battled.has(id)) why = 'sunk';
    else why = 'otherGone';
    y.gone[why]++;
  }
  if (day > 0) for (const id of ids.keys()) if (!prevArmed.has(id)) y.built++;
  laidSince = new Map();
  sunkSince = new Set();
  battled = new Set();
  // Navies, lost and regained.
  for (const n of basins.keys()) {
    const x = nat(n);
    if (day === 0) x.atStart = true;
    if (hadNavy.has(n) && x.lost.length > x.regained.length) x.regained.push(day);
    hadNavy.add(n);
    y.navyDays[tag(n)] = (y.navyDays[tag(n)] ?? 0) + 1;
  }
  for (const n of hadNavy) {
    if (basins.has(n)) continue;
    const x = nat(n);
    if (x.lost.length === x.regained.length) x.lost.push(day);
    if (nc.living[n] !== 1 && x.diedDay === undefined) x.diedDay = day;
  }
  y.navies += basins.size;
  y.lostNavies += [...hadNavy].filter((n) => !basins.has(n) && nc.living[n] === 1).length;
  // The pairs at war with a navy each, and those with one each in one basin.
  const navies = [...basins.keys()].sort((a, b) => a - b);
  for (let i = 0; i < navies.length; i++) {
    for (let j = i + 1; j < navies.length; j++) {
      const a = navies[i]!;
      const b = navies[j]!;
      if (!w.wars.atWar(a, b)) continue;
      y.navyPairs++;
      const sb = basins.get(b)!;
      if (![...basins.get(a)!].some((k) => sb.has(k))) continue;
      y.seaPairs++;
      const key = [tag(a), tag(b)].sort().join('-');
      y.seaPairDays[key] = (y.seaPairDays[key] ?? 0) + 1;
    }
  }
  // Fleets handed in from another nation are not built.
  for (const [id, n] of ids) {
    if (prevArmed.has(id) && prevArmed.get(id) !== n) y.handedIn++;
  }
  prevArmed = ids;
};

/** The month's reading for every lost navy, on the state the economic AI reads in the coming tick. */
const monthRead = (w: World, y: Year): void => {
  const nc = w.nations.cols;
  const { basins } = armedNow(w);
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const f = w.formations.cols;
  // Per nation: its fleets and their upkeep, its orders in training and their upkeep (as economicAi).
  const fleets = new Map<number, number[]>();
  const navy = new Map<number, number>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const n = f.nation[id]!;
    (fleets.get(n) ?? fleets.set(n, []).get(n)!).push(id);
    const t = f.template[id]!;
    const full = ECONOMY_TABLES_1938.templateStrength[t] ?? 0;
    navy.set(n, (navy.get(n) ?? 0) + (full > 0 ? (upkeepOf(t) * f.strength[id]!) / full : 0));
  });
  const warshipPending = new Set<number>();
  const transportPending = new Set<number>();
  const training = new Map<number, number>();
  const p = w.production.cols;
  w.production.forEach((id) => {
    const n = p.nation[id]!;
    const t = p.template[id]!;
    const dom = w.rules?.templates[t]?.domain;
    if (dom === Domain.sea) (t === kinds.transport ? transportPending : warshipPending).add(n);
    else if (dom !== Domain.air) training.set(n, (training.get(n) ?? 0) + upkeepOf(t));
  });
  pendingMonth = [];
  for (const n of basins.keys()) landSpend.delete(n);
  for (const n of hadNavy) {
    if (basins.has(n)) continue;
    const x = nat(n);
    const living = nc.living[n] === 1;
    const { income, balance, need } = living ? budgetOf(w, n, acc) : { income: 0, balance: 0, need: 0 };
    const atWar = living && w.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
    let reason: Reason | undefined;
    let g: { shortfall: number; balance: number; price: number; income: number; band: string } | undefined;
    if (!living) reason = 'dead';
    else if (!w.settings.aiEnabled || nc.aiOff[n] === 1) reason = 'aiOff';
    else if (shipyard(w, n) < 0) reason = 'noShipyard';
    else if (income < POOR_INCOME) reason = 'poor';
    else if (warshipPending.has(n)) reason = 'warshipInTraining';
    else if (transportPending.has(n)) reason = 'transportInTraining';
    else if (atWar && wantsTransport(w, n, kinds.transport, fleets.get(n) ?? [])) reason = 'transportWanted';
    else if ((navy.get(n) ?? 0) >= NAVY_SHARE * income) reason = 'navyShare';
    else {
      const t = pickFleet(w, n, income, kinds);
      if (t < 0) {
        reason = 'gold';
        const wanted = income >= BATTLE_FLEET_INCOME ? [kinds.battle, kinds.cruiser, kinds.destroyer] : income >= RICH_INCOME ? [kinds.cruiser, kinds.destroyer] : [kinds.destroyer];
        const price = Math.min(...wanted.map((k) => w.rules!.templates[k]!.gold));
        const r = Math.min(10, Math.floor((10 * Math.max(0, nc.gold[n]!)) / (price + RESERVE_MONTHS * income)));
        y.goldRatio[r] = (y.goldRatio[r] ?? 0) + 1;
        g = { shortfall: price + RESERVE_MONTHS * income - nc.gold[n]!, balance, price, income, band: band(income) };
      }
      else if (nc.manpower[n]! < w.rules!.templates[t]!.manpower) reason = 'men';
      else if (balance - (training.get(n) ?? 0) - upkeepOf(t) <= need) reason = 'balance';
    }
    if (living) {
      x.incomes.push(Math.round(income));
      y.bands[band(income)] = (y.bands[band(income)] ?? 0) + 1;
      if (atWar) x.warMonths++;
    }
    pendingMonth.push({ n, reason: reason ?? 'ordered', atWar, rows: rowsOf(w, n), g });
  }
};

/** The tick after a month's reading: what each lost navy ordered. */
const monthDone = (w: World, y: Year): void => {
  const p = w.production.cols;
  const nc = w.nations.cols;
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
    const predicted = reason === 'ordered';
    if (predicted && !warship) reason = land > 0 ? 'spentArmy' : 'spentOther';
    check.months++;
    if (predicted) check.predictedOrder++;
    if (warship) check.ordered++;
    if (warship && !predicted) check.disagree++;
    y.months[reason]++;
    if (m.atWar) y.monthsAtWar[reason]++;
    // PLAN 7.35d3b: the gold month traced, then this month's land spend kept for the months after.
    const ai = aiMonth.get(m.n);
    const past = landSpend.get(m.n) ?? [];
    if (m.g && ai) {
      const key = `${m.g.band}/${m.atWar ? 'war' : 'peace'}`;
      const t = (y.gold[key] ??= goldTrace());
      t.months++;
      t.shortfall += m.g.shortfall;
      t.balance += m.g.balance;
      t.army += ai.army;
      t.refill += ai.refill;
      t.otherOrders += ai.other;
      t.research += ai.research;
      nat(m.n).gold.push([w.tick, Math.round(ai.before), Math.round(m.g.shortfall), Math.round(m.g.balance), ai.army, Math.round(ai.refill), Math.round(ai.after), m.atWar ? 1 : 0]);
      const sum = (k: number): number => past.slice(-k).reduce((a, b) => a + b, 0);
      if (sum(1) >= m.g.shortfall) t.coverLast++;
      if (sum(12) >= m.g.shortfall) t.cover12++;
      if (sum(past.length) >= m.g.shortfall) t.coverLost++;
      const toLine = m.g.balance <= 0 ? 'never' : m.g.shortfall / m.g.balance <= 3 ? 'le3' : m.g.shortfall / m.g.balance <= 12 ? 'le12' : 'more';
      t.toLine[toLine] = (t.toLine[toLine] ?? 0) + 1;
      const over = ai.after - RESERVE_MONTHS * m.g.income;
      const lo = over < 0 ? 'neg' : String(Math.min(10, Math.floor((10 * over) / m.g.price)));
      t.leftOver[lo] = (t.leftOver[lo] ?? 0) + 1;
    }
    if (nc.living[m.n] === 1) {
      past.push(ai ? ai.army + ai.refill : 0);
      landSpend.set(m.n, past);
    }
    nat(m.n).months[reason]++;
  }
  pendingMonth = null;
};

let day = 0;
for (let year = 1; year <= years; year++) {
  const y: Year = { year, months: zero(REASONS), monthsAtWar: zero(REASONS), goldRatio: {}, bands: {}, gold: {}, gone: zero(GONE), built: 0, handedIn: 0, shipsSunk: 0, laidUpEvents: 0, navies: 0, lostNavies: 0, navyPairs: 0, seaPairs: 0, seaPairDays: {}, navyDays: {} };
  let days = 0;
  sim.step(24 * 365, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const k = ev[i + 1];
      if (k === EventKind.SeaBattle) {
        for (const v of [ev[i + 2]!, ev[i + 3]!]) {
          const s = seaSide(v);
          if (s.ships > 0) sunkSince.add(s.nation);
          y.shipsSunk += s.ships;
        }
      } else if (k === EventKind.FleetsLaidUp) {
        const n = ev[i + 2]!;
        laidSince.set(n, (laidSince.get(n) ?? 0) + ev[i + 3]!);
        y.laidUpEvents += ev[i + 3]!;
      }
    }
    ev.length = 0;
    w.out.fires.length = 0;
    for (const id of prevArmed.keys()) if (seaRangeOf(w, id) !== undefined) battled.add(id);
    if (pendingMonth) monthDone(w, y);
    if (isMonthStart(w.startDay, w.tick)) monthRead(w, y);
    if (w.tick % 24 === 1) {
      daily(w, y, day);
      day++;
      days++;
    }
  });
  for (const k of ['navies', 'lostNavies', 'navyPairs', 'seaPairs'] as const) y[k] = Math.round((y[k] / Math.max(1, days)) * 10) / 10;
  rows.push(y);
  const { seaPairDays, navyDays, ...rest } = y;
  void seaPairDays;
  void navyDays;
  console.log(JSON.stringify(rest));
}
writeFileSync(out, JSON.stringify({ seed, years, wallS: Math.round((Date.now() - t0) / 1000), check, rows, nations: Object.fromEntries([...nations].map(([n, x]) => [n, x])) }, null, 1));
console.log(`check: ${JSON.stringify(check)}`);
console.log(`done: ${out}`);
