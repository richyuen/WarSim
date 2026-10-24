/**
 * PLAN 7.104a: the world's land army against its economy. From a saved state or from 1938 after
 * a number of days, after one more day: the living nations, those at war, the land formations
 * (not fleets or wings) of living nations and their men, the same of nations at war, the wars,
 * the sum of the monthly income (`income`) and of the gold, and the 10 largest armies (formations,
 * men, income, gold, at war or not).
 *
 * Usage: npx tsx tools/diag/armyTotals.ts <out.json> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: unknown[] = [];
for (const a of process.argv.slice(3)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src!.startsWith('1938@')) for (let d = Number(src!.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src!)));
  s.step(24, quiet);
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const atWar = w.wars.nations();
  const per = new Map<number, { f: number; men: number }>();
  let f = 0;
  let men = 0;
  let fw = 0;
  let menW = 0;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = c.nation[id]!;
    if (nat.living[n] !== 1) return;
    f++;
    men += c.strength[id]!;
    if (atWar.has(n)) {
      fw++;
      menW += c.strength[id]!;
    }
    const p = per.get(n) ?? { f: 0, men: 0 };
    p.f++;
    p.men += c.strength[id]!;
    per.set(n, p);
  });
  let living = 0;
  let income = 0;
  let gold = 0;
  for (let n = 1; n < nat.living.length; n++) {
    if (nat.living[n] !== 1) continue;
    living++;
    income += nat.income[n]!;
    gold += nat.gold[n]!;
  }
  const top = [...per.entries()]
    .sort((p, q) => q[1].men - p[1].men)
    .slice(0, 10)
    .map(([n, p]) => ({ n: tag(n), f: p.f, men: p.men, income: Math.round(nat.income[n]!), gold: Math.round(nat.gold[n]!), war: atWar.has(n) }));
  const row = { seed: Number(seedS), src, year: Math.floor(w.tick / 24 / 365) + 1, living, atWar: [...atWar].filter((n) => nat.living[n] === 1).length, wars: w.wars.list.length, land: f, men, landAtWar: fw, menAtWar: menW, income: Math.round(income), gold: Math.round(gold), top };
  rows.push(row);
  process.stderr.write(`${seedS} ${src}: living ${living} atWar ${row.atWar} wars ${row.wars} land ${f} men ${men} (at war ${fw} / ${menW}) income ${row.income}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
