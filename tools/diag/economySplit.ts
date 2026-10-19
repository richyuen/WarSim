/**
 * PLAN 7.27e's measure: where a nation's income goes, and where its 1938 industry went.
 *
 * From a checkpoint (`--load`, or the 1938 start without it), for `--months` month starts, each
 * watched nation's month split term by term, as the economy and the economic AI take it:
 * income from its own land and from occupied land, what blockade, convoys, bombs and fallout take,
 * bonuses, gross; upkeep of army, navy and air, admin (capped and uncapped), warheads; the
 * economic AI's extras (`budgetOf`: the CE cost, suppression, tribute); research; what is left.
 * Then, against a fresh 1938 world of the same seed: the industry (`cells.econ`) of the nation's
 * 1938 land by who controls it now, the industry it holds that was not its own, and its cities by
 * size, held now against 1938.
 *
 * Usage: npx tsx tools/diag/economySplit.ts --seed 732 [--load .cache/727/s732-y25.bin]
 *        [--watch SOV,GER,USA,JAP] [--months 6] [--out .cache/727/econ732.json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { budgetOf } from '../../src/sim/ai/economic';
import { ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { COST_SHARE, PEACE_CE, WAR_CE } from '../../src/sim/systems/efficiency';
import { ADMIN_CAP_SHARE, adminCost, ECON_PER_BN, economyBreakdown, INCOME_PER_BN, monthlyAccounts } from '../../src/sim/systems/economy';
import { TRIBUTE } from '../../src/sim/systems/puppets';
import { DAYS_PER_MONTH } from '../../src/sim/systems/research';
import { SUPPRESSION_COST } from '../../src/sim/systems/revolts';
import { cellKm2ByRow } from '../../src/sim/landCounts';
import { Domain } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1]! : d;
};
const seed = Number(arg('seed', '732'));
const load = arg('load', '');
if (load && !existsSync(load)) throw new Error(`--load: no file '${load}'`);
const byTag = (t: string): number => {
  const i = TAGS_1938.indexOf(t);
  if (i < 0) throw new Error(`no nation '${t}'`);
  return i + 1;
};
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const watch = arg('watch', 'SOV,GER,USA,JAP').split(',').filter(Boolean).map(byTag);
const monthsWanted = Number(arg('months', '6'));
const out = arg('out', `.cache/econSplit-${seed}.json`);
const T = ECONOMY_TABLES_1938;
const TICKS_PER_YEAR = 365 * 24;
const gold = (m: number): number => (m / ECON_PER_BN) * INCOME_PER_BN;
const r = (v: number): number => Math.round(v * 10) / 10;

const assets = loadAssets1938(SIZE_1938.w);
const start = new Sim({ scenario: '1938', seed, assets });
// A world of its own even from 1938: `start` stays the 1938 the holdings are read against.
const sim = new Sim({ scenario: '1938', seed, assets });
if (load) sim.load(new Uint8Array(readFileSync(load)));
const w = sim.world;
const w0 = start.world;

/** Land, industry and cities of `n`, held now and in 1938, and its 1938 industry by holder now. */
function holdings(n: number): Record<string, unknown> {
  const { owner, controller, econ, w: W, h: H } = w.cells;
  const owner0 = w0.cells.owner;
  const rowKm2 = cellKm2ByRow(W, H);
  let km2 = 0, km2Own1938 = 0, econHeld = 0, econHeldOwn1938 = 0, econ1938 = 0, km2Then = 0;
  const byHolder = new Map<number, number>();
  for (let y = 0, c = 0; y < H; y++) {
    for (let x = 0; x < W; x++, c++) {
      const was = owner0[c] === n;
      if (was) {
        econ1938 += w0.cells.econ[c]!;
        km2Then += rowKm2[y]!;
        const holder = controller[c]!;
        byHolder.set(holder, (byHolder.get(holder) ?? 0) + econ[c]!);
      }
      if (controller[c] !== n) continue;
      km2 += rowKm2[y]!;
      econHeld += owner[c] === n ? econ[c]! : 0;
      if (was) {
        km2Own1938 += rowKm2[y]!;
        econHeldOwn1938 += econ[c]!;
      }
    }
  }
  const cities = (world: typeof w, byController: boolean): number[] => {
    const s = [0, 0, 0, 0, 0, 0];
    world.cities.forEach((id) => {
      const cell = world.cities.cols.cell[id]!;
      const who = byController ? world.cells.controller[cell] : world.cells.owner[cell];
      if (who === n) s[world.cities.cols.size[id]!]!++;
    });
    return s.slice(1);
  };
  const holders = [...byHolder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([h, v]) => `${h === 0 ? '-' : tag(h)} ${r(gold(v))}`);
  return {
    km2Now: Math.round(km2 / 1000) * 1000,
    km2_1938: Math.round(km2Then / 1000) * 1000,
    km2NowOf1938: Math.round(km2Own1938 / 1000) * 1000,
    // In gold a month at INCOME_PER_BN, before multipliers.
    industry1938: r(gold(econ1938)),
    industryOwnedHeld: r(gold(econHeld)),
    industryHeldOf1938: r(gold(econHeldOwn1938)),
    industry1938ByHolder: holders,
    citiesNow: cities(w, true),
    cities1938: cities(w0, false),
  };
}

/**
 * What the month's accounts do not name, paid from the treasury between two rows (a ledger kept
 * daily): orders placed (`queueFormation`, the template's price, by domain), refills of land
 * formations (3a of `ai/economic.ts`: men added on a month's first day at the template's price a
 * man; combat that day is not netted out) and the warhead programme (`nuclear.ts`, paid daily).
 */
