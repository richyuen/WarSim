/**
 * PLAN 7.146: `armyGatesNow.ts`' month rows of the members of long-front wars, by role (weak or
 * strong side, `frontedRoles.ts` on the same saves and months; `fronted`: holding front cells of the
 * war or standing on its landmass). Per role: nation-months, the shares of income each spending
 * takes, the first gate of the army's next order and the land orders placed; by income band the
 * gates, and the gate after `slots` for the months a full slot gates (the cadre's price and upkeep
 * as `armyGatesNow` reads them, the reserve taken as none: at war under the peacetime share).
 *
 * Usage: npx tsx tools/diag/longWarGates.ts <gates.json> <frontedRoles.json>
 */
import { readFileSync } from 'node:fs';
import { ARMY_SHARE_WAR } from '../../src/sim/ai/economic';
import { UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';

type GateRow = { seed: number; day: number; n: string; income: number; army: number; ce: number; supp: number; research: number; refilledGold: number; navy: number; air: number; rest: number; gate: string; ordered: number; gold: number; formations: number; balance: number; need: number; training: number; manpower: number; shipPrice: number };
type Roles = { day: number; weak: string[]; strong: string[]; weakFronted: string[]; strongFronted: string[] };
const gates = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { rows: GateRow[] };
const fr = JSON.parse(readFileSync(process.argv[3]!, 'utf8')) as { rows: { seed: number; roles: Roles[] }[] };
const CADRE_GOLD = 504;
const CADRE_UP = UPKEEP_SCALE * (ECONOMY_TABLES_1938.templateUpkeep[BUILD_MIX_1938.cadre] ?? 0);
const roleOf = (g: GateRow): string => {
  const d = fr.rows.find((x) => x.seed === g.seed)?.roles.find((r) => r.day === g.day);
  if (!d) return 'unjoined';
  if (d.weakFronted.includes(g.n)) return 'weak fronted';
  if (d.weak.includes(g.n)) return 'weak away';
  if (d.strongFronted.includes(g.n)) return 'strong fronted';
  if (d.strong.includes(g.n)) return 'strong away';
  return 'none';
};
/** The gate after `slots`, as armyGatesNow's chain reads it. */
const afterSlots = (r: GateRow): string => {
  const left = r.balance - r.research - r.training;
  return r.army + r.training >= ARMY_SHARE_WAR * r.income ? 'share' : left - CADRE_UP <= r.need ? 'balance' : r.gold < CADRE_GOLD ? 'gold' : r.manpower < 3000 ? 'manpower' : r.shipPrice > 0 ? 'ship?' : 'open';
};
const by = new Map<string, GateRow[]>();
for (const g of gates.rows) {
  const k = roleOf(g);
  (by.get(k) ?? by.set(k, []).get(k)!).push(g);
}
const BANDS = [20, 100, 400, 1000, Infinity];
const count = (rs: GateRow[], f: (r: GateRow) => string): Record<string, number> => {
  const g: Record<string, number> = {};
  for (const r of rs) g[f(r)] = (g[f(r)] ?? 0) + 1;
  return g;
};
for (const [role, rows] of [...by].sort()) {
  const inc = rows.reduce((t, r) => t + r.income, 0) || 1;
  const share = (f: (r: GateRow) => number): number => +(rows.reduce((t, r) => t + f(r), 0) / inc).toFixed(3);
  console.log(`${role}: ${rows.length} nation-months, ${new Set(rows.map((r) => `${r.seed}:${r.n}`)).size} nations, income ${Math.round(inc)}, ordered ${rows.reduce((t, r) => t + r.ordered, 0)}, formations a month ${(rows.reduce((t, r) => t + r.formations, 0) / rows.length).toFixed(1)}`);
  console.log(`  shares ${JSON.stringify({ army: share((r) => r.army), ce: share((r) => r.ce), supp: share((r) => r.supp), research: share((r) => r.research), refills: share((r) => r.refilledGold), navy: share((r) => r.navy), air: share((r) => r.air), rest: share((r) => r.rest) })}`);
  console.log(`  gates ${JSON.stringify(count(rows, (r) => r.gate))}`);
  BANDS.forEach((b, i) => {
    const lo = i === 0 ? 0 : BANDS[i - 1]!;
    const rs = rows.filter((r) => r.income >= lo && r.income < b);
    if (rs.length === 0) return;
    const slotted = rs.filter((r) => r.gate === 'slots');
    console.log(
      `    ${`${lo}-${b}`.padEnd(14)} months ${String(rs.length).padStart(4)} income ${(rs.reduce((t, r) => t + r.income, 0) / inc).toFixed(3)} ordered ${rs.reduce((t, r) => t + r.ordered, 0)} formations ${(rs.reduce((t, r) => t + r.formations, 0) / rs.length).toFixed(1)} gates ${JSON.stringify(count(rs, (r) => r.gate))} after slots ${JSON.stringify(count(slotted, afterSlots))}`,
    );
  });
}
