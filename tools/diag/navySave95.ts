/**
 * PLAN 7.95, read first: at war with no naval enemy, a nation with a shipyard, no armed fleet, income
 * at POOR_INCOME or more, more than FEW_FORMATIONS land formations and its treasury under the warship's
 * line (the cheapest warship of its kinds and RESERVE_MONTHS of income): its army's upkeep (on land
 * and in training) over its peacetime share (`peaceShare` × income), by band, the months and those
 * with a land order placed. The economic AI is wrapped (tool only).
 *
 * Usage: npx tsx tools/diag/navySave95.ts <seed> <years> [out = .cache/navySave95_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { isMonthStart } from '../../src/shared/calendar';
import { budgetOf, FEW_FORMATIONS, fleetPrice, peaceShare, POOR_INCOME, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { shipyard } from '../../src/sim/systems/production';
import { fleetPower } from '../../src/sim/systems/seaControl';
import type { System } from '../../src/sim/tick';
import { Domain, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4] ?? `.cache/navySave95_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const kinds = BUILD_MIX_1938.fleets!;
const upkeepOf = (t: number): number => UPKEEP_SCALE * (ECONOMY_TABLES_1938.templateUpkeep[t] ?? 0);

const BANDS = [0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, Infinity];
const band = (r: number): string => { for (let i = 1; i < BANDS.length; i++) if (r < BANDS[i]!) return `${BANDS[i - 1]}-${BANDS[i]}`; return 'inf'; };
const months: Record<string, number> = {};
const ordered: Record<string, number> = {};
const byYear: Record<number, Record<string, number>> = {};
const read = (w: World): Map<number, string> => {
  const nc = w.nations.cols;
  const f = w.formations.cols;
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const armed = new Set<number>();
  const land = new Map<number, number>();
  const upkeep = new Map<number, number>();
  w.formations.forEach((id) => {
    const n = f.nation[id]!;
    if (w.isFleet(id)) { if (fleetPower(w, id) > 0) armed.add(n); return; }
    if (w.isWing(id) || w.offLand(id)) return;
    land.set(n, (land.get(n) ?? 0) + 1);
    const t = f.template[id]!;
    const full = ECONOMY_TABLES_1938.templateStrength[t] ?? 0;
    upkeep.set(n, (upkeep.get(n) ?? 0) + (full > 0 ? (upkeepOf(t) * f.strength[id]!) / full : 0));
  });
  const p = w.production.cols;
  w.production.forEach((id) => {
    const t = p.template[id]!;
    if (w.rules?.templates[t]?.domain !== Domain.land) return;
    upkeep.set(p.nation[id]!, (upkeep.get(p.nation[id]!) ?? 0) + upkeepOf(t));
  });
  const res = new Map<number, string>();
  w.nations.forEach((n) => {
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || armed.has(n)) return;
    const wars = w.wars.list.filter((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
    if (wars.length === 0) return;
    if (wars.some((war) => (war.sides[0].includes(n) ? war.sides[1] : war.sides[0]).some((m) => armed.has(m)))) return;
    const { income } = budgetOf(w, n, acc);
    if (income < POOR_INCOME || shipyard(w, n) < 0 || (land.get(n) ?? 0) <= FEW_FORMATIONS) return;
    if (nc.gold[n]! >= fleetPrice(w, income, kinds) + RESERVE_MONTHS * income) return;
    res.set(n, band((upkeep.get(n) ?? 0) / (peaceShare(nc.aggression[n]!) * income)));
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
          const seen = read(w);
          const before = new Set<number>();
          w.production.forEach((id) => before.add(id * 1000 + w.production.cols.template[id]!));
          inner(w);
          const got = new Set<number>();
          const p = w.production.cols;
          w.production.forEach((id) => {
            if (!before.has(id * 1000 + p.template[id]!) && w.rules!.templates[p.template[id]!]!.domain === Domain.land) got.add(p.nation[id]!);
          });
          const yr = Math.floor(w.tick / 8760) + 1;
          for (const [n, b] of seen) {
            months[b] = (months[b] ?? 0) + 1;
            if (got.has(n)) ordered[b] = (ordered[b] ?? 0) + 1;
            const y = (byYear[yr] ??= {});
            y[b] = (y[b] ?? 0) + 1;
          }
        },
  );
}
for (let k = 0; k < years; k++) sim.step(24 * 365, (w) => { w.out.events.length = 0; w.out.fires.length = 0; });
console.log(`seed ${seed}, ${years} years: months by army upkeep / peacetime share (months, with a land order)`);
for (const b of Object.keys(months).sort((a, c) => parseFloat(a) - parseFloat(c))) console.log(`  ${b.padEnd(10)} ${String(months[b]).padStart(5)} ${String(ordered[b] ?? 0).padStart(5)}`);
writeFileSync(out, JSON.stringify({ seed, years, months, ordered, byYear }, null, 1));