type Ledger = { land: number; sea: number; air: number; refill: number; warheads: number };
const ledger = new Map<number, Ledger>(watch.map((n) => [n, { land: 0, sea: 0, air: 0, refill: 0, warheads: 0 }]));
const seenOrders = new Set<string>();
const orderKey = (id: number): string => `${id}:${w.production.cols.nation[id]}:${w.production.cols.template[id]}:${w.production.cols.readyDay[id]}`;
w.production.forEach((id) => seenOrders.add(orderKey(id)));
const warheadGold = (n: number): number => {
  const h = w.warheads.get(n);
  return h ? h.stock * 400 + h.paid : 0;
};
function stepDay(): void {
  const month = isMonthStart(w.startDay, w.tick);
  const before = new Map<number, number>();
  if (month) {
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.isWing(id) && ledger.has(w.formations.cols.nation[id]!)) before.set(id, w.formations.cols.strength[id]!);
    });
  }
  const heads = new Map(watch.map((n) => [n, warheadGold(n)]));
  sim.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  for (const n of watch) {
    // A stock that fell was used or lost, not paid back: only what rose was paid.
    const d = warheadGold(n) - heads.get(n)!;
    if (d > 0) ledger.get(n)!.warheads += d;
  }
  w.production.forEach((id) => {
    const k = orderKey(id);
    if (seenOrders.has(k)) return;
    seenOrders.add(k);
    const e = ledger.get(w.production.cols.nation[id]!);
    if (!e) return;
    const t = w.production.cols.template[id]!;
    const rule = w.rules!.templates[t]!;
    e[rule.domain === Domain.sea ? 'sea' : rule.domain === Domain.air ? 'air' : 'land'] += rule.gold;
  });
  for (const [id, s] of before) {
    if (!w.formations.has(id)) continue;
    const d = w.formations.cols.strength[id]! - s;
    if (!(d > 0)) continue;
    const rule = w.rules!.templates[w.formations.cols.template[id]!]!;
    ledger.get(w.formations.cols.nation[id]!)!.refill += (d * rule.gold) / rule.manpower;
  }
}

const rows: Record<string, unknown>[] = [];
let months = 0;
// The first month start at or after the load; the AI has set the month's research and
// suppression once its tick has run, and the accounts read the same cells.
while (months < monthsWanted) {
  if (isMonthStart(w.startDay, w.tick) && w.tick > 0) {
    months++;
    const acc = monthlyAccounts(w, T);
    const nc = w.nations.cols;
    // The land army on land: men and formations, by nation.
    const men = new Map<number, number>();
    const count = new Map<number, number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = w.formations.cols.nation[id]!;
      men.set(n, (men.get(n) ?? 0) + w.formations.cols.strength[id]!);
      count.set(n, (count.get(n) ?? 0) + 1);
    });
    for (const n of watch) {
      if (nc.living[n] !== 1) continue;
      const b = economyBreakdown(w, T, n);
      const { income, balance } = budgetOf(w, n, acc);
      const ce = (COST_SHARE * Math.max(0, nc.efficiency[n]! - PEACE_CE)) / (WAR_CE - PEACE_CE) * income;
      const supp = SUPPRESSION_COST * nc.suppression[n]! * income;
      const trib = nc.overlord[n] !== 0 ? TRIBUTE * (1 - nc.autonomy[n]! / 100) * income : 0;
      const research = nc.research[n]! * DAYS_PER_MONTH;
      rows.push({
        year: +(w.tick / TICKS_PER_YEAR).toFixed(2),
        n: tag(n),
        atWar: w.wars.nations().has(n),
        ownLand: r(b.ownLand),
        occupiedLand: r(b.occupiedLand),
        blockade: r(b.blockade),
        convoys: r(b.convoys),
        bombs: r(b.bombs),
        fallout: r(b.fallout),
        bonuses: r(b.bonuses),
        incomeMult: nc.incomeMult[n],
        incomeBonus: nc.incomeBonus[n],
        gross: r(b.gross),
        army: r(b.army),
        navy: r(b.navy),
        air: r(b.air),
        admin: r(b.admin),
        adminUncapped: r(adminCost(acc.held[n]!)),
        adminCap: r(ADMIN_CAP_SHARE * b.gross),
        warheads: r(b.warheads),
        ce: r(ce),
        efficiency: +nc.efficiency[n]!.toFixed(2),
        suppression: r(supp),
        suppressionLevel: nc.suppression[n],
        tribute: r(trib),
        balance: r(balance),
        research: r(research),
        left: r(balance - research),
        gold: Math.round(nc.gold[n]!),
        landMen: Math.round(men.get(n) ?? 0),
        formations: count.get(n) ?? 0,
        km2: Math.round(acc.held[n]! / 1000) * 1000,
        // Paid since the last row outside the accounts above (`Ledger`).
        paid: Object.fromEntries(Object.entries(ledger.get(n)!).map(([k, v]) => [k, Math.round(v)])),
      });
      ledger.set(n, { land: 0, sea: 0, air: 0, refill: 0, warheads: 0 });
    }
  }
  stepDay();
}
const held = Object.fromEntries(watch.map((n) => [tag(n), holdings(n)]));
writeFileSync(out, JSON.stringify({ seed, load, rows, held }, null, 1));
for (const row of rows) console.log(JSON.stringify(row));
for (const [k, v] of Object.entries(held)) console.log(k, JSON.stringify(v));
process.stderr.write(`done: ${rows.length} rows -> ${out}\n`);
