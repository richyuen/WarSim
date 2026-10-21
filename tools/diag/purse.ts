/**
 * PLAN 7.49e's measure: the defenders' purse. From each saved state, the band: living nations at
 * war whose month's gross income (`monthlyAccounts`, as the economic AI reads it) is BAND_LO to
 * BAND_HI. Then `days` days are run, and per band nation: its land formations (aboard counted) on
 * day 0 and on the last day, its land orders placed (the land queue's growth at each month start's
 * tick), the months it ended in debt, its formations disbanded (`FormationsDisbanded`), its gold
 * and income on day 0 and the last day, and whether it is alive and at war at the end.
 * Also, on the last day, the band read anew (nations at war of that income then) and their
 * formations. And at each month start, per band nation, the first gate of an army order (as
 * `armyGates.ts`, read before the month runs): slots, share, balance (the month's balance less
 * research's budget, the orders in training and a division's upkeep, at or under the need), gold
 * (the reserve: RESERVE_MONTHS, or the env's PURSE_WAR_RESERVE months at war while the army is
 * under its peacetime share, the rule measured), manpower, ship (the warship's saving, as
 * `armyGates.ts`), none; with whether the nation placed a land order that month (`gate:ordered`).
 * The AT's figure: the day-0 band's land formations on the last day, summed.
 *
 * Usage: npx tsx tools/diag/purse.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { ARMY_SHARE_WAR, budgetOf, FEW_FORMATIONS, fleetPrice, MAX_PARALLEL, PARALLEL_INCOME, peaceShare, POOR_INCOME, RESERVE_MONTHS, RUNWAY_MONTHS } from '../../src/sim/ai/economic';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { shipyard } from '../../src/sim/systems/production';
import { DAYS_PER_MONTH, researchBudget } from '../../src/sim/systems/research';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { Domain, type World } from '../../src/sim/world';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const BAND_LO = 150;
const BAND_HI = 500;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin] = a.split(':');
  return { seed: Number(seed), bin: bin! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const landCount = (w: World): Map<number, number> => {
  const m = new Map<number, number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = w.formations.cols.nation[id]!;
    m.set(n, (m.get(n) ?? 0) + 1);
  });
  return m;
};
const landQueued = (w: World): Map<number, number> => {
  const m = new Map<number, number>();
  w.production.forEach((id) => {
    if (w.rules!.templates[w.production.cols.template[id]!]?.domain !== Domain.land) return;
    const n = w.production.cols.nation[id]!;
    m.set(n, (m.get(n) ?? 0) + 1);
  });
  return m;
};
const band = (w: World): Map<number, number> => {
  const a = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const m = new Map<number, number>();
  for (const n of w.wars.nations()) {
    if (w.nations.cols.living[n] !== 1) continue;
    const inc = a.gross[n]!;
    if (inc >= BAND_LO && inc <= BAND_HI) m.set(n, inc);
  }
  return m;
};

const T = ECONOMY_TABLES_1938;
const WAR_RESERVE = process.env.PURSE_WAR_RESERVE !== undefined ? Number(process.env.PURSE_WAR_RESERVE) : RESERVE_MONTHS;
/** The first gate of an army order of each band nation at this month start (see above). */
const gates = (w: World, b: Set<number>): Map<number, string> => {
  const nc = w.nations.cols;
  const f = w.formations.cols;
  const inf = w.rules!.templates[BUILD_MIX_1938.infantry]!;
  const infUp = UPKEEP_SCALE * (T.templateUpkeep[BUILD_MIX_1938.infantry] ?? 0);
  const pending = new Map<number, number>();
  const training = new Map<number, number>();
  w.production.forEach((id) => {
    const n = w.production.cols.nation[id]!;
    const t = w.production.cols.template[id]!;
    if (w.rules!.templates[t]?.domain !== Domain.land) return;
    pending.set(n, (pending.get(n) ?? 0) + 1);
    training.set(n, (training.get(n) ?? 0) + UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0));
  });
  const army = new Map<number, number>();
  const onLand = new Map<number, number>();
  const armed = new Set<number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) && fleetPower(w, id) > 0) armed.add(f.nation[id]!);
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    onLand.set(f.nation[id]!, (onLand.get(f.nation[id]!) ?? 0) + 1);
    const t = f.template[id]!;
    const full = T.templateStrength[t] ?? 0;
    const u = full > 0 ? (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * f.strength[id]!) / full : 0;
    army.set(f.nation[id]!, (army.get(f.nation[id]!) ?? 0) + u);
  });
  const acc = monthlyAccounts(w, T);
  const atWar = new Set(w.wars.nations());
  const m = new Map<number, string>();
  for (const n of b) {
    if (nc.living[n] !== 1) continue;
    const { income, balance: b, need } = budgetOf(w, n, acc);
    const balance = b - researchBudget(w.rules!, nc.gold[n]!, income, b, need, RUNWAY_MONTHS) * DAYS_PER_MONTH;
    const up = (army.get(n) ?? 0) + (training.get(n) ?? 0);
    const war = atWar.has(n);
    const peace = up >= peaceShare(nc.aggression[n]!) * income;
    const reserve = (war && !peace ? WAR_RESERVE : RESERVE_MONTHS) * income;
    const navalFoe = w.wars.list.some((x) => {
      const other = x.sides[0].includes(n) ? x.sides[1] : x.sides[1].includes(n) ? x.sides[0] : undefined;
      return other !== undefined && other.some((o) => armed.has(o));
    });
    const saves = navalFoe && (onLand.get(n) ?? 0) > FEW_FORMATIONS;
    const ship = income >= POOR_INCOME && (navalFoe || !armed.has(n)) && shipyard(w, n) >= 0 ? fleetPrice(w, income, BUILD_MIX_1938.fleets!) : 0;
    const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
    m.set(
      n,
      !war ? 'peace'
      : (pending.get(n) ?? 0) >= slots ? 'slots'
      : up >= ARMY_SHARE_WAR * income ? 'share'
      : balance - (training.get(n) ?? 0) - infUp <= need ? 'balance'
      : nc.gold[n]! < inf.gold + reserve ? 'gold'
      : nc.manpower[n]! < inf.manpower ? 'manpower'
      : ship > 0 && (saves || peace) && nc.gold[n]! - inf.gold < ship + RESERVE_MONTHS * income ? (saves ? 'ship(navalFoe)' : 'ship')
      : 'none',
    );
  }
  return m;
};
const gateCount = new Map<string, number>();
const rows: unknown[] = [];
const sums: unknown[] = [];
for (const { seed, bin } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const nc = w.nations.cols;
  const b0 = band(w);
  const f0 = landCount(w);
  const gold0 = new Map([...b0.keys()].map((n) => [n, nc.gold[n]!]));
  const orders = new Map<number, number>();
  const debt = new Map<number, number>();
  const disbanded = new Map<number, number>();
  const quiet = (ww: World): void => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.FormationsDisbanded && b0.has(ev[i + 2]!)) disbanded.set(ev[i + 2]!, (disbanded.get(ev[i + 2]!) ?? 0) + ev[i + 3]!);
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const end = w.tick + days * 24;
  while (w.tick < end) {
    if (isMonthStart(w.startDay, w.tick)) {
      const g = gates(w, new Set(b0.keys()));
      const q0 = landQueued(w);
      s.step(1, quiet);
      const q1 = landQueued(w);
      for (const n of b0.keys()) {
        const placed = Math.max(0, (q1.get(n) ?? 0) - (q0.get(n) ?? 0));
        orders.set(n, (orders.get(n) ?? 0) + placed);
        const k = `${g.get(n) ?? 'dead'}:${placed > 0 ? 'ordered' : 'not'}`;
        gateCount.set(k, (gateCount.get(k) ?? 0) + 1);
        if (nc.gold[n]! < 0) debt.set(n, (debt.get(n) ?? 0) + 1);
      }
    } else s.step(1, quiet);
  }
  const f1 = landCount(w);
  const a1 = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const atWar = new Set(w.wars.nations());
  let before = 0;
  let after = 0;
  for (const [n, inc] of b0) {
    before += f0.get(n) ?? 0;
    after += f1.get(n) ?? 0;
    rows.push({
      seed,
      bin,
      n: tag(n),
      income0: Math.round(inc),
      gold0: Math.round(gold0.get(n)!),
      formations0: f0.get(n) ?? 0,
      formations1: f1.get(n) ?? 0,
      orders: orders.get(n) ?? 0,
      debtMonths: debt.get(n) ?? 0,
      disbanded: disbanded.get(n) ?? 0,
      income1: Math.round(a1.gross[n]!),
      gold1: Math.round(nc.gold[n]!),
      alive: nc.living[n] === 1,
      atWar: atWar.has(n),
    });
  }
  const b1 = band(w);
  let anew = 0;
  for (const n of b1.keys()) anew += f1.get(n) ?? 0;
  sums.push({ seed, bin, band: b0.size, before, after, bandAnew: b1.size, anewFormations: anew });
  process.stderr.write(`${seed} ${bin}: band ${b0.size}, formations ${before} -> ${after}; anew ${b1.size} / ${anew}\n`);
}
writeFileSync(out, JSON.stringify({ sums, gates: Object.fromEntries(gateCount), rows }, null, 1));
console.log(`done: ${rows.length} rows -> ${out}`);
