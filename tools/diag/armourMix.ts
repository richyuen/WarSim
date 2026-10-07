/**
 * `npx tsx tools/diag/armourMix.ts [--seed 99] [--years 10] [--tags GER,SOV,USA,ENG,FRA,ITA,JAP]`
 *
 * The armour in the armies of the great powers by year (PLAN 3.5d), read from a headless 1938
 * run: at the start and at the end of each year, for each nation, the tanks' share of its
 * army's upkeep (`EconomyTables.templateArmour` of each formation's template, by its strength:
 * what the economic AI steers by), beside its monthly income, its formations and those of them
 * that are armour (`SPEARHEAD_ARMOUR`). `-` for a nation that is dead.
 */
import { SPEARHEAD_ARMOUR } from '../../src/sim/ai/operational';
import { ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { loadAssets1938 } from '../headless/assets';
import { TICKS_PER_YEAR } from '../headless/runner';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg('seed', '99'));
const years = Number(arg('years', '10'));
const tags = arg('tags', 'GER,SOV,USA,ENG,FRA,ITA,JAP').split(',');
const nations = tags.map((t) => {
  const n = TAGS_1938.indexOf(t) + 1;
  if (n === 0) throw new Error(`--tags: no nation '${t}'`);
  return n;
});
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const world = sim.world;
const f = world.formations.cols;
const T = ECONOMY_TABLES_1938;

function row(year: number): void {
  const all = new Map<number, number>();
  const tanks = new Map<number, number>();
  const count = new Map<number, number>();
  const armour = new Map<number, number>();
  world.formations.forEach((id) => {
    const n = f.nation[id]!;
    const t = f.template[id]!;
    const full = T.templateStrength[t] ?? 0;
    const u = full > 0 ? (UPKEEP_SCALE * (T.templateUpkeep[t] ?? 0) * f.strength[id]!) / full : 0;
    const share = T.templateArmour[t] ?? 0;
    all.set(n, (all.get(n) ?? 0) + u);
    tanks.set(n, (tanks.get(n) ?? 0) + u * share);
    count.set(n, (count.get(n) ?? 0) + 1);
    if (share >= SPEARHEAD_ARMOUR) armour.set(n, (armour.get(n) ?? 0) + 1);
  });
  const acc = monthlyAccounts(world, T);
  const cells = nations.map((n) => {
    if (world.nations.cols.living[n] !== 1) return '-'.padStart(24);
    const a = all.get(n) ?? 0;
    const share = a > 0 ? (100 * (tanks.get(n) ?? 0)) / a : 0;
    return `${share.toFixed(1).padStart(5)}% ${String(Math.round(Math.max(0, acc.gross[n]!))).padStart(5)} ${String(armour.get(n) ?? 0).padStart(3)}/${String(count.get(n) ?? 0).padEnd(4)}`.padStart(24);
  });
  console.log(`${String(year).padStart(4)} ${cells.join(' ')}`);
}

console.log(`seed ${seed}: the tanks' share of the army's upkeep, the monthly income, armour formations / all`);
console.log(`year ${tags.map((t) => t.padStart(24)).join(' ')}`);
row(0);
for (let y = 1; y <= years; y++) {
  sim.step(TICKS_PER_YEAR, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  row(y);
}
