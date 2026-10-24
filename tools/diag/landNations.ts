/**
 * PLAN 7.113's per-nation read of the land war: from 1938, sampled daily in years 2–`years`, each
 * nation's land formations (on land, of a living nation), their men, those engaged, its days at war
 * and its wings. The world's engaged formations are split three ways: the USA's, those of nations at
 * war with the USA, the rest. Per nation as means a day.
 *
 * Usage: npx tsx tools/diag/landNations.ts <seed> [years = 20] [out = .cache/landNations_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/landNations_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const USA = TAGS_1938.indexOf('USA') + 1;
type Acc = { land: number; men: number; engaged: number; atWar: number; wings: number };
const by = new Map<number, Acc>();
const split = { usa: 0, vsUsa: 0, rest: 0 };
let days = 0;
const step = (): void =>
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
for (let d = 0; d < 365; d++) step();
for (let d = 0; d < 365 * (years - 1); d++) {
  step();
  days++;
  const c = w.formations.cols;
  const atWar = w.wars.nations();
  const get = (n: number): Acc => {
    let a = by.get(n);
    if (!a) by.set(n, (a = { land: 0, men: 0, engaged: 0, atWar: 0, wings: 0 }));
    return a;
  };
  w.formations.forEach((id) => {
    const n = c.nation[id]!;
    if (w.nations.cols.living[n] !== 1 || w.isFleet(id)) return;
    if (w.isWing(id)) {
      get(n).wings++;
      return;
    }
    if (w.offLand(id)) return;
    const a = get(n);
    a.land++;
    a.men += c.strength[id]!;
    if (c.engaged[id] === 1) {
      a.engaged++;
      if (n === USA) split.usa++;
      else if (w.wars.atWar(n, USA)) split.vsUsa++;
      else split.rest++;
    }
  });
  for (const n of atWar) get(n).atWar++;
}
const rows = [...by]
  .map(([n, a]) => ({ nation: n, tag: TAGS_1938[n - 1] ?? `#${n}`, land: +(a.land / days).toFixed(1), men: Math.round(a.men / days), engaged: +(a.engaged / days).toFixed(2), atWar: +(a.atWar / days).toFixed(2), wings: +(a.wings / days).toFixed(1) }))
  .sort((a, b) => b.engaged - a.engaged || a.nation - b.nation);
const sum = (k: 'land' | 'men' | 'engaged' | 'wings'): number => rows.reduce((t, r) => t + r[k], 0);
const summary = { seed, years, land: +sum('land').toFixed(1), men: Math.round(sum('men')), engaged: +sum('engaged').toFixed(2), wings: +sum('wings').toFixed(1), usa: +(split.usa / days).toFixed(2), vsUsa: +(split.vsUsa / days).toFixed(2), rest: +(split.rest / days).toFixed(2), hash: s.hash().toString(16) };
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary));
for (const r of rows.slice(0, 12)) console.log(`${r.tag.padEnd(5)} land ${String(r.land).padStart(6)} men ${String(r.men).padStart(8)} engaged ${String(r.engaged).padStart(5)} atWar ${r.atWar} wings ${r.wings}`);
console.log(`done: ${seed}`);
