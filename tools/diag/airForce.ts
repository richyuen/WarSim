/**
 * PLAN 7.113's read: what the AI's air forces build and lose, by year, from 1938. Per year:
 * - wings of living nations (mean of the days), their aircraft, and aircraft a wing against its
 *   template's full strength;
 * - wings built (`FormationSpawned` of a wing) and wings lost (`FormationDestroyed` of one), by cause,
 *   from the hour before: aloft (`inAir`: shot down in the air or by AA), its airbase no longer its
 *   side's (`baseTaken`: no fallback with room), at sea with a carrier sunk or lost (`carrier`), its
 *   nation dead (`nationDied`), else `other`;
 * - aircraft lost by wings that live on (an hour's fall in a wing's strength; never given back: a
 *   wing is not refilled, `refillable` is the army's);
 * - each month's start, every living AI nation at war with an income at least POOR_INCOME and a
 *   wing to build: its air force's upkeep against AIR_SHARE × its army's (`economicAi`'s gate, 3c),
 *   counted under (`share.under`) or at it (`share.at`), with the sums of both upkeeps.
 *
 * Usage: npx tsx tools/diag/airForce.ts <seed> [years = 20] [out = .cache/airForce_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { isMonthStart } from '../../src/shared/calendar';
import { loadAssets1938 } from '../headless/assets';
import { AIR_SHARE, deliveryWing, peaceShare, POOR_INCOME, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { airfield } from '../../src/sim/systems/production';
import { knowsTechs } from '../../src/sim/tech';
import { Domain } from '../../src/sim/world';
import { ofSide } from '../../src/sim/systems/air';
import { UPKEEP_SCALE } from '../../src/sim/systems/economy';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/airForce_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const T = ECONOMY_TABLES_1938;

const upkeep = (ww: World, id: number): number => {
  const t = ww.formations.cols.template[id]!;
  const full = T.templateStrength[t] ?? 0;
  return full > 0 ? (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * ww.formations.cols.strength[id]!) / full : 0;
};

type Prev = { nation: number; base: number; aloft: boolean; strength: number };
let prev = new Map<number, Prev>();
const snap = (ww: World): Map<number, Prev> => {
  const m = new Map<number, Prev>();
  const c = ww.formations.cols;
  for (const [id, base] of ww.wingBase) if (ww.formations.has(id)) m.set(id, { nation: c.nation[id]!, base, aloft: ww.sorties.has(id), strength: c.strength[id]! });
  return m;
};
prev = snap(w);

/**
 * The first of step 3c's gates that stops nation `n`'s wing this month, as `economicAi` takes them
 * (its air force under its share): a wing in training; saving for a delivery bomber (2b); no wing it
 * knows the techs of; no airfield of its own with room; gold under the price and RESERVE_MONTHS of
 * income (`goldPriceHeld`: the price held, the reserve not); manpower; else `balance` (the month's books after the orders before it, or ordered).
 */
function gate(ww: World, n: number): string {
  const rules = ww.rules!;
  let pending = false;
  ww.production.forEach((id) => {
    if (ww.production.cols.nation[id] === n && rules.templates[ww.production.cols.template[id]!]!.domain === Domain.air) pending = true;
  });
  if (pending) return 'pending';
  const kinds = BUILD_MIX_1938.wings;
  if (deliveryWing(ww, n, kinds) >= 0) return 'saving';
  const own: number[] = [];
  ww.formations.forEach((id) => {
    if (ww.isWing(id) && ww.formations.cols.nation[id] === n) own.push(id);
  });
  const fighters = own.filter((id) => ww.formations.cols.template[id] === kinds.fighter).length;
  const order = 2 * fighters < own.length || own.length === 0 ? [kinds.fighter, kinds.tactical] : [kinds.tactical, kinds.fighter];
  const t = order.find((k) => rules.templates[k] !== undefined && knowsTechs(ww, n, rules.templates[k]!.techs)) ?? -1;
  if (t < 0) return 'noTech';
  if (airfield(ww, n, t) < 0) return 'noAirfield';
  const nc = ww.nations.cols;
  const rule = rules.templates[t]!;
  if (nc.gold[n]! < rule.gold + RESERVE_MONTHS * nc.income[n]!) {
    if (nc.gold[n]! < rule.gold) return 'gold';
    // The army's upkeep (its orders in training aside) against its peacetime share: ADR-615's condition.
    let army = 0;
    ww.formations.forEach((id) => {
      if (ww.formations.cols.nation[id] === n && !ww.isFleet(id) && !ww.isWing(id) && !ww.offLand(id)) army += upkeep(ww, id);
    });
    return army < peaceShare(nc.aggression[n]!) * nc.income[n]! ? 'goldPriceHeld' : 'goldPriceHeldArmyOver';
  }
  if (nc.manpower[n]! < rule.manpower) return 'manpower';
  return 'balance';
}

