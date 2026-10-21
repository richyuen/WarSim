/**
 * PLAN 7.49: why a nation at war has no army. From a saved state, at the next month start (the
 * economic AI's day), for every living nation at war: its land formations and men, its orders in
 * training, gold, income (gross of the month), manpower, and the first gate of the army's order
 * (`economicAi`'s step 3) that stops it, read before the month runs:
 * - slots (orders in training at the most: 1 + income / PARALLEL_INCOME, MAX_PARALLEL);
 * - share (army upkeep with the orders in training ≥ ARMY_SHARE_WAR × income);
 * - gold (under the price of its order, the infantry division's, + RESERVE_MONTHS × income);
 * - manpower (under the infantry division's men; a poor nation's: the cadre division's, `pickTemplate`);
 * - ship: the warship's saving (`armyOrders`), at war with a naval enemy or with no armed fleet;
 *   at war with a naval enemy only with more than FEW_FORMATIONS land formations on land (PLAN 7.49c,
 *   ADR-590); `was` is the gate under the rule before it (ADR-575, ADR-579), where it differs;
 * - none of these (then the balance, the warship's saving or a refusal of the queue).
 * Then the month is run and what the nation ordered (`nations.builds`) is read, and its land orders.
 *
 * Usage: npx tsx tools/diag/armyGates.ts <out.json> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { ARMY_SHARE_WAR, FEW_FORMATIONS, fleetPrice, MAX_PARALLEL, PARALLEL_INCOME, peaceShare, POOR_INCOME, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { shipyard } from '../../src/sim/systems/production';
import { fleetPower } from '../../src/sim/systems/seaControl';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { Domain } from '../../src/sim/world';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, bin] = a.split(':');
  return { seed: Number(seed), bin: bin! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: unknown[] = [];
for (const { seed, bin } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  // To the next month start (its systems run at this tick, before it is counted).
  while (!isMonthStart(w.startDay, w.tick)) s.step(1, quiet);
  const nc = w.nations.cols;
  const f = w.formations.cols;
  const inf = w.rules!.templates[BUILD_MIX_1938.infantry]!;
  const cadre = w.rules!.templates[BUILD_MIX_1938.cadre]!;
  // The nations with an armed fleet (`fleetPower` > 0), as the economic AI reads them.
  const armed = new Set<number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) && fleetPower(w, id) > 0) armed.add(f.nation[id]!);
  });
  const land = new Map<number, { n: number; men: number; onLand: number }>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = f.nation[id]!;
    const e = land.get(n) ?? { n: 0, men: 0, onLand: 0 };
    e.n++;
    e.men += f.strength[id]!;
    if (!w.offLand(id)) e.onLand++;
    land.set(n, e);
  });
  const T = ECONOMY_TABLES_1938;
  const pending = new Map<number, number>();
  const training = new Map<number, number>();
  w.production.forEach((id) => {
    const n = w.production.cols.nation[id]!;
    const t = w.production.cols.template[id]!;
    if (w.rules!.templates[t]?.domain !== Domain.land) return;
    pending.set(n, (pending.get(n) ?? 0) + 1);
    training.set(n, (training.get(n) ?? 0) + UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0));
  });
  const armyUp = new Map<number, number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const t = f.template[id]!;
    const full = T.templateStrength[t] ?? 0;
    const u = full > 0 ? (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * f.strength[id]!) / full : 0;
    armyUp.set(f.nation[id]!, (armyUp.get(f.nation[id]!) ?? 0) + u);
  });
  const fighting = [...w.wars.nations()].filter((n) => nc.living[n] === 1).sort((a, b) => a - b);
  const before = new Map(fighting.map((n) => [n, nc.builds[n]!]));
  const acc = new Map<number, { income: number; army: number }>();
  const a = monthlyAccounts(w, T);
  for (const n of fighting) acc.set(n, { income: a.gross[n]!, army: (armyUp.get(n) ?? 0) + (training.get(n) ?? 0) });
  const gate = new Map<number, string>();
  const was = new Map<number, string>();
  for (const n of fighting) {
    const { income, army } = acc.get(n)!;
    const slots = Math.min(MAX_PARALLEL, 1 + Math.floor(income / PARALLEL_INCOME));
    // A poor nation's order is the cadre division (`pickTemplate`).
    const rule = income < POOR_INCOME ? cadre : inf;
    // The warship's saving (`armyOrders`): no armed fleet of its own, or at war with a naval enemy.
    const navalFoe = w.wars.list.some((x) => {
      const other = x.sides[0].includes(n) ? x.sides[1] : x.sides[1].includes(n) ? x.sides[0] : undefined;
      return other !== undefined && other.some((m) => armed.has(m));
    });
    const ship = income >= POOR_INCOME && (navalFoe || !armed.has(n)) && shipyard(w, n) >= 0 ? fleetPrice(w, income, BUILD_MIX_1938.fleets) : 0;
    const peace = army >= peaceShare(nc.aggression[n]!) * income;
    const first = (saves: boolean): string => {
      if ((pending.get(n) ?? 0) >= slots) return 'slots';
      if (army >= ARMY_SHARE_WAR * income) return 'share';
      if (nc.gold[n]! < rule.gold + RESERVE_MONTHS * income) return 'gold';
      if (nc.manpower[n]! < rule.manpower) return 'manpower';
      if (ship > 0 && (saves || peace) && nc.gold[n]! - rule.gold < ship + RESERVE_MONTHS * income) return saves ? 'ship(navalFoe)' : 'ship';
      return 'none';
    };
    gate.set(n, first(navalFoe && (land.get(n)?.onLand ?? 0) > FEW_FORMATIONS));
    was.set(n, first(navalFoe));
  }
  const landQueued = (): Map<number, number> => {
    const m = new Map<number, number>();
    w.production.forEach((id) => {
      if (w.rules!.templates[w.production.cols.template[id]!]?.domain !== Domain.land) return;
      const n = w.production.cols.nation[id]!;
      m.set(n, (m.get(n) ?? 0) + 1);
    });
    return m;
  };
  const queuedBefore = landQueued();
  s.step(1, quiet);
  const queuedAfter = landQueued();
  for (const n of fighting) {
    const { income, army } = acc.get(n)!;
    rows.push({
      seed,
      bin,
      day: Math.floor(w.tick / 24),
      n: tag(n),
      formations: land.get(n)?.n ?? 0,
      men: land.get(n)?.men ?? 0,
      pending: pending.get(n) ?? 0,
      gold: Math.round(nc.gold[n]!),
      income: Math.round(income),
      army: Math.round(army * 10) / 10,
      manpower: Math.round(nc.manpower[n]!),
      price: (income < POOR_INCOME ? cadre : inf).gold,
      gate: gate.get(n),
      ...(was.get(n) !== gate.get(n) ? { was: was.get(n) } : {}),
      ordered: nc.builds[n]! - before.get(n)!,
      // Land orders of the month (its land queue's growth; one done in this tick is not seen).
      landOrdered: Math.max(0, (queuedAfter.get(n) ?? 0) - (queuedBefore.get(n) ?? 0)),
    });
  }
  process.stderr.write(`${seed} ${bin}: ${fighting.length} at war\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} rows -> ${out}`);
