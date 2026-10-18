/**
 * PLAN 7.26c: the land armies after year 1. Per year of a 1938 run:
 * - at the year's end: land formations and their men, the nations' manpower pools, and the eight
 *   nations with the most land formations (formations, men, manpower, gold, income, at war);
 * - the year's land formations queued (`ProductionQueued` of a land template) and destroyed;
 * - each month, for every living AI nation at war, the first gate of the economic AI's army
 *   orders (`ai/economic.ts`, step 3) that stops its next order, read just before the month's AI
 *   runs, for the plain infantry division: its slots full with orders in training, its army's
 *   upkeep at ARMY_SHARE_WAR of income, the balance (less last month's research and the orders in
 *   training) not above the need with the order's upkeep, gold short of the price and
 *   RESERVE_MONTHS of income, manpower short; else it orders. A month's nation is counted once,
 *   and its men of land formations with it (what share of the armies at war each gate holds).
 *
 * Usage: npx tsx tools/diag/armies.ts <seed> [years = 8] [out = .cache/armies_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { isMonthStart } from '../../src/shared/calendar';
import { DAYS_PER_MONTH } from '../../src/sim/systems/research';
import { ARMY_SHARE_WAR, budgetOf, MAX_PARALLEL, PARALLEL_INCOME, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { Domain } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 8);
const out = process.argv[4] ?? `.cache/armies_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const T = ECONOMY_TABLES_1938;
const upkeepOfTemplate = (t: number): number => UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) || 0;
const GATES = ['slots', 'cap', 'balance', 'gold', 'manpower', 'orders'] as const;
type Gate = (typeof GATES)[number];
const isLandTemplate = (t: number): boolean => w.rules?.templates[t]?.domain === Domain.land;

const rows: unknown[] = [];
const t0 = Date.now();
for (let y = 0; y < years; y++) {
  let queued = 0;
  let destroyed = 0;
  const gates = Object.fromEntries(GATES.map((g) => [g, 0])) as Record<Gate, number>;
  const gateMen = Object.fromEntries(GATES.map((g) => [g, 0])) as Record<Gate, number>;
  const byNation: Record<string, Partial<Record<Gate, number>>> = {};
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.ProductionQueued && isLandTemplate(ww.production.cols.template[ev[i + 2]!]!)) queued++;
        else if (ev[i + 1] === EventKind.FormationDestroyed) destroyed++;
      }
      ev.length = 0;
      ww.out.fires.length = 0;
    });
    if (!isMonthStart(w.startDay, w.tick) || !w.rules) continue;
    // The month's AI runs at this tick: its gates as they stand.
    const f = w.formations.cols;
    const nc = w.nations.cols;
    const army = new Map<number, number>();
    const men = new Map<number, number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = f.nation[id]!;
      const t = f.template[id]!;
      const full = T.templateStrength[t] ?? 0;
      if (full > 0) army.set(n, (army.get(n) ?? 0) + (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * f.strength[id]!) / full);
      men.set(n, (men.get(n) ?? 0) + f.strength[id]!);
    });
    const pending = new Map<number, number>();
    const training = new Map<number, number>();
    w.production.forEach((id) => {
      const t = w.production.cols.template[id]!;
      if (!isLandTemplate(t)) return;
      const n = w.production.cols.nation[id]!;
      pending.set(n, (pending.get(n) ?? 0) + 1);
      training.set(n, (training.get(n) ?? 0) + upkeepOfTemplate(t));
    });
    const acc = monthlyAccounts(w, T);
    const inf = w.rules.templates[BUILD_MIX_1938.infantry]!;
    const infUpkeep = upkeepOfTemplate(BUILD_MIX_1938.infantry);
    for (const n of w.wars.nations()) {
      if (nc.living[n] !== 1 || nc.aiOff[n] === 1) continue;
      const { income, need } = budgetOf(w, n, acc);
      let { balance } = budgetOf(w, n, acc);
      balance -= nc.research[n]! * DAYS_PER_MONTH + (training.get(n) ?? 0);
      const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
      const upkeep = (army.get(n) ?? 0) + (training.get(n) ?? 0);
      const g: Gate =
        (pending.get(n) ?? 0) >= slots ? 'slots'
        : upkeep >= ARMY_SHARE_WAR * income ? 'cap'
        : balance - infUpkeep <= need ? 'balance'
        : nc.gold[n]! < inf.gold + RESERVE_MONTHS * income ? 'gold'
        : nc.manpower[n]! < inf.manpower ? 'manpower'
        : 'orders';
      gates[g]++;
      gateMen[g] += men.get(n) ?? 0;
      (byNation[tag(n)] ??= {})[g] = (byNation[tag(n)]![g] ?? 0) + 1;
    }
  }
  // The year's end.
  const f = w.formations.cols;
  const nc = w.nations.cols;
  const count = new Map<number, number>();
  const men = new Map<number, number>();
  let formations = 0;
  let allMen = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const n = f.nation[id]!;
    formations++;
    allMen += f.strength[id]!;
    count.set(n, (count.get(n) ?? 0) + 1);
    men.set(n, (men.get(n) ?? 0) + f.strength[id]!);
  });
  let pool = 0;
  w.nations.forEach((n) => {
    if (nc.living[n] === 1) pool += nc.manpower[n]!;
  });
  const acc = monthlyAccounts(w, T);
  const atWar = w.wars.nations();
  const top = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 8).map(([n, k]) => ({ n: tag(n), formations: k, men: Math.round(men.get(n) ?? 0), manpower: Math.round(nc.manpower[n]!), gold: Math.round(nc.gold[n]!), income: Math.round(budgetOf(w, n, acc).income), war: atWar.has(n) }));
  const big = Object.entries(byNation).sort((a, b) => Object.values(b[1]).reduce((x, z) => x + z!, 0) - Object.values(a[1]).reduce((x, z) => x + z!, 0)).slice(0, 12);
  const row = { year: y + 1, formations, men: Math.round(allMen), manpowerPool: Math.round(pool), queued, destroyed, gates, gateMen: Object.fromEntries(GATES.map((g) => [g, Math.round(gateMen[g])])), top, byNation: Object.fromEntries(big) };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
process.stderr.write(`done: seed ${seed}\n`);