const rows: Record<string, number>[] = [];
for (let y = 1; y <= years; y++) {
  const r: Record<string, number> = { year: y };
  const add = (k: string, v = 1): void => {
    r[k] = (r[k] ?? 0) + v;
  };
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      const c = ww.formations.cols;
      for (let i = 0; i < ev.length; i += 6) {
        const kind = ev[i + 1];
        const fid = ev[i + 2]!;
        if (kind === EventKind.FormationSpawned && ww.formations.has(fid) && ww.isWing(fid)) add('built');
        if (kind === EventKind.FormationDestroyed && prev.has(fid)) {
          const p = prev.get(fid)!;
          const cause =
            ww.nations.cols.living[p.nation] !== 1 ? 'nationDied'
            : p.aloft ? 'inAir'
            : p.base <= 0 ? 'carrier'
            : !ofSide(ww, p.nation, ww.cells.controller[ww.airbases[p.base - 1]!.cell]!) ? 'baseTaken'
            : 'other';
          add(`lost.${cause}`);
          add('lost');
          add('aircraftLostWithWings', p.strength);
          prev.delete(fid);
        }
      }
      ev.length = 0;
      ww.out.fires.length = 0;
      const now = snap(ww);
      for (const [id, p] of now) {
        const q = prev.get(id);
        if (q && q.nation === p.nation && p.strength < q.strength) add('aircraftLostLiving', q.strength - p.strength);
      }
      prev = now;
      if (isMonthStart(ww.startDay, ww.tick - 1)) {
        const nc = ww.nations.cols;
        const air = new Map<number, number>();
        const army = new Map<number, number>();
        ww.formations.forEach((id) => {
          if (ww.isFleet(id)) return;
          const n = c.nation[id]!;
          if (ww.isWing(id)) air.set(n, (air.get(n) ?? 0) + upkeep(ww, id));
          else if (!ww.offLand(id)) army.set(n, (army.get(n) ?? 0) + upkeep(ww, id));
        });
        const atWar = ww.wars.nations();
        for (let n = 1; n < nc.living.length; n++) {
          if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || !atWar.has(n) || nc.income[n]! < POOR_INCOME) continue;
          if (!BUILD_MIX_1938.wings) continue;
          const a = air.get(n) ?? 0;
          const g = army.get(n) ?? 0;
          add(a < AIR_SHARE * g ? 'share.under' : 'share.at');
          if (a < AIR_SHARE * g) add(`gate.${gate(ww, n)}`);
          add('share.airUpkeep', a);
          add('share.armyUpkeep', g);
          add('share.income', nc.income[n]!);
        }
      }
    });
    const c = w.formations.cols;
    let wings = 0;
    let aircraft = 0;
    let full = 0;
    w.formations.forEach((id) => {
      if (!w.isWing(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
      wings++;
      aircraft += c.strength[id]!;
      full += T.templateStrength[c.template[id]!] ?? 0;
    });
    add('wingDays', wings);
    add('aircraftDays', aircraft);
    add('fullDays', full);
  }
  rows.push(r);
  const f = (k: string): string => (r[k] ?? 0).toFixed(0);
  process.stderr.write(
    `${seed} year ${y}: wings ${(r.wingDays! / 365).toFixed(1)}, aircraft/full ${(r.aircraftDays! / Math.max(1, r.fullDays!)).toFixed(2)}, built ${f('built')}, lost ${f('lost')} (air ${f('lost.inAir')}, base ${f('lost.baseTaken')}, carrier ${f('lost.carrier')}, died ${f('lost.nationDied')}, other ${f('lost.other')}), aircraft lost living ${f('aircraftLostLiving')}, share under/at ${f('share.under')}/${f('share.at')}, air/army upkeep ${((r['share.airUpkeep'] ?? 0) / Math.max(1, r['share.armyUpkeep'] ?? 0)).toFixed(3)}, gates ${['pending', 'saving', 'noTech', 'noAirfield', 'gold', 'goldPriceHeld', 'goldPriceHeldArmyOver', 'manpower', 'balance'].map((k) => `${k} ${f(`gate.${k}`)}`).join(' ')}\n`,
  );
}
writeFileSync(out, JSON.stringify({ seed, years, rows, hash: s.hash().toString(16) }, null, 1));
console.log(`done: ${seed} ${years} years`);
