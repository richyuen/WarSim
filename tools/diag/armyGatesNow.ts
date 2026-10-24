/**
 * PLAN 7.110a: why a nation at war orders no more army, under the rules as they stand (`economicAi`
 * step 3, with ADR-615's reserve, PLAN 7.100's cadre division and the balance, which
 * `armyGates.ts` does not read). From a saved state, at each of `months` month starts, for every
 * living AI nation at war, read before the month runs: its gross income; the upkeep of its land army
 * on land, of its fleets and of its wings (`economicAi`'s sums); the rest of its expenses (admin,
 * warheads); the CE cost, suppression and tribute (`budgetOf`'s extra); the land orders in training
 * and their upkeep; gold and manpower. Then the month's tick is run and its research budget (set by
 * the economic AI in that tick, before the army's orders) and its land orders are read. The first gate
 * of the army's next order, as `armyOrders` takes them:
 * - slots: orders in training at the most (1 + income / PARALLEL_INCOME, MAX_PARALLEL);
 * - share: army upkeep with the orders in training ≥ ARMY_SHARE_WAR × income;
 * - balance: the month's balance less research, the orders in training and the cheapest division's
 *   upkeep at or under the need (suppression's change this month not counted);
 * - gold: under the cadre division's price and the reserve (none while the army is under its
 *   peacetime share, else RESERVE_MONTHS of income);
 * - manpower: under the cadre division's men;
 * - ship: the warship's saving (`shipPrice`, as `economicAi` reads it, its transport want not read):
 *   the cadre division's price would leave the gold under the warship's and RESERVE_MONTHS of income;
 * - other: none of these (armour's saving, or the queue's refusal).
 * Also, in the month's tick: the men refilled (land formations' strength gained in it, a template's
 * price a man), the land orders by kind (infantry, cadre, motorised, armour) and the armoured orders in
 * training before it.
 * Summed over all rows: the shares of the income of nations at war that each spending takes.
 *
 * Usage: npx tsx tools/diag/armyGatesNow.ts <out.json> <months> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { ARMY_SHARE_WAR, budgetOf, FEW_FORMATIONS, fleetPrice, MAX_PARALLEL, NAVY_SHARE, PARALLEL_INCOME, peaceShare, POOR_INCOME, RESERVE_MONTHS, WAR_RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { shipyard } from '../../src/sim/systems/production';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { DAYS_PER_MONTH } from '../../src/sim/systems/research';
import { COST_SHARE, PEACE_CE, WAR_CE } from '../../src/sim/systems/efficiency';
import { SUPPRESSION_COST } from '../../src/sim/systems/revolts';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Domain, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const months = Number(process.argv[3]);
const T = ECONOMY_TABLES_1938;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: Record<string, unknown>[] = [];
const totals = { ce: 0, supp: 0, refills: 0, income: 0, army: 0, navy: 0, air: 0, rest: 0, extra: 0, research: 0, training: 0, left: 0 };
const gates: Record<string, { n: number; ordered: number; income: number }> = {};
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const nc = w.nations.cols;
  const f = w.formations.cols;
  const cadre = w.rules!.templates[BUILD_MIX_1938.cadre]!;
  const upTpl = (t: number): number => UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) || 0;
  const upOf = (id: number): number => {
    const t = f.template[id]!;
    const full = T.templateStrength[t] ?? 0;
    return full > 0 ? (upTpl(t) * f.strength[id]!) / full : 0;
  };
  for (let m = 0; m < months; m++) {
    s.step(1, quiet);
    while (!isMonthStart(w.startDay, w.tick)) s.step(1, quiet);
    const army = new Map<number, number>();
    const navy = new Map<number, number>();
    /** The upkeep of armed fleets, and the nations with a fleet in training. */
    const armed = new Map<number, number>();
    const shipsPending = new Set<number>();
    const air = new Map<number, number>();
    const formations = new Map<number, number>();
    w.formations.forEach((id) => {
      const n = f.nation[id]!;
      if (w.isFleet(id)) {
        navy.set(n, (navy.get(n) ?? 0) + upOf(id));
        if (fleetPower(w, id) > 0) armed.set(n, (armed.get(n) ?? 0) + upOf(id));
      }
      else if (w.isWing(id)) air.set(n, (air.get(n) ?? 0) + upOf(id));
      else if (!w.offLand(id)) {
        army.set(n, (army.get(n) ?? 0) + upOf(id));
        formations.set(n, (formations.get(n) ?? 0) + 1);
      }
    });
    const pending = new Map<number, number>();
    const training = new Map<number, number>();
    const landQueued = (): Map<number, number> => {
      const q = new Map<number, number>();
      w.production.forEach((id) => {
        const t = w.production.cols.template[id]!;
        if (w.rules!.templates[t]?.domain !== Domain.land) return;
        const n = w.production.cols.nation[id]!;
        q.set(n, (q.get(n) ?? 0) + 1);
      });
      return q;
    };
    const armourPending = new Map<number, number>();
    w.production.forEach((id) => {
      const t = w.production.cols.template[id]!;
      if (w.rules!.templates[t]?.domain === Domain.sea) shipsPending.add(w.production.cols.nation[id]!);
      if (w.rules!.templates[t]?.domain !== Domain.land) return;
      const n = w.production.cols.nation[id]!;
      if (BUILD_MIX_1938.armour.includes(t)) armourPending.set(n, (armourPending.get(n) ?? 0) + 1);
      pending.set(n, (pending.get(n) ?? 0) + 1);
      training.set(n, (training.get(n) ?? 0) + upTpl(t));
    });
    const acc = monthlyAccounts(w, T);
    const fighting = [...w.wars.nations()].filter((n) => nc.living[n] === 1 && nc.aiOff[n] !== 1).sort((x, y) => x - y);
    const pre = new Map(
      fighting.map((n) => {
        const b = budgetOf(w, n, acc);
        const ce = ((COST_SHARE * Math.max(0, nc.efficiency[n]! - PEACE_CE)) / (WAR_CE - PEACE_CE)) * b.income;
        const supp = SUPPRESSION_COST * nc.suppression[n]! * b.income;
        return [n, { ...b, ce, supp, gold: nc.gold[n]!, manpower: nc.manpower[n]!, expenses: acc.expenses[n]!, extra: b.income - acc.expenses[n]! - b.balance }];
      }),
    );
    const before = landQueued();
    const menBefore = new Map<number, number>();
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.isWing(id)) menBefore.set(id, f.strength[id]!);
    });
    const rowsBefore = new Set<number>();
    w.production.forEach((id) => rowsBefore.add(id));
    s.step(1, quiet);
    const after = landQueued();
    const refilled = new Map<number, { men: number; gold: number }>();
    for (const [id, men] of menBefore) {
      if (!w.formations.has(id) || f.strength[id]! <= men) continue;
      const rule = w.rules!.templates[f.template[id]!]!;
      const e = refilled.get(f.nation[id]!) ?? { men: 0, gold: 0 };
      e.men += f.strength[id]! - men;
      e.gold += ((f.strength[id]! - men) * rule.gold) / rule.manpower;
      refilled.set(f.nation[id]!, e);
    }
    const kinds = new Map<number, Record<string, number>>();
    w.production.forEach((id) => {
      if (rowsBefore.has(id)) return;
      const t = w.production.cols.template[id]!;
      if (w.rules!.templates[t]?.domain !== Domain.land) return;
      const k = t === BUILD_MIX_1938.infantry ? 'infantry' : t === BUILD_MIX_1938.cadre ? 'cadre' : t === BUILD_MIX_1938.motorised ? 'motorised' : BUILD_MIX_1938.armour.includes(t) ? 'armour' : 'other';
      const n = w.production.cols.nation[id]!;
      const e = kinds.get(n) ?? {};
      e[k] = (e[k] ?? 0) + 1;
      kinds.set(n, e);
    });
    for (const n of fighting) {
      const p = pre.get(n)!;
      const income = p.income;
      const up = (army.get(n) ?? 0) + (training.get(n) ?? 0);
      const research = nc.research[n]! * DAYS_PER_MONTH;
      const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
      const peace = peaceShare(nc.aggression[n]!) * income;
      const reserve = (up < peace ? WAR_RESERVE_MONTHS : RESERVE_MONTHS) * income;
      const left = p.balance - research - (training.get(n) ?? 0);
      const navalFoe = w.wars.list.some((x) => {
        const other = x.sides[0].includes(n) ? x.sides[1] : x.sides[1].includes(n) ? x.sides[0] : undefined;
        return other !== undefined && other.some((o) => armed.has(o));
      });
      const saves = navalFoe && (formations.get(n) ?? 0) > FEW_FORMATIONS;
      const shipPrice = !shipsPending.has(n) && income >= POOR_INCOME && (armed.get(n) ?? 0) < NAVY_SHARE * income && (navalFoe || !armed.has(n)) && shipyard(w, n) >= 0 ? fleetPrice(w, income, BUILD_MIX_1938.fleets!) : 0;
      const ship = shipPrice > 0 && (saves || up >= peace) && p.gold - cadre.gold < shipPrice + RESERVE_MONTHS * income;
      const gate =
        (pending.get(n) ?? 0) >= slots ? 'slots' : up >= ARMY_SHARE_WAR * income ? 'share' : left - upTpl(BUILD_MIX_1938.cadre) <= p.need ? 'balance' : p.gold < cadre.gold + reserve ? 'gold' : p.manpower < cadre.manpower ? 'manpower' : ship ? 'ship' : 'other';
      const ordered = Math.max(0, (after.get(n) ?? 0) - (before.get(n) ?? 0));
      const g = (gates[gate] ??= { n: 0, ordered: 0, income: 0 });
      g.n++;
      g.ordered += ordered;
      g.income += income;
      const rest = p.expenses - (army.get(n) ?? 0) - (navy.get(n) ?? 0) - (air.get(n) ?? 0);
      totals.income += income;
      totals.army += army.get(n) ?? 0;
      totals.navy += navy.get(n) ?? 0;
      totals.air += air.get(n) ?? 0;
      totals.rest += rest;
      totals.extra += p.extra;
      totals.ce += p.ce;
      totals.supp += p.supp;
      totals.research += research;
      totals.training += training.get(n) ?? 0;
      totals.left += left;
      totals.refills += refilled.get(n)?.gold ?? 0;
      rows.push({
        seed: Number(seedS),
        bin,
        day: Math.floor(w.tick / 24),
        n: tag(n),
        formations: formations.get(n) ?? 0,
        income: Math.round(income),
        army: Math.round(army.get(n) ?? 0),
        navy: Math.round(navy.get(n) ?? 0),
        air: Math.round(air.get(n) ?? 0),
        rest: Math.round(rest),
        extra: Math.round(p.extra),
        ce: Math.round(p.ce),
        supp: Math.round(p.supp),
        research: Math.round(research),
        training: Math.round(training.get(n) ?? 0),
        balance: Math.round(p.balance),
        need: Math.round(p.need),
        gold: Math.round(p.gold),
        manpower: Math.round(p.manpower),
        pending: pending.get(n) ?? 0,
        armourPending: armourPending.get(n) ?? 0,
        refilledMen: Math.round(refilled.get(n)?.men ?? 0),
        refilledGold: Math.round(refilled.get(n)?.gold ?? 0),
        kinds: kinds.get(n) ?? {},
        slots,
        shipPrice: Math.round(shipPrice),
        navalFoe,
        gate,
        ordered,
      });
    }
  }
  process.stderr.write(`${seedS} ${bin}: ${rows.length} rows so far\n`);
}
const inc = totals.income || 1;
const shares = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, k === 'income' ? Math.round(v) : Math.round((1000 * v) / inc) / 1000]));
writeFileSync(out, JSON.stringify({ shares, gates, rows }, null, 1));
console.log(`done: ${rows.length} rows; shares of income ${JSON.stringify(shares)}; gates ${JSON.stringify(gates)}`);
