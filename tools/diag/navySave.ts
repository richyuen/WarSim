/**
 * PLAN 7.84d: why a nation at war with a naval enemy and no armed fleet orders army in a month its
 * treasury is under the warship's line (`navyRebuild.ts`: 27–35 such months on HEAD over years
 * 2–10 of seeds 3613 and 4219, none on `dd3b730`).
 *
 * The economic AI is wrapped (tool only). On each month's start, per living nation at war with an
 * enemy that has an armed fleet, itself with none, its income at POOR_INCOME or more and its
 * treasury under the line (the cheapest warship of its income's kinds and RESERVE_MONTHS of income),
 * the inputs of `economic.ts`'s saving (`saves`, `shipPrice`) read before the AI: its land
 * formations on land (`FEW_FORMATIONS`), `wants` (`wantsTransport` with a division's room),
 * `ferrying` (`wantsFerry`), its transports and warships in training, its shipyard, and its armed
 * navy's upkeep over income; and after the AI, the land orders it placed. Per year, the months by
 * the first input that turns the saving off, and of them those with a land order.
 *
 * Usage: npx tsx tools/diag/navySave.ts <seed> <years> [out = .cache/navySave_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { budgetOf, FEW_FORMATIONS, fleetPrice, NAVY_SHARE, POOR_INCOME, RESERVE_MONTHS, wantsFerry, wantsTransport } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { shipyard } from '../../src/sim/systems/production';
import { fleetPower } from '../../src/sim/systems/seaControl';
import type { System } from '../../src/sim/tick';
import { Domain, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? `.cache/navySave_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const kinds = BUILD_MIX_1938.fleets!;
const division = ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry] ?? 0;
const upkeepOf = (t: number): number => UPKEEP_SCALE * (ECONOMY_TABLES_1938.templateUpkeep[t] ?? 0);

const REASONS = ['fewFormations', 'wants', 'warshipInTraining', 'transportInTraining', 'noShipyard', 'navyShare', 'saving'] as const;
type Reason = (typeof REASONS)[number];
type Year = { year: number; months: Record<Reason, number>; withOrder: Record<Reason, number>; orderGold: Record<Reason, number> };
const zero = (): Record<Reason, number> => Object.fromEntries(REASONS.map((k) => [k, 0])) as Record<Reason, number>;
const rows: Year[] = [];
/** Per nation: months by reason, with a land order. */
const byNation = new Map<string, Record<string, number>>();
let y: Year = { year: 1, months: zero(), withOrder: zero(), orderGold: zero() };

const read = (w: World): Map<number, Reason> => {
  const nc = w.nations.cols;
  const f = w.formations.cols;
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const armedUp = new Map<number, number>();
  const fleets = new Map<number, number[]>();
  const land = new Map<number, number>();
  w.formations.forEach((id) => {
    const n = f.nation[id]!;
    if (w.isFleet(id)) {
      (fleets.get(n) ?? fleets.set(n, []).get(n)!).push(id);
      if (fleetPower(w, id) > 0) {
        const t = f.template[id]!;
        const full = ECONOMY_TABLES_1938.templateStrength[t] ?? 0;
        armedUp.set(n, (armedUp.get(n) ?? 0) + (full > 0 ? (upkeepOf(t) * f.strength[id]!) / full : 0));
      }
      return;
    }
    if (w.isWing(id) || w.offLand(id)) return;
    land.set(n, (land.get(n) ?? 0) + 1);
  });
  const transports = new Map<number, number>();
  const ships = new Map<number, number>();
  const p = w.production.cols;
  w.production.forEach((id) => {
    const t = p.template[id]!;
    if (w.rules?.templates[t]?.domain !== Domain.sea) return;
    const n = p.nation[id]!;
    ships.set(n, (ships.get(n) ?? 0) + 1);
    if (t === kinds.transport) transports.set(n, (transports.get(n) ?? 0) + 1);
  });
  const res = new Map<number, Reason>();
  w.nations.forEach((n) => {
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1) return;
    if (armedUp.has(n)) return;
    const wars = w.wars.list.filter((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
    if (wars.length === 0) return;
    const navalFoe = wars.some((war) => (war.sides[0].includes(n) ? war.sides[1] : war.sides[0]).some((m) => armedUp.has(m)));
    if (!navalFoe) return;
    const { income } = budgetOf(w, n, acc);
    if (income < POOR_INCOME) return;
    if (nc.gold[n]! >= fleetPrice(w, income, kinds) + RESERVE_MONTHS * income) return;
    const own = fleets.get(n) ?? [];
    const wants = !transports.has(n) && wantsTransport(w, n, kinds.transport, own, division);
    const ferrying = !wants && wantsFerry(w, n, own);
    const warships = (ships.get(n) ?? 0) - (ferrying ? (transports.get(n) ?? 0) : 0);
    let r: Reason;
    if ((land.get(n) ?? 0) <= FEW_FORMATIONS) r = 'fewFormations';
    else if (wants) r = 'wants';
    else if (warships > 0) r = (transports.get(n) ?? 0) > 0 && warships <= (transports.get(n) ?? 0) ? 'transportInTraining' : 'warshipInTraining';
    else if (shipyard(w, n) < 0) r = 'noShipyard';
    else if ((armedUp.get(n) ?? 0) >= NAVY_SHARE * income) r = 'navyShare';
    else r = 'saving';
    res.set(n, r);
  });
  return res;
};

{
  const s = sim as unknown as { systems: readonly System[] };
  const i = s.systems.findIndex((fn) => fn.name === 'economicAiSystem');
  if (i < 0) throw new Error('economicAiSystem not found');
  const inner = s.systems[i]!;
  s.systems = s.systems.map((fn, k) =>
    k !== i
      ? fn
      : (w: World): void => {
          if (!isMonthStart(w.startDay, w.tick)) return inner(w);
          const months = read(w);
          const before = new Set<number>();
          w.production.forEach((id) => before.add(id * 1000 + w.production.cols.template[id]!));
          inner(w);
          const gold = new Map<number, number>();
          const p = w.production.cols;
          w.production.forEach((id) => {
            if (before.has(id * 1000 + p.template[id]!)) return;
            const rule = w.rules!.templates[p.template[id]!]!;
            if (rule.domain === Domain.land) gold.set(p.nation[id]!, (gold.get(p.nation[id]!) ?? 0) + rule.gold);
          });
          for (const [n, r] of months) {
            y.months[r]++;
            const g = gold.get(n) ?? 0;
            if (g > 0) {
              y.withOrder[r]++;
              y.orderGold[r] += g;
            }
            const x = byNation.get(tag(n)) ?? {};
            x[r] = (x[r] ?? 0) + 1;
            if (g > 0) x[`${r}+order`] = (x[`${r}+order`] ?? 0) + 1;
            byNation.set(tag(n), x);
          }
        },
  );
}

for (let year = 1; year <= years; year++) {
  y = { year, months: zero(), withOrder: zero(), orderGold: zero() };
  sim.step(24 * 365, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  rows.push(y);
  console.log(JSON.stringify({ year, months: y.months, withOrder: y.withOrder }));
}
writeFileSync(out, JSON.stringify({ seed, years, rows, nations: Object.fromEntries(byNation) }, null, 1));
console.log(`done: ${out}`);
